import { isAnswerCorrect } from "./answer-match";

const MAX_ITEMS = 10;

/**
 * Splits a definition into list items when it reads like a list:
 * one item per line / bullet / number, or separated by semicolons,
 * or 3+ short comma-separated items ("a, b and c").
 * Returns null when the definition isn't a list.
 */
export function parseListItems(definition: string): string[] | null {
  const text = definition.trim();
  // Drop a lead-in like "Three types:" before the list.
  const body = text.includes(":") ? text.slice(text.indexOf(":") + 1) : text;

  let parts: string[] = [];
  const lines = body.split(/\n+/).map(stripBullet).filter(Boolean);
  if (lines.length >= 2) parts = lines;
  else if (body.includes(";")) parts = body.split(";").map(stripBullet).filter(Boolean);
  else {
    const commas = body
      .replace(/,?\s+(and|at|o|or)\s+(?=[^,]+$)/i, ", ")
      .split(",")
      .map(stripBullet)
      .filter(Boolean);
    // Only short items count, so ordinary sentences with commas aren't treated as lists.
    if (commas.length >= 3 && commas.every((p) => p.split(/\s+/).length <= 5)) parts = commas;
  }

  const items = parts.map((p) => p.replace(/[.。]+$/, "").trim()).filter(Boolean);
  return items.length >= 2 && items.length <= MAX_ITEMS ? items : null;
}

function stripBullet(s: string) {
  return s.replace(/^\s*(?:[-*•·]|\d+[.)]|[a-z][.)])\s+/i, "").trim();
}

/**
 * Checks an enumeration answer in any order, one given answer per expected item.
 * Returns which expected items were missed.
 */
export function checkEnumeration(given: string[], expected: string[]) {
  const unused = given.map((g) => g.trim()).filter(Boolean);
  const missed: string[] = [];
  for (const item of expected) {
    const idx = unused.findIndex((g) => isAnswerCorrect(g, item));
    if (idx >= 0) unused.splice(idx, 1);
    else missed.push(item);
  }
  return { correct: missed.length === 0, missed };
}
