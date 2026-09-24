// Copies the pdf.js worker into /public so it is served same-origin (CSP: worker-src 'self').
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const dest = join(root, "public/pdf.worker.min.mjs");

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
