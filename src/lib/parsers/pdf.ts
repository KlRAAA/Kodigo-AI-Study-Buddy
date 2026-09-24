import { UPLOAD_LIMITS } from "@/server/limits/config";

export type PdfResult = {
  text: string;
  pages: number;
  /** Pages with (almost) no text layer, probably scanned. */
  emptyPages: number[];
  truncated: boolean;
};

type TextItem = { str?: string; hasEOL?: boolean };

/** Turns pdf.js text items into lines. */
export function itemsToText(items: TextItem[]): string {
  let out = "";
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    out += item.str;
    out += item.hasEOL ? "\n" : item.str.endsWith(" ") ? "" : " ";
  }
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Extracts text in the browser with pdf.js (legacy build for older iOS Safari). */
export async function parsePdf(data: ArrayBuffer): Promise<PdfResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;

  const total = doc.numPages;
  const pageCount = Math.min(total, UPLOAD_LIMITS.maxPdfPages);
  const texts: string[] = [];
  const emptyPages: number[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = itemsToText(content.items as TextItem[]);
    if (text.replace(/\s/g, "").length < 20) emptyPages.push(i);
    else texts.push(text);
    page.cleanup();
  }
  await task.destroy();
  return { text: texts.join("\n\n"), pages: total, emptyPages, truncated: total > pageCount };
}
