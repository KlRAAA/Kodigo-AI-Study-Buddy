import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import { cards, followBlocks, follows, profiles, setRatings, studySets } from "../schema";
import { listedSetWhere, viewableSetWhere } from "./sharing";

export type ListedSet = {
  slug: string;
  title: string;
  subject: string | null;
  cardCount: number;
  ratingAvg: number;
  ratingCount: number;
  copyCount: number;
  ownerHandle: string | null;
  publishedAt: Date | null;
};

const listedColumns = {
  slug: sql<string>`${studySets.shareSlug}`,
  title: studySets.title,
  subject: studySets.subject,
  cardCount: sql<number>`(select count(*)::int from ${cards} where ${cards.setId} = "study_sets"."id")`,
  ratingAvg: studySets.ratingAvg,
  ratingCount: studySets.ratingCount,
  copyCount: studySets.copyCount,
  ownerHandle: profiles.handle,
  publishedAt: studySets.publishedAt,
};

async function viewableSet(setId: string) {
  const rows = await getDb()
    .select({ id: studySets.id, ownerId: studySets.userId, title: studySets.title, subject: studySets.subject, summary: studySets.summary, ownerHandle: profiles.handle })
    .from(studySets)
    .innerJoin(profiles, eq(profiles.userId, studySets.userId))
    .where(and(eq(studySets.id, setId), viewableSetWhere()))
    .limit(1);
  return rows[0] ?? null;
}

export async function copySet(userId: string, setId: string): Promise<{ id: string } | "not_found" | "own_set"> {
  const src = await viewableSet(setId);
  if (!src) return "not_found";
  if (src.ownerId === userId) return "own_set";
  const db = getDb();
  // copy_count counts people, not copies: only a user's first copy counts.
  const earlier = await db
    .select({ id: studySets.id })
    .from(studySets)
    .where(and(eq(studySets.userId, userId), eq(studySets.copiedFromSetId, src.id)))
    .limit(1);
  const [created] = await db
    .insert(studySets)
    .values({
      userId,
      title: src.title,
      subject: src.subject,
      summary: src.summary,
      sourceType: "text",
      sourceText: "",
      status: "ready",
      copiedFromSetId: src.id,
      copiedFromHandle: src.ownerHandle,
    })
    .returning({ id: studySets.id });
  const srcCards = await db
    .select({ term: cards.term, definition: cards.definition, example: cards.example, position: cards.position })
    .from(cards)
    .where(eq(cards.setId, src.id))
    .orderBy(asc(cards.position));
  if (srcCards.length > 0) {
    await db.insert(cards).values(srcCards.map((c) => ({ ...c, setId: created!.id, userId })));
  }
  if (earlier.length === 0) {
    await db.update(studySets).set({ copyCount: sql`${studySets.copyCount} + 1` }).where(eq(studySets.id, src.id));
  }
  return { id: created!.id };
}

export async function rateSet(userId: string, setId: string, stars: number | null): Promise<"ok" | "not_found" | "own_set"> {
  if (stars !== null && !(Number.isInteger(stars) && stars >= 1 && stars <= 5)) throw new Error("stars must be 1–5");
  const set = await viewableSet(setId);
  if (!set) return "not_found";
  if (set.ownerId === userId) return "own_set";
  const db = getDb();
  if (stars === null) {
    await db.delete(setRatings).where(and(eq(setRatings.setId, setId), eq(setRatings.userId, userId)));
  } else {
    await db
      .insert(setRatings)
      .values({ setId, userId, stars })
      .onConflictDoUpdate({ target: [setRatings.setId, setRatings.userId], set: { stars, updatedAt: new Date() } });
  }
  await recomputeRating(setId);
  return "ok";
}

/** Neon HTTP has no interactive transactions: always recompute rather than increment. */
export async function recomputeRating(setId: string) {
  await getDb()
    .update(studySets)
    .set({
      ratingCount: sql`(select count(*)::int from ${setRatings} where ${setRatings.setId} = ${setId})`,
      ratingAvg: sql`coalesce((select avg(${setRatings.stars})::real from ${setRatings} where ${setRatings.setId} = ${setId}), 0)`,
    })
    .where(eq(studySets.id, setId));
}

export async function getMyRating(userId: string, setId: string): Promise<number | null> {
  const rows = await getDb()
    .select({ stars: setRatings.stars })
    .from(setRatings)
    .where(and(eq(setRatings.setId, setId), eq(setRatings.userId, userId)))
    .limit(1);
  return rows[0]?.stars ?? null;
}

export async function followUser(followerId: string, followeeId: string): Promise<"ok" | "self" | "blocked"> {
  if (followerId === followeeId) return "self";
  const db = getDb();
  const blocked = await db
    .select({ u: followBlocks.userId })
    .from(followBlocks)
    .where(and(eq(followBlocks.userId, followeeId), eq(followBlocks.blockedId, followerId)))
    .limit(1);
  if (blocked.length > 0) return "blocked";
  await db.insert(follows).values({ followerId, followeeId }).onConflictDoNothing();
  return "ok";
}

export async function unfollowUser(followerId: string, followeeId: string) {
  await getDb().delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

export async function removeFollower(userId: string, followerId: string) {
  const db = getDb();
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, userId)));
  await db.insert(followBlocks).values({ userId, blockedId: followerId }).onConflictDoNothing();
}

export async function isFollowing(followerId: string, followeeId: string) {
  const rows = await getDb()
    .select({ f: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return rows.length > 0;
}

type PersonRow = { userId: string; handle: string | null; displayName: string | null };

export async function listFollowers(userId: string): Promise<PersonRow[]> {
  return getDb()
    .select({ userId: profiles.userId, handle: profiles.handle, displayName: profiles.displayName })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, follows.followerId))
    .where(eq(follows.followeeId, userId))
    .orderBy(desc(follows.createdAt));
}

export async function listFollowing(userId: string): Promise<PersonRow[]> {
  return getDb()
    .select({ userId: profiles.userId, handle: profiles.handle, displayName: profiles.displayName })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt));
}

export type PublicProfile = {
  userId: string;
  handle: string;
  displayName: string | null;
  joined: Date;
  banned: boolean;
  followers: number;
  following: number;
  ratingAvg: number | null;
  ratingTotal: number;
  sets: ListedSet[];
};

export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const db = getDb();
  const [p] = await db.select().from(profiles).where(eq(profiles.handle, handle.toLowerCase())).limit(1);
  if (!p || !p.handle) return null;
  const count = (col: typeof follows.followerId | typeof follows.followeeId, id: string) =>
    db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(col, id));
  const [[followers], [following]] = await Promise.all([count(follows.followeeId, p.userId), count(follows.followerId, p.userId)]);
  const sets = p.bannedAt
    ? []
    : await db
        .select(listedColumns)
        .from(studySets)
        .innerJoin(profiles, eq(profiles.userId, studySets.userId))
        .where(and(eq(studySets.userId, p.userId), listedSetWhere()))
        .orderBy(desc(studySets.publishedAt));
  const ratingTotal = sets.reduce((n, s) => n + s.ratingCount, 0);
  const weighted = sets.reduce((n, s) => n + s.ratingAvg * s.ratingCount, 0);
  return {
    userId: p.userId,
    handle: p.handle,
    displayName: p.displayName,
    joined: p.createdAt,
    banned: Boolean(p.bannedAt),
    followers: followers?.n ?? 0,
    following: following?.n ?? 0,
    ratingAvg: ratingTotal >= 3 ? weighted / ratingTotal : null,
    ratingTotal,
    sets,
  };
}

const PAGE_SIZE = 20;
const MAX_PAGE = 500;

function safePage(page: number): number {
  const n = Math.floor(page);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export async function exploreSets(opts: { query?: string; sort: "top" | "new" | "copied"; page: number }): Promise<ListedSet[]> {
  const q = opts.query?.trim().slice(0, 100);
  const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
  const where = q
    ? and(listedSetWhere(), or(ilike(studySets.title, `%${esc(q)}%`), ilike(studySets.subject, `%${esc(q)}%`)))
    : listedSetWhere();
  const order =
    opts.sort === "top"
      ? [desc(sql`case when ${studySets.ratingCount} >= 3 then ${studySets.ratingAvg} else 0 end`), desc(studySets.ratingCount)]
      : opts.sort === "copied"
        ? [desc(studySets.copyCount)]
        : [desc(studySets.publishedAt)];
  return getDb()
    .select(listedColumns)
    .from(studySets)
    .innerJoin(profiles, eq(profiles.userId, studySets.userId))
    .where(where)
    .orderBy(...order, desc(studySets.publishedAt))
    .limit(PAGE_SIZE)
    .offset((safePage(opts.page) - 1) * PAGE_SIZE);
}

export async function followFeed(userId: string, limit = 10): Promise<ListedSet[]> {
  const db = getDb();
  const followed = await db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, userId));
  if (followed.length === 0) return [];
  return db
    .select(listedColumns)
    .from(studySets)
    .innerJoin(profiles, eq(profiles.userId, studySets.userId))
    .where(and(listedSetWhere(), inArray(studySets.userId, followed.map((f) => f.id))))
    .orderBy(desc(studySets.publishedAt))
    .limit(limit);
}
