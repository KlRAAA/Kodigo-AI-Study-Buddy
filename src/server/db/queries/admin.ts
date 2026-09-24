import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { profiles, usageCounters } from "../schema";
import { manilaDay } from "@/lib/day";

export type AdminUserRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  isSuspended: boolean;
  generation: number;
  tutor: number;
  assist: number;
  total: number;
};

/** Today's usage per user, heaviest users first. Admin-only (checked by the caller). */
export async function usageToday(now = new Date(), limit = 100): Promise<AdminUserRow[]> {
  const day = manilaDay(now);
  const rows = await getDb()
    .select({
      userId: profiles.userId,
      displayName: profiles.displayName,
      isSuspended: profiles.isSuspended,
      generation: sql<number>`coalesce(sum(${usageCounters.count}) filter (where ${usageCounters.kind} = 'generation'), 0)::int`,
      tutor: sql<number>`coalesce(sum(${usageCounters.count}) filter (where ${usageCounters.kind} = 'tutor'), 0)::int`,
      assist: sql<number>`coalesce(sum(${usageCounters.count}) filter (where ${usageCounters.kind} = 'assist'), 0)::int`,
      total: sql<number>`coalesce(sum(${usageCounters.count}), 0)::int`,
    })
    .from(profiles)
    .leftJoin(usageCounters, sql`${usageCounters.userId} = ${profiles.userId} and ${usageCounters.day} = ${day}`)
    .groupBy(profiles.userId)
    .orderBy(desc(sql`coalesce(sum(${usageCounters.count}), 0)`), desc(profiles.createdAt))
    .limit(limit);

  const emails = await emailsFor(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, email: emails.get(r.userId) ?? null }));
}

export async function setSuspended(userId: string, suspended: boolean) {
  await getDb().update(profiles).set({ isSuspended: suspended }).where(eq(profiles.userId, userId));
}

export async function emailForUser(userId: string): Promise<string | null> {
  return (await emailsFor([userId])).get(userId) ?? null;
}

/** Emails live in Neon Auth's own schema. If it's unavailable we just show ids. */
async function emailsFor(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  try {
    const result = await getDb().execute<{ id: string; email: string }>(
      sql`select id::text as id, email from neon_auth."user" where id::text in ${userIds}`,
    );
    const rows = (result as unknown as { rows: { id: string; email: string }[] }).rows ?? [];
    for (const r of rows) map.set(r.id, r.email);
  } catch {
    // neon_auth schema not reachable (e.g. local tests)
  }
  return map;
}
