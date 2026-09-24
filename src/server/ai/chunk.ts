import type { GeneratedCard } from "./schemas";

/** Normalizes notes so the same content hashes the same. */
export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits text into chunks of at most `size` characters, preferring paragraph,
 * then line, then sentence boundaries.
 */
export function chunkText(text: string, size = 12_000): string[] {
  const clean = normalizeText(text);
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    const cut =
      lastIndex(window, "\n\n", size * 0.5) ??
      lastIndex(window, "\n", size * 0.5) ??
      lastIndex(window, ". ", size * 0.5) ??
      size;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function lastIndex(s: string, sep: string, min: number): number | undefined {
  const i = s.lastIndexOf(sep);
  return i >= min ? i + sep.length : undefined;
}

/** Most cards a single set can get from generation. */
export const MAX_CARDS = 150;

/** How many cards to ask for: about one per 200 characters of notes (10–150). */
export function targetCardCount(chars: number) {
  return Math.max(10, Math.min(MAX_CARDS, Math.round(chars / 200)));
}

/** Merges cards from several chunks, dropping near-duplicate terms, capped at `max`. */
export function mergeCards(groups: GeneratedCard[][], max = MAX_CARDS): GeneratedCard[] {
  const seen = new Set<string>();
  const out: GeneratedCard[] = [];
  for (const group of groups) {
    for (const card of group) {
      const key = dedupeKey(card.term);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(card);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function dedupeKey(term: string) {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|ang|mga)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
