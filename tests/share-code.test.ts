import { describe, expect, it } from "vitest";
import { parseShareCode } from "@/lib/share-code";

describe("parseShareCode", () => {
  it("accepts a bare code, with stray spaces", () => {
    expect(parseShareCode("  AbC123xyz9 ")).toBe("AbC123xyz9");
  });

  it("accepts a full share link", () => {
    expect(parseShareCode("https://kodigo-ai-study-buddy.vercel.app/s/AbC123xyz9")).toBe("AbC123xyz9");
    expect(parseShareCode("kodigo-ai-study-buddy.vercel.app/s/AbC123xyz9?x=1")).toBe("AbC123xyz9");
  });

  it("rejects anything that is not a code", () => {
    for (const bad of ["", "short", "AbC123xyz9!", "AbC123xyz99", "https://example.com/u/someone", "../../etc"]) {
      expect(parseShareCode(bad)).toBeNull();
    }
  });
});
