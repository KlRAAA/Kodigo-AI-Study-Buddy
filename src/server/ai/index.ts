import "server-only";
import { createHash } from "node:crypto";
import type { ZodType } from "zod";
import { benchModel, getBenchedModels, getCached, logAiCall, putCached } from "../db/queries/ai";
import { consumeGlobal } from "../db/queries/usage";
import { readLimits } from "../limits/config";
import { parseChain } from "./chain";
import { AllModelsFailedError } from "./errors";
import { complete, type ChatMessage } from "./providers";
import { runChain, type RouterDeps } from "./router";

export { AllModelsFailedError } from "./errors";

const deps: RouterDeps = {
  complete,
  getBenched: () => getBenchedModels(),
  bench: (id, until, reason) => benchModel(id, until, reason),
  log: (e) => logAiCall(e),
};

export type CallAIOptions<T> = {
  task: string;
  messages: ChatMessage[];
  needsVision?: boolean;
  schema?: ZodType<T>;
  userId?: string | null;
  maxTokens?: number;
};

/** Runs one AI call through the fallback chain. Counts against the global daily budget. */
export async function callAI<T>(opts: CallAIOptions<T>): Promise<T> {
  const chain = parseChain(opts.needsVision ? process.env.AI_VISION_CHAIN : process.env.AI_TEXT_CHAIN);
  if (chain.length === 0) throw new AllModelsFailedError();

  const limits = readLimits();
  const cap = Math.floor(limits.globalDailyBudget * limits.globalCutoff);
  if ((await consumeGlobal(cap)) === null) throw new AllModelsFailedError();

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 25_000;
  const { data } = await runChain<T>({ ...opts, chain, timeoutMs }, deps);
  return data;
}

export function cacheKey(task: string, lang: string, input: string) {
  return createHash("sha256").update(`${task}\u0000${lang}\u0000${input}`).digest("hex");
}

export async function readCache<T>(key: string, schema: ZodType<T>): Promise<T | null> {
  const hit = await getCached(key);
  if (hit === null) return null;
  const parsed = schema.safeParse(hit);
  return parsed.success ? parsed.data : null;
}

export async function writeCache(key: string, task: string, lang: string, value: unknown) {
  await putCached(key, task, lang, value).catch(() => {});
}
