import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { replaceCards } from "@/server/db/queries/cards";
import {
  approveSet,
  banUser,
  createReport,
  isEmailBanned,
  listModerationQueue,
  markStrikesSeen,
  takeDownSet,
  unbanUser,
  unseenStrike,
} from "@/server/db/queries/moderation";
import { getOrCreateProfile, setHandle } from "@/server/db/queries/profiles";
import { createSet } from "@/server/db/queries/sets";
import { getPublicSetBySlug, getShareState } from "@/server/db/queries/sharing";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { shareSet } from "@/server/sharing/share";
import { createTestDb } from "./helpers/db";

const OWNER = "owner";
const allow = vi.fn(async () => ({ verdict: "allow" as const, categories: [], reason: null }));

async function sharedSet(title = "Rocks") {
  await getOrCreateProfile(OWNER);
  await setHandle(OWNER, "owner");
  const setId = await createSet(OWNER, { title, sourceType: "text", sourceText: "", outputLang: "en" });
  await replaceCards(OWNER, setId, [{ term: "t", definition: "d" }]);
  const res = await shareSet({ userId: OWNER, profile: { handle: "owner", shareBlockedUntil: null, bannedAt: null }, setId, visibility: "public", screen: allow });
  return { setId, slug: res.ok ? res.data.slug! : "" };
}

const profileOf = async (id: string) => (await getDb().select().from(profiles).where(eq(profiles.userId, id)))[0]!;

describe("reports", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("one report per user, owner can't report, 3 reports hide the set", async () => {
    const { setId, slug } = await sharedSet();
    expect(await createReport(OWNER, setId, "spam", null)).toBe("own_set");
    expect(await createReport("r1", setId, "spam", null)).toBe("ok");
    expect(await createReport("r1", setId, "spam", null)).toBe("duplicate");
    await createReport("r2", setId, "inappropriate", "rude words");
    expect(await getPublicSetBySlug(slug)).not.toBeNull();
    await createReport("r3", setId, "other", null);
    expect(await getPublicSetBySlug(slug)).toBeNull();
    const queue = await listModerationQueue();
    expect(queue[0]).toMatchObject({ setId, status: "review", reportCount: 3 });
    expect(queue[0]!.reports).toHaveLength(3);
  });

  it("approve clears reports and makes it visible again", async () => {
    const { setId, slug } = await sharedSet();
    for (const r of ["r1", "r2", "r3"]) await createReport(r, setId, "spam", null);
    await approveSet(setId);
    expect(await getPublicSetBySlug(slug)).not.toBeNull();
    expect(await listModerationQueue()).toEqual([]);
  });

  it("can't report private or unknown sets", async () => {
    await getOrCreateProfile(OWNER);
    const priv = await createSet(OWNER, { title: "P", sourceType: "text", sourceText: "", outputLang: "en" });
    expect(await createReport("r1", priv, "spam", null)).toBe("not_found");
  });
});

describe("strikes and bans", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("1 = warning, 2 = sharing blocked 30 days, 3 = banned", async () => {
    const now = Date.now();
    const s1 = await sharedSet("one");
    expect(await takeDownSet(s1.setId, "admin", "hate", { ban: false, emailHash: null })).toEqual({ strikes: 1, banned: false });
    expect(await getShareState(OWNER, s1.setId)).toMatchObject({ visibility: "private", moderationStatus: "taken_down" });
    expect(await unseenStrike(OWNER)).toEqual({ setTitle: "one", reason: "hate" });
    await markStrikesSeen(OWNER);
    expect(await unseenStrike(OWNER)).toBeNull();

    const s2 = await sharedSet("two");
    await takeDownSet(s2.setId, "admin", "spam", { ban: false, emailHash: null });
    const p2 = await profileOf(OWNER);
    expect(p2.shareBlockedUntil!.getTime()).toBeGreaterThan(now + 29 * 24 * 3600 * 1000);

    const s3 = await createSet(OWNER, { title: "three", sourceType: "text", sourceText: "", outputLang: "en" });
    await replaceCards(OWNER, s3, [{ term: "t", definition: "d" }]);
    await getDb().update(profiles).set({ shareBlockedUntil: null }).where(eq(profiles.userId, OWNER));
    await shareSet({ userId: OWNER, profile: { handle: "owner", shareBlockedUntil: null, bannedAt: null }, setId: s3, visibility: "public", screen: allow });
    expect(await takeDownSet(s3, "admin", "spam", { ban: false, emailHash: "hash-1" })).toEqual({ strikes: 3, banned: true });
    expect((await profileOf(OWNER)).bannedAt).not.toBeNull();
    expect(await isEmailBanned("hash-1")).toBe(true);
  });

  it("ban hides all sets; unban restores the account but not sharing", async () => {
    const { slug } = await sharedSet();
    await banUser(OWNER, "severe", "hash-2");
    expect(await getPublicSetBySlug(slug)).toBeNull();
    await unbanUser(OWNER, "hash-2");
    expect((await profileOf(OWNER)).bannedAt).toBeNull();
    expect(await isEmailBanned("hash-2")).toBe(false);
    expect(await getPublicSetBySlug(slug)).toBeNull(); // sets were made private by the ban
  });
});
