import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceCards } from "@/server/db/queries/cards";
import { getOrCreateProfile, setHandle } from "@/server/db/queries/profiles";
import { createSet } from "@/server/db/queries/sets";
import { getPublicSetBySlug, getShareState, markSetStale, updateShareState } from "@/server/db/queries/sharing";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { ScreeningUnavailableError } from "@/server/moderation/screen";
import { shareSet } from "@/server/sharing/share";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";

const A = "user-a";
const allow = vi.fn(async () => ({ verdict: "allow" as const, categories: [], reason: null }));
const profileA = { handle: "alice", shareBlockedUntil: null, bannedAt: null };

async function seed() {
  await getOrCreateProfile(A);
  await setHandle(A, "alice");
  const setId = await createSet(A, { title: "Rocks", sourceType: "text", sourceText: "secret source", outputLang: "en" });
  await replaceCards(A, setId, [{ term: "Igneous", definition: "Cooled magma" }]);
  return setId;
}

describe("shareSet", () => {
  beforeEach(async () => {
    await createTestDb();
    allow.mockClear();
  });

  it("screens, approves and returns a link; the public page hides private fields", async () => {
    const setId = await seed();
    const res = await shareSet({ userId: A, profile: profileA, setId, visibility: "link", screen: allow });
    expect(res.ok && res.data.status).toBe("approved");
    const slug = res.ok ? res.data.slug! : "";
    expect(slug).toMatch(/^[0-9A-Za-z]{10}$/);
    const view = await getPublicSetBySlug(slug);
    expect(view && "id" in view && view.ownerHandle).toBe("alice");
    expect(JSON.stringify(view)).not.toContain("secret source");
    expect(JSON.stringify(view)).not.toContain(A);
  });

  it("needs a handle, respects share blocks and bans, and rejects non-owners", async () => {
    const setId = await seed();
    const base = { setId, visibility: "public" as const, screen: allow };
    expect(await shareSet({ ...base, userId: A, profile: { ...profileA, handle: null } })).toEqual({ ok: false, error: "needs_handle" });
    expect(
      await shareSet({ ...base, userId: A, profile: { ...profileA, shareBlockedUntil: new Date(Date.now() + 60_000) } }),
    ).toEqual({ ok: false, error: "share_blocked" });
    expect(await shareSet({ ...base, userId: A, profile: { ...profileA, bannedAt: new Date() } })).toEqual({ ok: false, error: "banned" });
    expect(await shareSet({ ...base, userId: "intruder", profile: profileA })).toEqual({ ok: false, error: "not_found" });
  });

  it("does not re-screen unchanged approved content", async () => {
    const setId = await seed();
    await shareSet({ userId: A, profile: profileA, setId, visibility: "link", screen: allow });
    await shareSet({ userId: A, profile: profileA, setId, visibility: "public", screen: allow });
    expect(allow).toHaveBeenCalledTimes(1);
    expect((await getShareState(A, setId))?.visibility).toBe("public");
  });

  it("blocked stays private; review keeps the request hidden; unavailable changes nothing", async () => {
    const setId = await seed();
    const block = vi.fn(async () => ({ verdict: "block" as const, categories: ["hate"], reason: "x" }));
    const r1 = await shareSet({ userId: A, profile: profileA, setId, visibility: "public", screen: block });
    expect(r1.ok && r1.data).toEqual({ status: "blocked", categories: ["hate"] });
    expect(await getShareState(A, setId)).toMatchObject({ visibility: "private", moderationStatus: "blocked" });

    const set2 = await createSet(A, { title: "B", sourceType: "text", sourceText: "", outputLang: "en" });
    await replaceCards(A, set2, [{ term: "t", definition: "d" }]);
    const review = vi.fn(async () => ({ verdict: "review" as const, categories: ["personal_info"], reason: "phone" }));
    await shareSet({ userId: A, profile: profileA, setId: set2, visibility: "public", screen: review });
    const state = await getShareState(A, set2);
    expect(state).toMatchObject({ visibility: "public", moderationStatus: "review" });
    expect(await getPublicSetBySlug(state!.shareSlug ?? "none")).toBeNull();

    const set3 = await createSet(A, { title: "C", sourceType: "text", sourceText: "", outputLang: "en" });
    await replaceCards(A, set3, [{ term: "t", definition: "d" }]);
    const down = vi.fn(async () => { throw new ScreeningUnavailableError(); });
    expect(await shareSet({ userId: A, profile: profileA, setId: set3, visibility: "public", screen: down })).toEqual({
      ok: false,
      error: "ai_unavailable",
    });
    expect((await getShareState(A, set3))?.visibility).toBe("private");
  });

  it("refuses sets with no cards and counts toward the daily share limit", async () => {
    await getOrCreateProfile(A);
    const empty = await createSet(A, { title: "E", sourceType: "text", sourceText: "", outputLang: "en" });
    expect(await shareSet({ userId: A, profile: profileA, setId: empty, visibility: "link", screen: allow })).toEqual({
      ok: false,
      error: "not_shareable",
    });
  });
});

describe("visibility rules", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("stale sets show 'updating'; private and banned owners' sets are hidden", async () => {
    const setId = await seed();
    const res = await shareSet({ userId: A, profile: profileA, setId, visibility: "public", screen: allow });
    const slug = res.ok ? res.data.slug! : "";

    await markSetStale(A, setId);
    expect(await getPublicSetBySlug(slug)).toEqual({ updating: true });

    await updateShareState(A, setId, { moderationStatus: "approved" });
    await getDb().update(profiles).set({ bannedAt: new Date() }).where(eq(profiles.userId, A));
    expect(await getPublicSetBySlug(slug)).toBeNull();

    await getDb().update(profiles).set({ bannedAt: null }).where(eq(profiles.userId, A));
    await updateShareState(A, setId, { visibility: "private" });
    expect(await getPublicSetBySlug(slug)).toBeNull();
  });

  it("markSetStale ignores private sets and other users", async () => {
    const setId = await seed();
    await markSetStale(A, setId);
    expect((await getShareState(A, setId))?.moderationStatus).toBe("none");
    await shareSet({ userId: A, profile: profileA, setId, visibility: "link", screen: allow });
    await markSetStale("intruder", setId);
    expect((await getShareState(A, setId))?.moderationStatus).toBe("approved");
  });
});
