/** Lowercases, strips accents/punctuation/articles, collapses spaces. */
export function normalizeAnswer(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(the|a|an|ang|mga|si|ng)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance with an early exit once it passes `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      rowMin = Math.min(rowMin, cur[j]!);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * Lenient check for "type the answer": ignores case, accents, punctuation and
 * articles, and forgives small typos (1 edit per 5 characters, max 3).
 */
export function isAnswerCorrect(given: string, expected: string): boolean {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (!g || !e) return false;
  if (g === e) return true;
  const allowed = Math.min(3, Math.floor(e.length / 5));
  return allowed > 0 && editDistance(g, e, allowed) <= allowed;
}
