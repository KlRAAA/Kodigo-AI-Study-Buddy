import "server-only";
import { and, asc, eq, max } from "drizzle-orm";
import { getDb } from "../client";
import { cards, studySets, type Card } from "../schema";

export type CardInput = { term: string; definition: string; example?: string | null };

export async function listCards(userId: string, setId: string): Promise<Card[]> {
  return getDb()
    .select()
    .from(cards)
    .where(and(eq(cards.setId, setId), eq(cards.userId, userId)))
    .orderBy(asc(cards.position));
}

/** Replaces all cards in a set (used right after generation). */
export async function replaceCards(userId: string, setId: string, input: CardInput[]) {
  if (!(await ownsSet(userId, setId))) return false;
  const db = getDb();
  await db.delete(cards).where(and(eq(cards.setId, setId), eq(cards.userId, userId)));
  if (input.length > 0) {
    await db.insert(cards).values(
      input.map((c, i) => ({
        setId,
        userId,
        term: c.term,
        definition: c.definition,
        example: c.example ?? null,
        position: i,
      })),
    );
  }
  return true;
}

export async function addCard(userId: string, setId: string, input: CardInput) {
  if (!(await ownsSet(userId, setId))) return null;
  const db = getDb();
  const [last] = await db
    .select({ pos: max(cards.position) })
    .from(cards)
    .where(and(eq(cards.setId, setId), eq(cards.userId, userId)));
  const rows = await db
    .insert(cards)
    .values({ setId, userId, ...input, example: input.example ?? null, position: (last?.pos ?? -1) + 1 })
    .returning();
  return rows[0] ?? null;
}

export async function updateCard(
  userId: string,
  cardId: string,
  patch: Partial<Pick<Card, "term" | "definition" | "example" | "starred">>,
) {
  const rows = await getDb()
    .update(cards)
    .set(patch)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
    .returning({ id: cards.id });
  return rows.length > 0;
}

export async function deleteCard(userId: string, cardId: string) {
  const rows = await getDb()
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
    .returning({ id: cards.id });
  return rows.length > 0;
}

async function ownsSet(userId: string, setId: string) {
  const rows = await getDb()
    .select({ id: studySets.id })
    .from(studySets)
    .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
    .limit(1);
  return rows.length > 0;
}
