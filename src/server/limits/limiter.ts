import "server-only";
import { consumeDaily, consumeRate, getDailyUsage, getGlobalUsage } from "../db/queries/usage";
import type { UsageKind } from "../db/schema";
import { readLimits } from "./config";

export type LimitDenied = "suspended" | "rate" | "daily" | "global";
export type LimitResult = { ok: true } | { ok: false; reason: LimitDenied };

/**
 * Checks every limit before an AI action and consumes one unit of `kind`.
 * Call only after a cache miss: cached results are free.
 */
export async function acquire(userId: string, kind: UsageKind, opts: { isSuspended: boolean }): Promise<LimitResult> {
  if (opts.isSuspended) return { ok: false, reason: "suspended" };
  const limits = readLimits();

  if (await isGlobalBudgetLow()) return { ok: false, reason: "global" };
  if (!(await consumeRate(userId, limits.perMinute))) return { ok: false, reason: "rate" };
  if ((await consumeDaily(userId, kind, limits.daily[kind])) === null) return { ok: false, reason: "daily" };
  return { ok: true };
}

/** True once today's AI calls reach 90% of the global budget. */
export async function isGlobalBudgetLow() {
  const limits = readLimits();
  const used = await getGlobalUsage();
  return used >= Math.floor(limits.globalDailyBudget * limits.globalCutoff);
}

export async function remainingAllowance(userId: string) {
  const limits = readLimits();
  const used = await getDailyUsage(userId);
  return {
    generation: { used: used.generation, limit: limits.daily.generation },
    tutor: { used: used.tutor, limit: limits.daily.tutor },
    assist: { used: used.assist, limit: limits.daily.assist },
  };
}
