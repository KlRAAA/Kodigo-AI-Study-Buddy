import { nextUtcMidnight } from "@/lib/day";

/** A failed provider call, normalized across SDK/network errors. */
export class ProviderError extends Error {
  constructor(
    readonly kind: "rate_limit" | "server" | "timeout" | "network" | "client" | "empty" | "invalid",
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
    readonly dailyQuota = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Thrown when every model failed or is benched. The UI shows "Kodigo is resting". */
export class AllModelsFailedError extends Error {
  constructor() {
    super("ai_unavailable");
    this.name = "AllModelsFailedError";
  }
}

const DEFAULT_BENCH_MS = 10 * 60 * 1000;

/** How long to bench a model after a 429. */
export function benchUntil(err: ProviderError, now = new Date()): Date {
  if (err.dailyQuota) return nextUtcMidnight(now);
  if (err.retryAfterMs && err.retryAfterMs > 0) return new Date(now.getTime() + err.retryAfterMs);
  return new Date(now.getTime() + DEFAULT_BENCH_MS);
}

/** Parses Retry-After (seconds or HTTP date) and common x-ratelimit-reset headers. */
export function parseRetryAfter(headers: Headers | undefined, now = new Date()): number | undefined {
  if (!headers) return undefined;
  const ra = headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return secs * 1000;
    const date = Date.parse(ra);
    if (!Number.isNaN(date)) return Math.max(0, date - now.getTime());
  }
  // Groq style: "2m59.56s" / "7.66s"
  const reset = headers.get("x-ratelimit-reset-requests") ?? headers.get("x-ratelimit-reset-tokens");
  if (reset) {
    const m = reset.match(/(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/);
    if (m && (m[1] || m[2] || m[3])) {
      return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
    }
  }
  return undefined;
}

/** Heuristic: the provider says the *daily* quota is gone rather than a per-minute burst. */
export function looksLikeDailyQuota(message: string) {
  return /per[\s_-]?day|daily|RPD|requests? per day|quota.*exceeded.*day|free-models-per-day/i.test(message);
}
