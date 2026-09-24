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
import { getPublicSetBySlug, getShareState, loadShareContent } from "@/server/db/queries/sharing";
import { getDb } from "@/server/db/client";
import { profiles, studySets } from "@/server/db/schema";
import { contentHash, type ShareContent } from "@/server/moderation/content";
import type { ScreenResult } from "@/server/moderation/screen";
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

describe("sharing again after moderation", () => {
  const profile = { handle: "owner", shareBlockedUntil: null, bannedAt: null };
  const share = (setId: string, screen: (c: ShareContent) => Promise<ScreenResult> = allow) => shareSet({ userId: OWNER, profile, setId, visibility: "public", screen });

  beforeEach(async () => {
    await createTestDb();
    allow.mockClear();
  });

  it("a taken-down set can't be shared again unchanged", async () => {
    const { setId } = await sharedSet();
    await takeDownSet(setId, "admin", "hate", { ban: false, emailHash: null });
    expect(await share(setId)).toEqual({ ok: false, error: "taken_down" });
    expect(await getShareState(OWNER, setId)).toMatchObject({ visibility: "private", moderationStatus: "taken_down" });
  });

  it("an edited taken-down set goes to review, not straight to approved", async () => {
    const { setId, slug } = await sharedSet();
    await takeDownSet(setId, "admin", "hate", { ban: false, emailHash: null });
    await replaceCards(OWNER, setId, [{ term: "t2", definition: "d2" }]);
    const res = await share(setId);
    expect(res.ok && res.data.status).toBe("review");
    expect((await getShareState(OWNER, setId))?.moderationStatus).toBe("review");
    expect(await getPublicSetBySlug(slug)).toBeNull();
  });

  it("a set hidden by reports goes to review after a small edit", async () => {
    const { setId, slug } = await sharedSet();
    for (const r of ["r1", "r2", "r3"]) await createReport(r, setId, "spam", null);
    await replaceCards(OWNER, setId, [{ term: "t", definition: "d." }]);
    const res = await share(setId);
    expect(res.ok && res.data.status).toBe("review");
    expect(await getPublicSetBySlug(slug)).toBeNull();
    expect((await listModerationQueue()).map((q) => q.setId)).toContain(setId);
  });

  it("a set with an open report goes to review when its changes are published", async () => {
    const { setId } = await sharedSet();
    await createReport("r1", setId, "spam", null);
    await replaceCards(OWNER, setId, [{ term: "t", definition: "d." }]);
    const res = await share(setId);
    expect(res.ok && res.data.status).toBe("review");
  });

  it("a blocked set shared again unchanged is not screened again", async () => {
    await getOrCreateProfile(OWNER);
    await setHandle(OWNER, "owner");
    const setId = await createSet(OWNER, { title: "B", sourceType: "text", sourceText: "", outputLang: "en" });
    await replaceCards(OWNER, setId, [{ term: "t", definition: "d" }]);
    const block = vi.fn(async () => ({ verdict: "block" as const, categories: ["hate", "spam"], reason: "x" }));
    await share(setId, block);
    const again = await share(setId, block);
    expect(again).toEqual({ ok: true, data: { status: "blocked", categories: ["hate", "spam"] } });
    expect(block).toHaveBeenCalledTimes(1);
  });
});

describe("admin approve and the queue", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("approve is refused for stale and blocked sets", async () => {
    const { setId } = await sharedSet();
    await createReport("r1", setId, "spam", null);
    await getDb().update(studySets).set({ moderationStatus: "stale" }).where(eq(studySets.id, setId));
    expect(await approveSet(setId)).toBe(false);
    expect((await getShareState(OWNER, setId))?.moderationStatus).toBe("stale");

    await getDb().update(studySets).set({ moderationStatus: "blocked" }).where(eq(studySets.id, setId));
    expect(await approveSet(setId)).toBe(false);
    expect((await getShareState(OWNER, setId))?.moderationStatus).toBe("blocked");
    expect(await approveSet("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("approving a set in review records its current content hash", async () => {
    const { setId } = await sharedSet();
    await replaceCards(OWNER, setId, [{ term: "new", definition: "content" }]);
    await getDb().update(studySets).set({ moderationStatus: "review" }).where(eq(studySets.id, setId));
    expect(await approveSet(setId)).toBe(true);
    const state = await getShareState(OWNER, setId);
    expect(state?.moderationStatus).toBe("approved");
    expect(state?.moderatedHash).toBe(contentHash((await loadShareContent(OWNER, setId))!));
  });

  it("a set blocked for involving minors reaches the admin queue", async () => {
    await getOrCreateProfile(OWNER);
    await setHandle(OWNER, "owner");
    const setId = await createSet(OWNER, { title: "M", sourceType: "text", sourceText: "", outputLang: "en" });
    await replaceCards(OWNER, setId, [{ term: "t", definition: "d" }]);
    const block = vi.fn(async () => ({ verdict: "block" as const, categories: ["sexual", "minors"], reason: "x" }));
    const res = await shareSet({ userId: OWNER, profile: { handle: "owner", shareBlockedUntil: null, bannedAt: null }, setId, visibility: "public", screen: block });
    expect(res.ok && res.data.status).toBe("blocked");
    const queue = await listModerationQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ setId, status: "blocked", reason: "sexual,minors" });

    const other = await createSet(OWNER, { title: "H", sourceType: "text", sourceText: "", outputLang: "en" });
    await replaceCards(OWNER, other, [{ term: "t", definition: "d" }]);
    const hate = vi.fn(async () => ({ verdict: "block" as const, categories: ["hate"], reason: "x" }));
    await shareSet({ userId: OWNER, profile: { handle: "owner", shareBlockedUntil: null, bannedAt: null }, setId: other, visibility: "public", screen: hate });
    expect((await listModerationQueue()).map((q) => q.setId)).toEqual([setId]);
  });
});
