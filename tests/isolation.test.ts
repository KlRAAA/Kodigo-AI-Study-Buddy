import { beforeEach, describe, expect, it } from "vitest";
import { addCard, deleteCard, listCards, replaceCards, setIdForCard, updateCard } from "@/server/db/queries/cards";
import { deleteAllUserData, getOrCreateProfile } from "@/server/db/queries/profiles";
import { createSet, deleteSet, getSet, listSets, listSetsWithDue, updateSet } from "@/server/db/queries/sets";
import { createTestDb } from "./helpers/db";

// Every query takes the caller's userId; these tests prove user B can never
// reach user A's rows even with the right ids.

const A = "user-a";
const B = "user-b";

async function seed() {
  const setId = await createSet(A, {
    title: "A's biology",
    sourceType: "text",
    sourceText: "cells…",
    outputLang: "auto",
  });
  await replaceCards(A, setId, [
    { term: "Cell", definition: "Basic unit of life" },
    { term: "Nucleus", definition: "Holds DNA" },
  ]);
  const [card] = await listCards(A, setId);
  return { setId, cardId: card!.id };
}

describe("per-user data isolation", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("B can't list or read A's sets", async () => {
    const { setId } = await seed();
    expect(await listSets(B)).toEqual([]);
    expect(await getSet(B, setId)).toBeNull();
    expect(await listCards(B, setId)).toEqual([]);
    expect((await listSets(A)).map((s) => [s.title, s.cardCount])).toEqual([["A's biology", 2]]);
  });

  it("B can't update or delete A's set", async () => {
    const { setId } = await seed();
    expect(await updateSet(B, setId, { title: "hacked" })).toBe(false);
    expect(await deleteSet(B, setId)).toBe(false);
    expect((await getSet(A, setId))?.title).toBe("A's biology");
  });

  it("B can't add, edit, star or delete A's cards", async () => {
    const { setId, cardId } = await seed();
    expect(await addCard(B, setId, { term: "x", definition: "y" })).toBeNull();
    expect(await replaceCards(B, setId, [])).toBe(false);
    expect(await updateCard(B, cardId, { term: "hacked", starred: true })).toBe(false);
    expect(await deleteCard(B, cardId)).toBe(false);
    const cards = await listCards(A, setId);
    expect(cards).toHaveLength(2);
    expect(cards[0]!.term).toBe("Cell");
    expect(cards[0]!.starred).toBe(false);
  });

  it("deleting B's account leaves A's data intact", async () => {
    const { setId } = await seed();
    await getOrCreateProfile(B);
    const bSet = await createSet(B, { title: "B", sourceType: "text", sourceText: "", outputLang: "en" });
    await addCard(B, bSet, { term: "t", definition: "d" });

    await deleteAllUserData(B);
    expect(await listSets(B)).toEqual([]);
    expect(await getSet(A, setId)).not.toBeNull();
    expect(await listCards(A, setId)).toHaveLength(2);
  });

  it("search is scoped to the user and escapes wildcards", async () => {
    await seed();
    await createSet(B, { title: "B's biology", sourceType: "text", sourceText: "", outputLang: "en" });
    expect((await listSets(B, "bio")).map((s) => s.title)).toEqual(["B's biology"]);
    expect(await listSets(A, "%")).toEqual([]);
  });

  it("setIdForCard only resolves the owner's cards", async () => {
    const { setId, cardId } = await seed();
    expect(await setIdForCard(A, cardId)).toBe(setId);
    expect(await setIdForCard(B, cardId)).toBeNull();
  });

  it("review list shows only the user's sets with due counts", async () => {
    const { setId } = await seed();
    await createSet(A, { title: "empty set", sourceType: "text", sourceText: "", outputLang: "en" });
    expect(await listSetsWithDue(B)).toEqual([]);
    const rows = await listSetsWithDue(A);
    expect(rows).toHaveLength(1); // sets without cards are skipped
    expect(rows[0]).toMatchObject({ id: setId, cardCount: 2, dueCount: 2 });
  });
});
