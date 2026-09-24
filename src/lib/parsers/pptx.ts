import JSZip from "jszip";

export type PptxResult = { text: string; slides: number };

/** Decodes the few XML entities that appear in slide text. */
function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** Extracts text from slide XML: each <a:p> paragraph becomes a line of its <a:t> runs. */
export function slideXmlToText(xml: string): string {
  const lines: string[] = [];
  for (const para of xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...para.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) =>
      decodeXml(m[1] ?? ""),
    );
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

const slideNumber = (path: string) => Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0);

/** Reads slide text and speaker notes from a .pptx, in slide order. Runs in the browser. */
export async function parsePptx(data: ArrayBuffer | Uint8Array): Promise<PptxResult> {
  const zip = await JSZip.loadAsync(data);
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const parts: string[] = [];
  for (const path of slidePaths) {
    const n = slideNumber(path);
    const body = slideXmlToText(await zip.file(path)!.async("string"));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    // Notes XML also holds the slide-number placeholder; drop bare numbers.
    const notes = notesFile
      ? slideXmlToText(await notesFile.async("string"))
          .split("\n")
          .filter((l) => !/^\d+$/.test(l))
          .join("\n")
      : "";
    const section = [body, notes && `Notes: ${notes}`].filter(Boolean).join("\n");
    if (section) parts.push(`--- Slide ${n} ---\n${section}`);
  }
  return { text: parts.join("\n\n"), slides: slidePaths.length };
}
