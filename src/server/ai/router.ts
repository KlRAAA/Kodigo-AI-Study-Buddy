import type { ZodType } from "zod";
import type { ModelTarget } from "./chain";
import { AllModelsFailedError, ProviderError, benchUntil } from "./errors";
import { extractJson } from "./json";
import type { ChatMessage, CompleteFn } from "./providers";

export type AiLogEntry = {
  userId?: string | null;
  provider: string;
  model: string;
  task: string;
  status: string;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

export type RouterDeps = {
  complete: CompleteFn;
  getBenched: () => Promise<Set<string>>;
  bench: (modelId: string, until: Date, reason: string) => Promise<void>;
  log: (entry: AiLogEntry) => Promise<void>;
  now?: () => Date;
};

export type RunChainOptions<T> = {
  task: string;
  chain: ModelTarget[];
  messages: ChatMessage[];
  /** When set, the reply must be JSON that passes this schema. */
  schema?: ZodType<T>;
  userId?: string | null;
  timeoutMs?: number;
  maxTokens?: number;
};

export type RunChainResult<T> = { data: T; model: string };

const JSON_NUDGE =
  "Your previous reply was not valid JSON in the required format. Reply again with ONLY the JSON object, no extra text.";

const TIMEOUT_BENCH_MS = 5 * 60 * 1000;

/**
 * Walks the model chain until one model returns a usable answer.
 * Falls back on 429, 5xx, timeouts, network errors, empty replies and output
 * that fails validation (after one retry with a "JSON only" nudge).
 */
export async function runChain<T = string>(
  opts: RunChainOptions<T>,
  deps: RouterDeps,
): Promise<RunChainResult<T>> {
  const now = deps.now ?? (() => new Date());
  const timeoutMs = opts.timeoutMs ?? 25_000;
  let benched: Set<string>;
  try {
    benched = await deps.getBenched();
  } catch {
    benched = new Set();
  }

  for (const target of opts.chain) {
    if (benched.has(target.id)) continue;

    let messages = opts.messages;
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      const logBase = { userId: opts.userId ?? null, provider: target.provider, model: target.model, task: opts.task };
      try {
        const res = await deps.complete(target, { messages, timeoutMs, maxTokens: opts.maxTokens });
        const latencyMs = Date.now() - started;
        const tokens = { promptTokens: res.promptTokens ?? null, completionTokens: res.completionTokens ?? null };

        if (!opts.schema) {
          await safeLog(deps, { ...logBase, status: "ok", latencyMs, ...tokens });
          return { data: res.text.trim() as T, model: target.id };
        }

        const parsed = parseWith(opts.schema, res.text);
        if (parsed.ok) {
          await safeLog(deps, { ...logBase, status: "ok", latencyMs, ...tokens });
          return { data: parsed.data, model: target.id };
        }

        await safeLog(deps, { ...logBase, status: "invalid_output", latencyMs, ...tokens });
        if (attempt === 0) {
          messages = [
            ...opts.messages,
            { role: "assistant", content: res.text.slice(0, 4000) },
            { role: "user", content: JSON_NUDGE },
          ];
          continue; // retry once on the same model
        }
        break; // second invalid reply: next model
      } catch (err) {
        const e = err instanceof ProviderError ? err : new ProviderError("network", "unknown error");
        await safeLog(deps, { ...logBase, status: e.kind, latencyMs: Date.now() - started });
        if (e.kind === "rate_limit") {
          await deps.bench(target.id, benchUntil(e, now()), e.dailyQuota ? "daily_quota" : "rate_limit").catch(() => {});
        } else if (e.kind === "client" && (e.status === 401 || e.status === 403 || e.status === 404)) {
          // Bad key or the model disappeared: stop hammering it for a while.
          await deps.bench(target.id, benchUntil(e, now()), `http_${e.status}`).catch(() => {});
        } else if (e.kind === "timeout") {
          // A slow model makes every user wait the full timeout; skip it for a bit.
          await deps.bench(target.id, new Date(now().getTime() + TIMEOUT_BENCH_MS), "timeout").catch(() => {});
        }
        break; // any provider error: next model
      }
    }
  }

  throw new AllModelsFailedError();
}

function parseWith<T>(schema: ZodType<T>, text: string): { ok: true; data: T } | { ok: false } {
  try {
    const result = schema.safeParse(extractJson(text));
    return result.success ? { ok: true, data: result.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function safeLog(deps: RouterDeps, entry: AiLogEntry) {
  try {
    await deps.log(entry);
  } catch {
    // Logging must never break a request.
  }
}
