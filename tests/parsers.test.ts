import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/image-compress";
import { itemsToText } from "@/lib/parsers/pdf";
import { parsePptx, slideXmlToText } from "@/lib/parsers/pptx";
import { chunkText, dedupeKey, mergeCards, normalizeText, targetCardCount } from "@/server/ai/chunk";

const slide = (...paras: string[][]) =>
  `<p:sld><p:cSld><p:spTree>${paras
    .map((runs) => `<a:p>${runs.map((r) => `<a:r><a:rPr lang="en"/><a:t>${r}</a:t></a:r>`).join("")}</a:p>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

describe("pptx parser", () => {
  it("joins runs per paragraph and decodes entities", () => {
    expect(slideXmlToText(slide(["Photo", "synthesis"], ["CO&lt;sub&gt;2 &amp; H&#50;O"]))).toBe(
      "Photosynthesis\nCO<sub>2 & H2O",
    );
  });

  it("reads slides in numeric order with speaker notes", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide10.xml", slide(["Ten"]));
    zip.file("ppt/slides/slide2.xml", slide(["Two"]));
    zip.file("ppt/slides/slide1.xml", slide(["One"], ["Intro"]));
    zip.file("ppt/notesSlides/notesSlide1.xml", slide(["Say hello"], ["1"]));
    zip.file("ppt/slides/_rels/slide1.xml.rels", "<Relationships/>");
    const data = await zip.generateAsync({ type: "uint8array" });

    const result = await parsePptx(data);
    expect(result.slides).toBe(3);
    expect(result.text).toBe(
      "--- Slide 1 ---\nOne\nIntro\nNotes: Say hello\n\n--- Slide 2 ---\nTwo\n\n--- Slide 10 ---\nTen",
    );
  });
});

describe("pdf text items", () => {
  it("builds lines from pdf.js items", () => {
    expect(
      itemsToText([{ str: "Chapter", hasEOL: false }, { str: "1", hasEOL: true }, { str: "Cells  are", hasEOL: false }, { str: "small" }]),
    ).toBe("Chapter 1\nCells are small");
  });
});

describe("image sizing", () => {
  it("fits the longest side within the max, never upscales", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("chunking and merging", () => {
  it("normalizes whitespace so equal notes hash equally", () => {
    expect(normalizeText("a \t b\r\n\r\n\r\n\nc  ")).toBe("a b\n\nc");
  });

  it("splits long text at paragraph boundaries under the size", () => {
    const para = "x".repeat(700);
    const text = Array.from({ length: 10 }, () => para).join("\n\n");
    const chunks = chunkText(text, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2000);
    expect(chunks.join("").replace(/\s/g, "").length).toBe(7000);
  });

  it("hard-splits text with no boundaries", () => {
    const chunks = chunkText("y".repeat(5000), 2000);
    expect(chunks.map((c) => c.length)).toEqual([2000, 2000, 1000]);
  });

  it("targets 10–150 cards by length (about one per 200 characters)", () => {
    expect(targetCardCount(100)).toBe(10);
    expect(targetCardCount(7000)).toBe(35);
    expect(targetCardCount(20000)).toBe(100);
    expect(targetCardCount(60000)).toBe(150);
  });

  it("merges chunk cards, dropping near-duplicate terms", () => {
    const merged = mergeCards(
      [
        [
          { term: "The Cell", definition: "a" },
          { term: "Nucleus", definition: "b" },
        ],
        [
          { term: "cell", definition: "dup" },
          { term: "Ribosome", definition: "c" },
        ],
      ],
      60,
    );
    expect(merged.map((c) => c.term)).toEqual(["The Cell", "Nucleus", "Ribosome"]);
    expect(dedupeKey("Ang Mga Bayani!")).toBe("bayani");
  });
});
