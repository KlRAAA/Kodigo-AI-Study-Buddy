import "server-only";
import { cacheKey, callAI, readCache, writeCache } from "./index";
import { chunkText, mergeCards, normalizeText, targetCardCount } from "./chunk";
import { extractTextMessages, summaryAndCardsMessages, type Lang } from "./prompts";
import { extractedTextSchema, summaryAndCardsSchema, type SummaryAndCards } from "./schemas";

export type Generated = SummaryAndCards & { cached: boolean };

export function generationCacheKey(notes: string, lang: Lang) {
  return cacheKey("summary_cards:v1", lang, normalizeText(notes));
}

export async function getCachedGeneration(notes: string, lang: Lang) {
  return readCache(generationCacheKey(notes, lang), summaryAndCardsSchema);
}

/** Summary + flashcards. Long notes are chunked, generated per chunk, then merged. */
export async function generateSummaryAndCards(userId: string, notes: string, lang: Lang): Promise<Generated> {
  const key = generationCacheKey(notes, lang);
  const cached = await readCache(key, summaryAndCardsSchema);
  if (cached) return { ...cached, cached: true };

  const chunkSize = Number(process.env.AI_CHUNK_CHARS) || 12_000;
  const chunks = chunkText(notes, chunkSize);
  const totalCards = targetCardCount(normalizeText(notes).length);
  const perChunk = Math.max(5, Math.ceil(totalCards / chunks.length));

  const parts: SummaryAndCards[] = [];
  for (const [index, chunk] of chunks.entries()) {
    parts.push(
      await callAI({
        task: "summary_cards",
        userId,
        schema: summaryAndCardsSchema,
        messages: summaryAndCardsMessages(chunk, lang, perChunk, { index, total: chunks.length }),
      }),
    );
  }

  const result: SummaryAndCards = {
    title: parts[0]?.title ?? null,
    summary: parts.map((p) => p.summary.trim()).join("\n\n"),
    cards: mergeCards(
      parts.map((p) => p.cards),
      60,
    ),
  };
  await writeCache(key, "summary_cards", lang, result);
  return { ...result, cached: false };
}

/** Photo → text via the vision chain. Images are never stored. */
export async function extractTextFromImages(userId: string, imageDataUrls: string[]) {
  const { text } = await callAI({
    task: "extract_text",
    userId,
    needsVision: true,
    schema: extractedTextSchema,
    messages: extractTextMessages(imageDataUrls),
  });
  return text;
}
