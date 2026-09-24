import "server-only";
import { AllModelsFailedError, cacheKey, callAI, readCache, writeCache } from "../ai";
import { moderationMessages } from "../ai/prompts";
import { moderationSchema } from "../ai/schemas";
import { contentHash, type ShareContent } from "./content";
import { checkLinks } from "./safe-browsing";
import { screenContent, ScreeningUnavailableError, type ScreenResult } from "./screen";

const resultSchema = moderationSchema;

/** Screens a set for sharing. Cached by content hash. Throws ScreeningUnavailableError. */
export async function screenSet(content: ShareContent): Promise<ScreenResult> {
  const key = cacheKey("moderation:v1", "any", contentHash(content));
  const cached = await readCache(key, resultSchema);
  if (cached) return cached;

  const result = await screenContent(content, {
    checkLinks,
    moderateText: async (text) => {
      try {
        return await callAI({ task: "moderation", schema: moderationSchema, messages: moderationMessages(text) });
      } catch (err) {
        if (err instanceof AllModelsFailedError) throw new ScreeningUnavailableError();
        throw err;
      }
    },
  });
  await writeCache(key, "moderation", "any", result);
  return result;
}

export { ScreeningUnavailableError } from "./screen";
export type { ScreenResult } from "./screen";
export { contentHash, type ShareContent } from "./content";
