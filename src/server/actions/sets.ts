"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AllModelsFailedError } from "../ai";
import { extractTextFromImages, generateSummaryAndCards, getCachedGeneration } from "../ai/generate";
import type { Lang } from "../ai/prompts";
import { addCard, deleteCard, listCards, replaceCards, setIdForCard, updateCard } from "../db/queries/cards";
import { markSetStale } from "../db/queries/sharing";
import {
  createSet,
  deleteSet,
  deleteTrashedSet,
  getSet,
  moveSetToTrash,
  restoreSet,
  updateSet,
} from "../db/queries/sets";
import { refundDaily } from "../db/queries/usage";
import { UPLOAD_LIMITS, readLimits } from "../limits/config";
import { acquire } from "../limits/limiter";
import { log } from "../log";
import { actionUser } from "./session";
import { fail, ok, type ActionResult } from "./result";

const uuid = z.string().uuid();
const outputLang = z.enum(["auto", "en", "tl"]);

const createSchema = z.object({
  title: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(80).optional(),
  sourceType: z.enum(["text", "pdf", "pptx", "photo"]),
  text: z.string().trim().min(40),
  outputLang,
});

/** Creates a set from extracted text and generates summary + cards. */
export async function createSetAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { text, sourceType, outputLang: requested, title, subject } = parsed.data;
  if (text.length > readLimits().maxInputChars) return fail("too_long");

  const lang: Lang = requested;
  const userId = me.user.id;

  // Cached results are free; only a cache miss uses allowance.
  const cached = await getCachedGeneration(text, lang);
  if (!cached) {
    const gate = await acquire(userId, "generation", { isSuspended: me.profile.isSuspended });
    if (!gate.ok) return fail(gate.reason);
  }

  const setId = await createSet(userId, {
    title: title || "…",
    subject: subject || null,
    sourceType,
    sourceText: text,
    outputLang: requested,
  });

  try {
    const result = cached ?? (await generateSummaryAndCards(userId, text, lang));
    await replaceCards(userId, setId, result.cards);
    await updateSet(userId, setId, {
      title: title || result.title || fallbackTitle(text),
      summary: result.summary,
      status: "ready",
    });
    revalidatePath("/home");
    return ok({ id: setId });
  } catch (err) {
    await deleteSet(userId, setId);
    if (!cached) await refundDaily(userId, "generation");
    if (err instanceof AllModelsFailedError) return fail("ai_unavailable");
    log.error("sets.generate_failed", { name: err instanceof Error ? err.name : "unknown" });
    return fail("unknown");
  }
}

const photoSchema = z
  .array(z.string().startsWith("data:image/jpeg;base64,").max(UPLOAD_LIMITS.maxImageDataUrlChars))
  .min(1)
  .max(UPLOAD_LIMITS.maxPhotos);

/** Photo → text. Uses one "generation" unit; the images are discarded after the call. */
export async function extractPhotoTextAction(
  images: string[],
): Promise<ActionResult<{ text: string }>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = photoSchema.safeParse(images);
  if (!parsed.success) return fail("invalid_input");

  const gate = await acquire(me.user.id, "generation", { isSuspended: me.profile.isSuspended });
  if (!gate.ok) return fail(gate.reason);
  try {
    const text = await extractTextFromImages(me.user.id, parsed.data);
    return ok({ text });
  } catch (err) {
    await refundDaily(me.user.id, "generation");
    if (err instanceof AllModelsFailedError) return fail("ai_unavailable");
    log.error("sets.extract_failed", { name: err instanceof Error ? err.name : "unknown" });
    return fail("unknown");
  }
}

const metaSchema = z.object({
  setId: uuid,
  title: z.string().trim().min(1).max(120),
  subject: z.string().trim().max(80).optional(),
});

export async function updateSetMetaAction(input: z.input<typeof metaSchema>): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = metaSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { setId, title, subject } = parsed.data;
  // Mark stale before the write so viewers never see unscreened content; the write enforces ownership.
  await markSetStale(me.user.id, setId);
  // Omitted subject = keep it (rename from list cards only sends a title).
  const found = await updateSet(me.user.id, setId, {
    title,
    ...(subject === undefined ? {} : { subject: subject || null }),
  });
  if (!found) return fail("not_found");
  revalidatePath(`/sets/${setId}`);
  return ok(null);
}

/** Moves a set to Trash (restorable for 30 days). */
export async function deleteSetAction(setId: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(setId).success) return fail("invalid_input");
  if (!(await moveSetToTrash(me.user.id, setId))) return fail("not_found");
  revalidatePath("/home");
  revalidatePath("/trash");
  return ok(null);
}

export async function restoreSetAction(setId: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(setId).success) return fail("invalid_input");
  if (!(await restoreSet(me.user.id, setId))) return fail("not_found");
  revalidatePath("/trash");
  revalidatePath("/home");
  return ok(null);
}

/** Permanently deletes a set that is already in Trash. */
export async function deleteForeverAction(setId: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(setId).success) return fail("invalid_input");
  if (!(await deleteTrashedSet(me.user.id, setId))) return fail("not_found");
  revalidatePath("/trash");
  return ok(null);
}

const cardFields = z.object({
  term: z.string().trim().min(1).max(300),
  definition: z.string().trim().min(1).max(1500),
  example: z.string().trim().max(800).optional(),
});

export type StudyCard = {
  id: string;
  term: string;
  definition: string;
  example: string | null;
  starred: boolean;
};

export async function addCardAction(
  setId: string,
  input: z.input<typeof cardFields>,
): Promise<ActionResult<StudyCard>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = cardFields.safeParse(input);
  if (!uuid.safeParse(setId).success || !parsed.success) return fail("invalid_input");
  await markSetStale(me.user.id, setId);
  const card = await addCard(me.user.id, setId, { ...parsed.data, example: parsed.data.example || null });
  if (!card) return fail("not_found");
  return ok(toStudyCard(card));
}

export async function updateCardAction(
  cardId: string,
  input: z.input<typeof cardFields>,
): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = cardFields.safeParse(input);
  if (!uuid.safeParse(cardId).success || !parsed.success) return fail("invalid_input");
  const setId = await setIdForCard(me.user.id, cardId);
  if (!setId) return fail("not_found");
  await markSetStale(me.user.id, setId);
  const found = await updateCard(me.user.id, cardId, { ...parsed.data, example: parsed.data.example || null });
  return found ? ok(null) : fail("not_found");
}

export async function toggleStarAction(cardId: string, starred: boolean): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(cardId).success || typeof starred !== "boolean") return fail("invalid_input");
  return (await updateCard(me.user.id, cardId, { starred })) ? ok(null) : fail("not_found");
}

export async function deleteCardAction(cardId: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(cardId).success) return fail("invalid_input");
  const setId = await setIdForCard(me.user.id, cardId);
  if (!setId) return fail("not_found");
  await markSetStale(me.user.id, setId);
  return (await deleteCard(me.user.id, cardId)) ? ok(null) : fail("not_found");
}

/** Used by study modes to refresh their offline copy. */
export async function getSetForStudyAction(
  setId: string,
): Promise<ActionResult<{ id: string; title: string; cards: StudyCard[] }>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(setId).success) return fail("invalid_input");
  const set = await getSet(me.user.id, setId);
  if (!set) return fail("not_found");
  const cards = await listCards(me.user.id, setId);
  return ok({ id: set.id, title: set.title, cards: cards.map(toStudyCard) });
}

function toStudyCard(c: StudyCard): StudyCard {
  return { id: c.id, term: c.term, definition: c.definition, example: c.example, starred: c.starred };
}

function fallbackTitle(text: string) {
  const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? "Study set";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}
