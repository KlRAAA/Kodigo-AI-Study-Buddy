import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../client";
import { globalUsage, rateEvents, signupThrottle, usageCounters, type UsageKind } from "../schema";
import { manilaDay } from "@/lib/day";

/**
 * Atomically adds 1 to today's counter if it is still under `limit`.
 * Returns the new count, or null when the limit is already reached.
 */
export async function consumeDaily(
  userId: string,
  kind: UsageKind,
  limit: number,
  now = new Date(),
): Promise<number | null> {
  const day = manilaDay(now);
  const rows = await getDb()
    .insert(usageCounters)
    .values({ userId, day, kind, count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.day, usageCounters.kind],
      set: { count: sql`${usageCounters.count} + 1` },
      setWhere: lt(usageCounters.count, limit),
    })
    .returning({ count: usageCounters.count });
  const count = rows[0]?.count;
  return count !== undefined && count <= limit ? count : null;
}

/** Gives back one unit, e.g. when every AI model failed. */
export async function refundDaily(userId: string, kind: UsageKind, now = new Date()) {
  await getDb()
    .update(usageCounters)
    .set({ count: sql`greatest(${usageCounters.count} - 1, 0)` })
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.day, manilaDay(now)),
        eq(usageCounters.kind, kind),
      ),
    );
}

export async function getDailyUsage(userId: string, now = new Date()) {
  const rows = await getDb()
    .select({ kind: usageCounters.kind, count: usageCounters.count })
    .from(usageCounters)
    .where(and(eq(usageCounters.userId, userId), eq(usageCounters.day, manilaDay(now))));
  const used: Record<UsageKind, number> = { generation: 0, tutor: 0, assist: 0 };
  for (const r of rows) used[r.kind] = r.count;
  return used;
}

/**
 * Sliding one-minute window. Records the request and returns true if the user
 * made fewer than `limit` requests in the last 60 seconds.
 */
export async function consumeRate(userId: string, limit: number, now = new Date()) {
  const db = getDb();
  const windowStart = new Date(now.getTime() - 60_000);
  // Housekeeping: old events are useless.
  await db.delete(rateEvents).where(and(eq(rateEvents.userId, userId), lt(rateEvents.at, windowStart)));
  const inserted = await db.execute<{ id: string }>(sql`
    insert into ${rateEvents} (user_id, at)
    select ${userId}, ${now.toISOString()}::timestamptz
    where (
      select count(*) from ${rateEvents}
      where ${rateEvents.userId} = ${userId} and ${rateEvents.at} > ${windowStart.toISOString()}::timestamptz
    ) < ${limit}
    returning id
  `);
  return rowCount(inserted) > 0;
}

/** Global AI calls today. Returns the new total, or null once `cap` is reached. */
export async function consumeGlobal(cap: number, now = new Date()): Promise<number | null> {
  const day = manilaDay(now);
  const rows = await getDb()
    .insert(globalUsage)
    .values({ day, aiCalls: 1 })
    .onConflictDoUpdate({
      target: globalUsage.day,
      set: { aiCalls: sql`${globalUsage.aiCalls} + 1` },
      setWhere: lt(globalUsage.aiCalls, cap),
    })
    .returning({ aiCalls: globalUsage.aiCalls });
  const total = rows[0]?.aiCalls;
  return total !== undefined && total <= cap ? total : null;
}

export async function getGlobalUsage(now = new Date()) {
  const rows = await getDb()
    .select({ aiCalls: globalUsage.aiCalls })
    .from(globalUsage)
    .where(eq(globalUsage.day, manilaDay(now)));
  return rows[0]?.aiCalls ?? 0;
}

/** Per-IP sign-up throttle in fixed one-hour windows. */
export async function consumeSignup(ipHash: string, limit: number, now = new Date()) {
  const windowStart = new Date(now);
  windowStart.setUTCMinutes(0, 0, 0);
  const db = getDb();
  await db
    .delete(signupThrottle)
    .where(and(eq(signupThrottle.ipHash, ipHash), lt(signupThrottle.windowStart, windowStart)));
  const rows = await db
    .insert(signupThrottle)
    .values({ ipHash, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [signupThrottle.ipHash, signupThrottle.windowStart],
      set: { count: sql`${signupThrottle.count} + 1` },
      setWhere: lt(signupThrottle.count, limit),
    })
    .returning({ count: signupThrottle.count });
  return rows.length > 0;
}

export async function resetUserCounters(userId: string, now = new Date()) {
  const db = getDb();
  await db
    .delete(usageCounters)
    .where(and(eq(usageCounters.userId, userId), eq(usageCounters.day, manilaDay(now))));
  await db.delete(rateEvents).where(eq(rateEvents.userId, userId));
}

// neon-http returns { rows }, PGlite returns { rows, affectedRows }.
function rowCount(result: unknown): number {
  const r = result as { rows?: unknown[] };
  return Array.isArray(r.rows) ? r.rows.length : Array.isArray(result) ? result.length : 0;
}
