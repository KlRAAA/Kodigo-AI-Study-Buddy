import { describe, expect, it, vi } from "vitest";
import { contentHash, contentText, extractUrls, type ShareContent } from "@/server/moderation/content";
import { ScreeningUnavailableError, screenContent, type ScreenDeps } from "@/server/moderation/screen";

const content: ShareContent = {
  title: "Rocks",
  subject: "Science",
  summary: "## Rocks\nSee https://example.com/rocks and www.test.org/page.",
  cards: [{ term: "Igneous", definition: "Cooled magma", example: null }],
};

function deps(over: Partial<ScreenDeps> = {}) {
  return {
    checkLinks: vi.fn(async () => [] as string[]),
    moderateText: vi.fn(async () => ({ verdict: "allow" as const, categories: [], reason: null })),
    ...over,
  };
}

describe("content helpers", () => {
  it("includes every field in the screened text and hashes stably", () => {
    const text = contentText(content);
    for (const part of ["Rocks", "Science", "Igneous", "Cooled magma"]) expect(text).toContain(part);
    expect(contentHash(content)).toBe(contentHash({ ...content }));
    expect(contentHash(content)).not.toBe(contentHash({ ...content, title: "Rocks 2" }));
  });

  it("extracts http(s) and www links, deduplicated", () => {
    expect(extractUrls("a https://x.com/a, b http://x.com/a. c www.y.org d https://x.com/a")).toEqual([
      "https://x.com/a",
      "http://x.com/a",
      "http://www.y.org",
    ]);
  });
});

describe("screenContent", () => {
  it("allows clean content", async () => {
    const d = deps();
    expect(await screenContent(content, d)).toEqual({ verdict: "allow", categories: [], reason: null });
    expect(d.checkLinks).toHaveBeenCalledWith(["https://example.com/rocks", "http://www.test.org/page"]);
  });

  it("blocks harmful links without calling the AI", async () => {
    const d = deps({ checkLinks: vi.fn(async () => ["https://example.com/rocks"]) });
    const r = await screenContent(content, d);
    expect(r.verdict).toBe("block");
    expect(r.categories).toEqual(["harmful_link"]);
    expect(d.moderateText).not.toHaveBeenCalled();
  });

  it("the worst verdict across chunks wins", async () => {
    const long = { ...content, summary: "x ".repeat(8000) };
    const verdicts = [
      { verdict: "allow" as const, categories: [], reason: null },
      { verdict: "review" as const, categories: ["personal_info"], reason: "has a phone number" },
    ];
    const d = deps({ moderateText: vi.fn(async () => verdicts.shift() ?? verdicts[0]!) });
    const r = await screenContent(long, d);
    expect(r).toEqual({ verdict: "review", categories: ["personal_info"], reason: "has a phone number" });
  });

  it("propagates unavailability", async () => {
    const d = deps({ checkLinks: vi.fn(async () => { throw new ScreeningUnavailableError(); }) });
    await expect(screenContent(content, d)).rejects.toBeInstanceOf(ScreeningUnavailableError);
  });
});
