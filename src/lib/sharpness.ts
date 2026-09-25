/**
 * Blur check for photos of notes. Sharp text has many strong edges, so the
 * Laplacian (edge response) varies a lot; a blurry photo is smooth and varies little.
 */

/** Below this (on a ~480px-wide grayscale copy) the photo probably looks blurry. */
export const BLUR_THRESHOLD = 50;

/** Variance of the 4-neighbour Laplacian over a grayscale image (values 0–255). */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number) {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Browser only: measures a drawn canvas on a small grayscale copy (fast on phones). */
export function looksBlurry(source: HTMLCanvasElement) {
  const width = Math.min(480, source.width);
  const height = Math.max(3, Math.round((source.height / source.width) * width));
  const small = document.createElement("canvas");
  small.width = width;
  small.height = height;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return laplacianVariance(gray, width, height) < BLUR_THRESHOLD;
}
