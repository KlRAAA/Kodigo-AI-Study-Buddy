import "server-only";
import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  bannedEmails,
  cards,
  profiles,
  reports,
  strikes,
  studySets,
  type ModerationStatus,
  type ReportReason,
} from "../schema";
import { viewableSetWhere } from "./sharing";

const AUTO_HIDE_REPORTS = 3;
const SHARE_BLOCK_MS = 30 * 24 * 60 * 60 * 1000;

export async function createReport(
  reporterId: string,
  setId: string,
  reason: ReportReason,
  note: string | null,
): Promise<"ok" | "duplicate" | "not_found" | "own_set"> {
  const db = getDb();
  const [set] = await db
    .select({ ownerId: studySets.userId })
    .from(studySets)
    .innerJoin(profiles, eq(profiles.userId, studySets.userId))
    .where(and(eq(studySets.id, setId), viewableSetWhere()))
    .limit(1);
  if (!set) return "not_found";
  if (set.ownerId === reporterId) return "own_set";
  const inserted = await db
    .insert(reports)
    .values({ setId, reporterId, reason, note })
    .onConflictDoNothing()
    .returning({ id: reports.id });
  if (inserted.length === 0) return "duplicate";

  const openCount = sql<number>`(select count(*)::int from ${reports} where ${reports.setId} = ${setId} and ${reports.status} = 'open')`;
  const [updated] = await db
    .update(studySets)
    .set({ reportCount: openCount })
    .where(eq(studySets.id, setId))
    .returning({ reportCount: studySets.reportCount });
  if ((updated?.reportCount ?? 0) >= AUTO_HIDE_REPORTS) {
    await db
      .update(studySets)
      .set({ moderationStatus: "review", moderationReason: "reports" })
      .where(and(eq(studySets.id, setId), eq(studySets.moderationStatus, "approved")));
  }
  return "ok";
}

export type QueueItem = {
  setId: string;
  title: string;
  ownerId: string;
  ownerHandle: string | null;
  status: ModerationStatus;
  reason: string | null;
  reportCount: number;
  reports: { reason: ReportReason; note: string | null }[];
  cards: { term: string; definition: string }[];
};

/** Sets waiting for an admin: flagged by screening or reported. */
export async function listModerationQueue(limit = 50): Promise<QueueItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      setId: studySets.id,
      title: studySets.title,
      ownerId: studySets.userId,
      ownerHandle: profiles.handle,
      status: studySets.moderationStatus,
      reason: studySets.moderationReason,
      reportCount: studySets.reportCount,
    })
    .from(studySets)
    .innerJoin(profiles, eq(profiles.userId, studySets.userId))
    .where(or(eq(studySets.moderationStatus, "review"), gt(studySets.reportCount, 0)))
    .orderBy(desc(studySets.reportCount), asc(studySets.updatedAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.setId);
  const reportRows = await db
    .select({ setId: reports.setId, reason: reports.reason, note: reports.note })
    .from(reports)
    .where(and(inArray(reports.setId, ids), eq(reports.status, "open")));
  const cardRows = await db
    .select({ setId: cards.setId, term: cards.term, definition: cards.definition })
    .from(cards)
    .where(inArray(cards.setId, ids))
    .orderBy(asc(cards.position));
  return rows.map((r) => ({
    ...r,
    reports: reportRows.filter((x) => x.setId === r.setId).map(({ reason, note }) => ({ reason, note })),
    cards: cardRows.filter((x) => x.setId === r.setId).map(({ term, definition }) => ({ term, definition })),
  }));
}

export async function approveSet(setId: string) {
  const db = getDb();
  await db.update(reports).set({ status: "dismissed" }).where(and(eq(reports.setId, setId), eq(reports.status, "open")));
  await db
    .update(studySets)
    .set({ moderationStatus: "approved", moderationReason: null, reportCount: 0 })
    .where(eq(studySets.id, setId));
}

/** Removes a set, gives the owner a strike and applies the strike rules. */
export async function takeDownSet(
  setId: string,
  adminId: string,
  reason: string,
  opts: { ban: boolean; emailHash: string | null },
): Promise<{ strikes: number; banned: boolean } | null> {
  const db = getDb();
  const [set] = await db
    .update(studySets)
    .set({ moderationStatus: "taken_down", visibility: "private", moderationReason: reason, reportCount: 0 })
    .where(eq(studySets.id, setId))
    .returning({ ownerId: studySets.userId, title: studySets.title });
  if (!set) return null;
  await db.update(reports).set({ status: "actioned" }).where(and(eq(reports.setId, setId), eq(reports.status, "open")));
  await db.insert(strikes).values({ userId: set.ownerId, setId, setTitle: set.title, reason, adminId });
  const [p] = await db
    .update(profiles)
    .set({ strikes: sql`${profiles.strikes} + 1` })
    .where(eq(profiles.userId, set.ownerId))
    .returning({ strikes: profiles.strikes });
  const count = p?.strikes ?? 1;

  if (opts.ban || count >= 3) {
    await banUser(set.ownerId, reason, opts.emailHash);
    return { strikes: count, banned: true };
  }
  if (count === 2) {
    await db
      .update(profiles)
      .set({ shareBlockedUntil: new Date(Date.now() + SHARE_BLOCK_MS) })
      .where(eq(profiles.userId, set.ownerId));
  }
  return { strikes: count, banned: false };
}

export async function banUser(userId: string, reason: string, emailHash: string | null) {
  const db = getDb();
  await db.update(profiles).set({ bannedAt: new Date(), banReason: reason }).where(eq(profiles.userId, userId));
  await db.update(studySets).set({ visibility: "private" }).where(eq(studySets.userId, userId));
  if (emailHash) await db.insert(bannedEmails).values({ emailHash, reason }).onConflictDoNothing();
}

export async function unbanUser(userId: string, emailHash: string | null) {
  const db = getDb();
  await db.update(profiles).set({ bannedAt: null, banReason: null }).where(eq(profiles.userId, userId));
  if (emailHash) await db.delete(bannedEmails).where(eq(bannedEmails.emailHash, emailHash));
}

export async function getSetOwnerId(setId: string): Promise<string | null> {
  const rows = await getDb().select({ ownerId: studySets.userId }).from(studySets).where(eq(studySets.id, setId)).limit(1);
  return rows[0]?.ownerId ?? null;
}

export async function isEmailBanned(emailHash: string) {
  const rows = await getDb().select({ h: bannedEmails.emailHash }).from(bannedEmails).where(eq(bannedEmails.emailHash, emailHash)).limit(1);
  return rows.length > 0;
}

/** The newest strike the user hasn't dismissed yet (for the banner). */
export async function unseenStrike(userId: string): Promise<{ setTitle: string | null; reason: string } | null> {
  const db = getDb();
  const [p] = await db.select({ strikes: profiles.strikes, seen: profiles.strikesSeen }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!p || p.strikes <= p.seen) return null;
  const [s] = await db
    .select({ setTitle: strikes.setTitle, reason: strikes.reason })
    .from(strikes)
    .where(eq(strikes.userId, userId))
    .orderBy(desc(strikes.createdAt))
    .limit(1);
  return s ?? null;
}

export async function markStrikesSeen(userId: string) {
  await getDb().update(profiles).set({ strikesSeen: sql`${profiles.strikes}` }).where(eq(profiles.userId, userId));
}
