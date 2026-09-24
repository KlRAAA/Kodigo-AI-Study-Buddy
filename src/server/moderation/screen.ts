import { chunkText } from "../ai/chunk";
import { contentText, extractUrls, type ShareContent } from "./content";

export type Verdict = "allow" | "review" | "block";
export type ScreenResult = { verdict: Verdict; categories: string[]; reason: string | null };

/** Safe Browsing or every AI model is unavailable: do not publish. */
export class ScreeningUnavailableError extends Error {
  constructor() {
    super("screening_unavailable");
    this.name = "ScreeningUnavailableError";
  }
}

export type ScreenDeps = {
  /** Returns the URLs flagged as harmful. */
  checkLinks: (urls: string[]) => Promise<string[]>;
  moderateText: (text: string) => Promise<ScreenResult>;
};

const SEVERITY: Record<Verdict, number> = { allow: 0, review: 1, block: 2 };

/** Links first (cheap, decisive), then the text chunk by chunk; the worst verdict wins. */
export async function screenContent(content: ShareContent, deps: ScreenDeps): Promise<ScreenResult> {
  const text = contentText(content);
  const urls = extractUrls(text);
  if (urls.length > 0) {
    const bad = await deps.checkLinks(urls);
    if (bad.length > 0) return { verdict: "block", categories: ["harmful_link"], reason: null };
  }
  let worst: ScreenResult = { verdict: "allow", categories: [], reason: null };
  for (const chunk of chunkText(text, 12_000)) {
    const r = await deps.moderateText(chunk);
    if (SEVERITY[r.verdict] > SEVERITY[worst.verdict]) worst = r;
    if (worst.verdict === "block") break;
  }
  return worst;
}
