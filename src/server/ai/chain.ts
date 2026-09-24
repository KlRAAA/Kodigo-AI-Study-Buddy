export const PROVIDERS = ["gemini", "groq", "openrouter"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type ModelTarget = { provider: Provider; model: string; id: string };

/**
 * Parses "gemini:gemini-x,groq:openai/gpt-oss-120b,openrouter:vendor/model:free".
 * Only the first ":" separates provider from model, so OpenRouter's ":free" suffix survives.
 * Unknown providers and blanks are skipped.
 */
export function parseChain(raw: string | undefined): ModelTarget[] {
  if (!raw) return [];
  const out: ModelTarget[] = [];
  for (const part of raw.split(",")) {
    const entry = part.trim();
    const idx = entry.indexOf(":");
    if (idx <= 0) continue;
    const provider = entry.slice(0, idx) as Provider;
    const model = entry.slice(idx + 1).trim();
    if (!PROVIDERS.includes(provider) || !model || model.includes("<")) continue;
    out.push({ provider, model, id: `${provider}:${model}` });
  }
  return out;
}
