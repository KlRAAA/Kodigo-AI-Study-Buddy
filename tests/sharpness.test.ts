import { describe, expect, it } from "vitest";
import { BLUR_THRESHOLD, laplacianVariance } from "@/lib/sharpness";

function image(w: number, h: number, pixel: (x: number, y: number) => number) {
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = pixel(x, y);
  return gray;
}

describe("laplacianVariance", () => {
  it("is high for crisp text-like edges and low for a smooth blur", () => {
    const w = 64;
    const h = 64;
    // Thin dark strokes on white, like handwriting.
    const sharp = image(w, h, (x, y) => (x % 6 === 0 || y % 9 === 0 ? 20 : 235));
    // A gentle gradient: what text turns into when out of focus.
    const blurry = image(w, h, (x, y) => 128 + 20 * Math.sin(x / 10) * Math.cos(y / 12));
    expect(laplacianVariance(sharp, w, h)).toBeGreaterThan(BLUR_THRESHOLD);
    expect(laplacianVariance(blurry, w, h)).toBeLessThan(BLUR_THRESHOLD);
  });

  it("returns 0 for images too small to measure", () => {
    expect(laplacianVariance(new Float32Array(4), 2, 2)).toBe(0);
  });
});
