import { describe, expect, it } from "vitest";
import { splitNotes } from "@/lib/split-notes";

describe("splitNotes", () => {
  it("keeps short notes as one part", () => {
    expect(splitNotes("hello world", 100)).toEqual(["hello world"]);
  });

  it("splits at paragraph breaks and keeps every part under the limit", () => {
    const para = (n: number) => `Topic ${n}. ` + "word ".repeat(30).trim();
    const text = Array.from({ length: 10 }, (_, i) => para(i)).join("\n\n");
    const parts = splitNotes(text, 400);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(400);
      expect(p.startsWith("Topic ")).toBe(true); // never cuts a paragraph in half
    }
    expect(parts.join("\n\n")).toBe(text);
  });

  it("falls back to line, sentence, then hard cuts for long blocks", () => {
    const oneLine = "A sentence here. ".repeat(50).trim();
    const parts = splitNotes(oneLine, 200);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(200);
    expect(parts.every((p) => p.endsWith("."))).toBe(true);
    expect(splitNotes("x".repeat(250), 100).map((p) => p.length)).toEqual([100, 100, 50]);
  });
});
