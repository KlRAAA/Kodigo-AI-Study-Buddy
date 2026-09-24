import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCards, replaceCards } from "@/server/db/queries/cards";
import {
  copySet,
  exploreSets,
  followFeed,
  followUser,
  getMyRating,
  getPublicProfile,
  isFollowing,
  listFollowers,
  rateSet,
  removeFollower,
} from "@/server/db/queries/community";
import { createReport } from "@/server/db/queries/moderation";
import { deleteAllUserData, getOrCreateProfile, setHandle } from "@/server/db/queries/profiles";
import { createSet, getSet, updateSet } from "@/server/db/queries/sets";
import { getDb } from "@/server/db/client";
import { followBlocks, follows, reports, setRatings, strikes, studySets } from "@/server/db/schema";
import { shareSet } from "@/server/sharing/share";
import { eq, or } from "drizzle-orm";
import { createTestDb } from "./helpers/db";

const A = "alice-id";
const B = "bob-id";
const C = "carol-id";
const allow = vi.fn(async () => ({ verdict: "allow" as const, categories: [], reason: null }));

async function publish(owner: string, handle: string, title: string, visibility: "link" | "public" = "public") {
  await getOrCreateProfile(owner, { displayName: handle.toUpperCase() });
  await setHandle(owner, handle);
  const setId = await createSet(owner, { title, subject: "Sci", sourceType: "text", sourceText: "", outputLang: "en" });
  await replaceCards(owner, setId, [{ term: "t1", definition: "d1" }, { term: "t2", definition: "d2" }]);
  await shareSet({ userId: owner, profile: { handle, shareBlockedUntil: null, bannedAt: null }, setId, visibility, screen: allow });
  return setId;
}

describe("copy", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("makes an independent private snapshot and counts copies", async () => {
    const setId = await publish(A, "alice", "Rocks");
    await getOrCreateProfile(B);
    expect(await copySet(A, setId)).toBe("own_set");
    const copy = await copySet(B, setId);
    if (typeof copy === "string") throw new Error(copy);
    const mine = await getSet(B, copy.id);
    expect(mine).toMatchObject({ title: "Rocks", visibility: "private", copiedFromHandle: "alice", copiedFromSetId: setId });
    expect(await listCards(B, copy.id)).toHaveLength(2);
    await updateSet(A, setId, { title: "Rocks v2" });
    expect((await getSet(B, copy.id))?.title).toBe("Rocks");
    expect((await getSet(A, setId))?.copyCount).toBe(1);
  });
});

describe("ratings", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("one rating per user, not on your own set, average math, removal", async () => {
    const setId = await publish(A, "alice", "Rocks");
    expect(await rateSet(A, setId, 5)).toBe("own_set");
    expect(await rateSet(B, setId, 4)).toBe("ok");
    expect(await rateSet(B, setId, 2)).toBe("ok"); // changed, not added
    expect(await rateSet(C, setId, 5)).toBe("ok");
    expect(await getMyRating(B, setId)).toBe(2);
    let s = await getSet(A, setId);
    expect(s?.ratingCount).toBe(2);
    expect(s?.ratingAvg).toBeCloseTo(3.5);
    await rateSet(C, setId, null);
    s = await getSet(A, setId);
    expect(s?.ratingCount).toBe(1);
    expect(s?.ratingAvg).toBeCloseTo(2);
  });

  it("rejects out-of-range stars and private sets", async () => {
    await getOrCreateProfile(A);
    const priv = await createSet(A, { title: "P", sourceType: "text", sourceText: "", outputLang: "en" });
    expect(await rateSet(B, priv, 3)).toBe("not_found");
    const setId = await publish(A, "alice", "Rocks");
    await expect(rateSet(B, setId, 6)).rejects.toThrow();
  });
});

describe("follows, profiles, explore, feed", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("follow rules and removed followers can't re-follow", async () => {
    await publish(A, "alice", "Rocks");
    await getOrCreateProfile(B);
    expect(await followUser(A, A)).toBe("self");
    expect(await followUser(B, A)).toBe("ok");
    expect(await isFollowing(B, A)).toBe(true);
    expect((await listFollowers(A)).map((f) => f.userId)).toEqual([B]);
    await removeFollower(A, B);
    expect(await isFollowing(B, A)).toBe(false);
    expect(await followUser(B, A)).toBe("blocked");
  });

  it("profile shows listed sets only, counts and a rating average once 3+ ratings", async () => {
    const pub = await publish(A, "alice", "Public set");
    await publish(A, "alice", "Link set", "link");
    await followUser(B, A);
    let p = await getPublicProfile("alice");
    expect(p?.sets.map((s) => s.title)).toEqual(["Public set"]);
    expect(p).toMatchObject({ followers: 1, following: 0, ratingAvg: null });
    await rateSet(B, pub, 4);
    await rateSet(C, pub, 5);
    await rateSet("dave", pub, 3);
    p = await getPublicProfile("alice");
    expect(p?.ratingAvg).toBeCloseTo(4);
    expect(p?.ratingTotal).toBe(3);
    expect(await getPublicProfile("nobody")).toBeNull();
  });

  it("explore searches listed sets and sorts; feed shows followed creators", async () => {
    const rocks = await publish(A, "alice", "Rocks");
    await publish(C, "carol", "Cells");
    await publish(C, "carol", "Hidden link", "link");
    await rateSet(B, rocks, 5);
    expect((await exploreSets({ sort: "new", page: 1 })).map((s) => s.title).sort()).toEqual(["Cells", "Rocks"]);
    expect((await exploreSets({ query: "cel", sort: "new", page: 1 })).map((s) => s.title)).toEqual(["Cells"]);
    await followUser(B, C);
    expect((await followFeed(B)).map((s) => s.title)).toEqual(["Cells"]);
  });

  it("clamps non-finite or non-integer pages instead of throwing", async () => {
    await publish(A, "alice", "Rocks");
    await publish(C, "carol", "Cells");
    const valid = await exploreSets({ sort: "new", page: 1 });
    await expect(exploreSets({ sort: "new", page: Infinity })).resolves.toEqual(valid);
    await expect(exploreSets({ sort: "new", page: 2.5 })).resolves.toBeDefined();
  });
});

describe("account deletion", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("removes the user's community rows and fixes counts on other people's sets", async () => {
    const setId = await publish(A, "alice", "Cells");
    await getOrCreateProfile(B);
    await getOrCreateProfile(C);
    await rateSet(B, setId, 5);
    await rateSet(C, setId, 3);
    await createReport(B, setId, "spam", null);
    await createReport(C, setId, "other", null);
    await followUser(B, A);
    await followUser(A, B);
    await removeFollower(A, B);
    await removeFollower(B, A);
    await getDb().insert(strikes).values({ userId: B, reason: "spam", adminId: "admin" });

    await deleteAllUserData(B);

    const [set] = await getDb().select().from(studySets).where(eq(studySets.id, setId));
    expect(set).toMatchObject({ ratingCount: 1, ratingAvg: 3, reportCount: 1 });
    const db = getDb();
    expect(await db.select().from(setRatings).where(eq(setRatings.userId, B))).toEqual([]);
    expect(await db.select().from(reports).where(eq(reports.reporterId, B))).toEqual([]);
    expect(await db.select().from(follows).where(or(eq(follows.followerId, B), eq(follows.followeeId, B)))).toEqual([]);
    expect(await db.select().from(followBlocks).where(or(eq(followBlocks.userId, B), eq(followBlocks.blockedId, B)))).toEqual([]);
    expect(await db.select().from(strikes).where(eq(strikes.userId, B))).toEqual([]);
  });
});
