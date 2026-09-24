import { createHash } from "node:crypto";

export type ShareContent = {
  title: string;
  subject: string | null;
  summary: string | null;
  cards: { term: string; definition: string; example: string | null }[];
};

/** Everything other people would see, as one text for screening. */
export function contentText(c: ShareContent): string {
  const lines = [c.title, c.subject ?? "", c.summary ?? ""];
  for (const card of c.cards) lines.push(`${card.term} — ${card.definition}${card.example ? ` (${card.example})` : ""}`);
  return lines.filter(Boolean).join("\n");
}

export function contentHash(c: ShareContent): string {
  return createHash("sha256").update(contentText(c)).digest("hex");
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+/gi;

/** Links in the text (www.* gets http://), trailing punctuation trimmed, deduplicated, max 500. */
export function extractUrls(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.match(URL_RE) ?? []) {
    const trimmed = match.replace(/[.,;:!?]+$/, "");
    seen.add(/^www\./i.test(trimmed) ? `http://${trimmed}` : trimmed);
    if (seen.size >= 500) break;
  }
  return [...seen];
}
