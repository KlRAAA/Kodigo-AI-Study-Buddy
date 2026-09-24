import { UPLOAD_LIMITS } from "@/server/limits/config";

/** Scales so the longest side is at most `max`. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Compresses a photo (file or camera snapshot) to a ≤1600px JPEG data URL. The browser applies EXIF orientation. */
export async function compressImage(
  file: Blob,
  max: number = UPLOAD_LIMITS.maxImageDimension,
): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.8, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= UPLOAD_LIMITS.maxImageDataUrlChars) return url;
  }
  throw new Error("too_large");
}
