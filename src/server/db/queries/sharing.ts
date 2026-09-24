import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";
import { getDb } from "../client";
import { cards, profiles, studySets, type ModerationStatus, type Visibility } from "../schema";
import type { ShareContent } from "@/server/moderation/content";

/** Viewable by anyone with the link. Requires a join on profiles (owner). */
export function viewableSetWhere(): SQL {
  return and(
    inArray(studySets.visibility, ["link", "public"]),
    eq(studySets.moderationStatus, "approved"),
    isNull(profiles.bannedAt),
  )!;
}

/** Shown on profiles, explore and feeds. Requires a join on profiles (owner). */
export function listedSetWhere(): SQL {
  return and(eq(studySets.visibility, "public"), eq(studySets.moderationStatus, "approved"), isNull(profiles.bannedAt))!;
}

export type ShareState = {
  visibility: Visibility;
  moderationStatus: ModerationStatus;
  moderationReason: string | null;
  moderatedHash: string | null;
  shareSlug: string | null;
  publishedAt: Date | null;
};

const ownSet = (userId: string, setId: string) => and(eq(studySets.id, setId), eq(studySets.userId, userId));

export async function getShareState(userId: string, setId: string): Promise<ShareState | null> {
  const rows = await getDb()
    .select({
      visibility: studySets.visibility,
      moderationStatus: studySets.moderationStatus,
      moderationReason: studySets.moderationReason,
      moderatedHash: studySets.moderatedHash,
      shareSlug: studySets.shareSlug,
      publishedAt: studySets.publishedAt,
    })
    .from(studySets)
    .where(ownSet(userId, setId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateShareState(userId: string, setId: string, patch: Partial<ShareState>) {
  await getDb().update(studySets).set(patch).where(ownSet(userId, setId));
}

export async function loadShareContent(userId: string, setId: string): Promise<ShareContent | null> {
  const db = getDb();
  const [set] = await db
    .select({ title: studySets.title, subject: studySets.subject, summary: studySets.summary })
    .from(studySets)
    .where(ownSet(userId, setId))
    .limit(1);
  if (!set) return null;
  const rows = await db
    .select({ term: cards.term, definition: cards.definition, example: cards.example })
    .from(cards)
    .where(and(eq(cards.setId, setId), eq(cards.userId, userId)))
    .orderBy(asc(cards.position));
  return { ...set, cards: rows };
}

/** After an edit, a shared set must be re-screened before others see it again. */
export async function markSetStale(userId: string, setId: string) {
  await getDb()
    .update(studySets)
    .set({ moderationStatus: "stale" })
    .where(and(ownSet(userId, setId), ne(studySets.visibility, "private"), eq(studySets.moderationStatus, "approved")));
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newShareSlug(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => BASE62[b % 62]).join("");
}

export type PublicSetView = {
  id: string;
  title: string;
  subject: string | null;
  summary: string | null;
  slug: string;
  ownerHandle: string | null;
  ownerName: string | null;
  ratingAvg: number;
  ratingCount: number;
  copyCount: number;
  copiedFromHandle: string | null;
  cards: { id: string; term: string; definition: string; example: string | null }[];
};

/** Public page data. Never includes user ids, email, source text or moderation details. */
export async function getPublicSetBySlug(slug: string): Promise<PublicSetView | { updating: true } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: studySets.id,
      title: studySets.title,
      subject: studySets.subject,
      summary: studySets.summary,
      slug: studySets.shareSlug,
      visibility: studySets.visibility,
      moderationStatus: studySets.moderationStatus,
      bannedAt: profiles.bannedAt,
      ownerHandle: profiles.handle,
      ownerName: profiles.displayName,
      ratingAvg: studySets.ratingAvg,
      ratingCount: studySets.ratingCount,
      copyCount: studySets.copyCount,
      copiedFromHandle: studySets.copiedFromHandle,
    })
    .from(studySets)
    .innerJoin(profiles, eq(profiles.userId, studySets.userId))
    .where(eq(studySets.shareSlug, slug))
    .limit(1);
  if (!row || row.visibility === "private" || row.bannedAt) return null;
  if (row.moderationStatus === "stale") return { updating: true };
  if (row.moderationStatus !== "approved") return null;

  const cardRows = await db
    .select({ id: cards.id, term: cards.term, definition: cards.definition, example: cards.example })
    .from(cards)
    .where(eq(cards.setId, row.id))
    .orderBy(asc(cards.position));
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    summary: row.summary,
    slug: row.slug!,
    ownerHandle: row.ownerHandle,
    ownerName: row.ownerName,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    copyCount: row.copyCount,
    copiedFromHandle: row.copiedFromHandle,
    cards: cardRows,
  };
}
