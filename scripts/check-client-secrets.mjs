// Fails if anything that looks like a server secret ends up in the client bundle.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = ".next/static";
const patterns = [
  /AIza[0-9A-Za-z_-]{20,}/, // Google API key
  /gsk_[0-9A-Za-z]{20,}/, // Groq
  /sk-or-[0-9A-Za-z-]{20,}/, // OpenRouter
  /postgres(ql)?:\/\/[^"'\s]+/, // DB URLs
  /TURNSTILE_SECRET_KEY/,
  /NEON_AUTH_COOKIE_SECRET/,
  /GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY/,
];

function* walk(path) {
  for (const name of readdirSync(path)) {
    const full = join(path, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

let found = 0;
for (const file of walk(dir)) {
  const text = readFileSync(file, "utf8");
  for (const re of patterns) {
    if (re.test(text)) {
      console.error(`Possible secret (${re}) in ${file}`);
      found++;
    }
  }
}
if (found) process.exit(1);
console.log("No secrets found in client bundle.");
