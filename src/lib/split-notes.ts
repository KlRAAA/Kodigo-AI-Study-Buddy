/**
 * Splits notes that are over the length limit into parts that each fit.
 * Cuts at the latest paragraph break that fits, then a line break, then a
 * sentence end, and only cuts mid-text when a single block has no breaks.
 */
export function splitNotes(text: string, max: number): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 2); // +2 so a break right at the limit still counts
    const cut = lastBreak(window, "\n\n", max) ?? lastBreak(window, "\n", max) ?? lastSentenceEnd(window, max) ?? max;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Index to cut at (before the separator), if the part would be at least a third of the limit. */
function lastBreak(window: string, sep: string, max: number) {
  const i = window.lastIndexOf(sep, max);
  return i >= max / 3 ? i : null;
}

function lastSentenceEnd(window: string, max: number) {
  const head = window.slice(0, max);
  const i = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  return i >= max / 3 ? i + 1 : null;
}
