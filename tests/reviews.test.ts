import { beforeEach, describe, expect, it } from "vitest";
import { listCards, replaceCards } from "@/server/db/queries/cards";
import { listDueCards, recordReview } from "@/server/db/queries/reviews";
import { countDueCards, createSet } from "@/server/db/queries/sets";
import { createTestDb } from "./helpers/db";

const A = "user-a";
const B = "user-b";
const now = new Date("2026-09-25T10:00:00Z");
const minutes = (m: number) => new Date(now.getTime() + m * 60 * 1000);

async function seed() {
  const s1 = await createSet(A, { title: "Rocks", sourceType: "text", sourceText: "", outputLang: "en" });
  const s2 = await createSet(A, { title: "Cells", sourceType: "text", sourceText: "", outputLang: "en" });
  await replaceCards(A, s1, [
    { term: "Igneous", definition: "Cooled magma" },
    { term: "Sedimentary", definition: "Layers" },
  ]);
  await replaceCards(A, s2, [{ term: "Nucleus", definition: "Holds DNA" }]);
  const [c1] = await listCards(A, s1);
  return { s1, s2, c1: c1! };
}

describe("spaced repetition reviews", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("new cards are due; reviewing Good removes a card from today's list", async () => {
    const { c1 } = await seed();
    expect(await countDueCards(A, now)).toBe(3);
    expect((await listDueCards(A, { now })).map((c) => c.term).sort()).toEqual(["Igneous", "Nucleus", "Sedimentary"]);

    const next = await recordReview(A, c1.id, "good", now);
    expect(next?.intervalDays).toBe(1);
    expect(await countDueCards(A, now)).toBe(2);
    expect((await listDueCards(A, { now })).map((c) => c.id)).not.toContain(c1.id);
    // Tomorrow it is due again.
    expect(await countDueCards(A, minutes(24 * 60 + 1))).toBe(3);
  });

  it("Again brings the card back in 10 minutes", async () => {
    const { c1 } = await seed();
    await recordReview(A, c1.id, "again", now);
    expect((await listDueCards(A, { now: minutes(5) })).map((c) => c.id)).not.toContain(c1.id);
    expect((await listDueCards(A, { now: minutes(11) })).map((c) => c.id)).toContain(c1.id);
  });

  it("builds on the previous review", async () => {
    const { c1 } = await seed();
    await recordReview(A, c1.id, "good", now);
    const second = await recordReview(A, c1.id, "good", minutes(24 * 60));
    expect(second).toMatchObject({ repetitions: 2, intervalDays: 6 });
  });

  it("can be limited to one set, and carries the set title", async () => {
    const { s2 } = await seed();
    const due = await listDueCards(A, { now, setId: s2 });
    expect(due.map((c) => [c.term, c.setTitle])).toEqual([["Nucleus", "Cells"]]);
  });

  it("users can't review or see each other's cards", async () => {
    const { c1 } = await seed();
    expect(await recordReview(B, c1.id, "good", now)).toBeNull();
    expect(await listDueCards(B, { now })).toEqual([]);
    expect(await countDueCards(A, now)).toBe(3);
  });
});
