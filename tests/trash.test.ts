import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceCards } from "@/server/db/queries/cards";
import { getOrCreateProfile, setHandle } from "@/server/db/queries/profiles";
import { listDueCards } from "@/server/db/queries/reviews";
import {
  countDueCards,
  createSet,
  deleteTrashedSet,
  getSet,
  listSets,
  listSetsWithDue,
  listTrash,
  moveSetToTrash,
  purgeTrash,
  restoreSet,
} from "@/server/db/queries/sets";
import { getPublicSetBySlug } from "@/server/db/queries/sharing";
import { shareSet } from "@/server/sharing/share";
import { createTestDb } from "./helpers/db";

const A = "user-a";
const B = "user-b";
const DAY = 24 * 60 * 60 * 1000;

async function seed(title = "Rocks") {
  const id = await createSet(A, { title, sourceType: "text", sourceText: "", outputLang: "en" });
  await replaceCards(A, id, [{ term: "Igneous", definition: "Cooled magma" }]);
  return id;
}

describe("trash", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("a trashed set disappears from the library, study pages, review and due counts", async () => {
    const id = await seed();
    expect(await moveSetToTrash(A, id)).toBe(true);
    expect(await listSets(A)).toEqual([]);
    expect(await getSet(A, id)).toBeNull();
    expect(await countDueCards(A)).toBe(0);
    expect(await listSetsWithDue(A)).toEqual([]);
    expect(await listDueCards(A)).toEqual([]);
    expect((await listTrash(A)).map((s) => [s.title, s.cardCount])).toEqual([["Rocks", 1]]);
  });

  it("restore brings it back; delete forever removes it", async () => {
    const id = await seed();
    const other = await seed("Cells");
    await moveSetToTrash(A, id);
    await moveSetToTrash(A, other);
    expect(await restoreSet(A, id)).toBe(true);
    expect((await listSets(A)).map((s) => s.title)).toEqual(["Rocks"]);
    expect(await deleteTrashedSet(A, other)).toBe(true);
    expect(await listTrash(A)).toEqual([]);
  });

  it("delete forever only works on trashed sets, and only the owner can trash or restore", async () => {
    const id = await seed();
    expect(await deleteTrashedSet(A, id)).toBe(false); // not in trash yet
    expect(await moveSetToTrash(B, id)).toBe(false);
    await moveSetToTrash(A, id);
    expect(await restoreSet(B, id)).toBe(false);
    expect(await deleteTrashedSet(B, id)).toBe(false);
    expect(await listTrash(B)).toEqual([]);
  });

  it("empties sets that have been in the trash for over 30 days", async () => {
    const old = await seed("Old");
    const recent = await seed("Recent");
    const now = new Date();
    await moveSetToTrash(A, old, new Date(now.getTime() - 31 * DAY));
    await moveSetToTrash(A, recent, new Date(now.getTime() - 2 * DAY));
    await purgeTrash(A, now);
    expect((await listTrash(A)).map((s) => s.title)).toEqual(["Recent"]);
  });

  it("trashing a shared set makes it private", async () => {
    await getOrCreateProfile(A);
    await setHandle(A, "alice");
    const id = await seed();
    const allow = vi.fn(async () => ({ verdict: "allow" as const, categories: [], reason: null }));
    const res = await shareSet({ userId: A, profile: { handle: "alice", shareBlockedUntil: null, bannedAt: null }, setId: id, visibility: "public", screen: allow });
    const slug = res.ok ? res.data.slug! : "";
    expect(await getPublicSetBySlug(slug)).not.toBeNull();
    await moveSetToTrash(A, id);
    expect(await getPublicSetBySlug(slug)).toBeNull();
    await restoreSet(A, id);
    expect(await getPublicSetBySlug(slug)).toBeNull(); // stays private until shared again
  });
});

describe("trash countdown", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("reports how many days are left before a set is emptied", async () => {
    const id = await seed();
    await moveSetToTrash(A, id, new Date(Date.now() - 10 * DAY - 60_000));
    expect((await listTrash(A))[0]?.daysLeft).toBe(20);
  });
});
