import "server-only";
import { and, count, desc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import { cardReviews, cards, studySets, type OutputLang, type SourceType, type StudySet } from "../schema";

export type SetListItem = Pick<
  StudySet,
  "id" | "title" | "subject" | "sourceType" | "status" | "updatedAt"
> & { cardCount: number };

export async function listSets(userId: string, search?: string): Promise<SetListItem[]> {
  const term = search?.trim();
  const filter = term
    ? and(
        eq(studySets.userId, userId),
        or(ilike(studySets.title, `%${escapeLike(term)}%`), ilike(studySets.subject, `%${escapeLike(term)}%`)),
      )
    : eq(studySets.userId, userId);

  return getDb()
    .select({
      id: studySets.id,
      title: studySets.title,
      subject: studySets.subject,
      sourceType: studySets.sourceType,
      status: studySets.status,
      updatedAt: studySets.updatedAt,
      cardCount: sql<number>`(select count(*)::int from ${cards} where ${cards.setId} = ${studySets.id})`,
    })
    .from(studySets)
    .where(filter)
    .orderBy(desc(studySets.updatedAt))
    .limit(200);
}

export async function getSet(userId: string, setId: string): Promise<StudySet | null> {
  const rows = await getDb()
    .select()
    .from(studySets)
    .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSet(
  userId: string,
  input: { title: string; subject?: string | null; sourceType: SourceType; sourceText: string; outputLang: OutputLang },
) {
  const rows = await getDb()
    .insert(studySets)
    .values({ userId, ...input, status: "generating" })
    .returning({ id: studySets.id });
  return rows[0]!.id;
}

export async function updateSet(
  userId: string,
  setId: string,
  patch: Partial<Pick<StudySet, "title" | "subject" | "summary" | "status" | "outputLang">>,
) {
  const rows = await getDb()
    .update(studySets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
    .returning({ id: studySets.id });
  return rows.length > 0;
}

export async function deleteSet(userId: string, setId: string) {
  const rows = await getDb()
    .delete(studySets)
    .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
    .returning({ id: studySets.id });
  return rows.length > 0;
}

/** Cards due for spaced repetition today (cards never reviewed count as due). */
export async function countDueCards(userId: string, now = new Date()) {
  const rows = await getDb()
    .select({ n: count() })
    .from(cards)
    .leftJoin(cardReviews, eq(cardReviews.cardId, cards.id))
    .where(
      and(
        eq(cards.userId, userId),
        or(sql`${cardReviews.cardId} is null`, lte(cardReviews.dueAt, now)),
      ),
    );
  return rows[0]?.n ?? 0;
}

/** Sets that have cards, with how many are due today (never-reviewed cards count as due). */
export async function listSetsWithDue(userId: string, now = new Date()) {
  const due = sql<number>`count(*) filter (where ${cardReviews.cardId} is null or ${cardReviews.dueAt} <= ${now.toISOString()}::timestamptz)::int`;
  return getDb()
    .select({
      id: studySets.id,
      title: studySets.title,
      subject: studySets.subject,
      cardCount: sql<number>`count(${cards.id})::int`,
      dueCount: due,
    })
    .from(studySets)
    .innerJoin(cards, and(eq(cards.setId, studySets.id), eq(cards.userId, userId)))
    .leftJoin(cardReviews, eq(cardReviews.cardId, cards.id))
    .where(eq(studySets.userId, userId))
    .groupBy(studySets.id)
    .orderBy(desc(due), desc(studySets.updatedAt))
    .limit(200);
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
