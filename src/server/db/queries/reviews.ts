import "server-only";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { NEW_CARD, schedule, type Grade, type ReviewState } from "@/lib/srs";
import { getDb } from "../client";
import { cardReviews, cards, studySets } from "../schema";

export type DueCard = {
  id: string;
  term: string;
  definition: string;
  example: string | null;
  setId: string;
  setTitle: string;
  /** Never reviewed before. */
  isNew: boolean;
  state: ReviewState;
};

/** Cards due for review now (never-reviewed cards count as due): overdue first, then new ones. */
export async function listDueCards(
  userId: string,
  opts: { now?: Date; setId?: string; limit?: number } = {},
): Promise<DueCard[]> {
  const now = opts.now ?? new Date();
  const rows = await getDb()
    .select({
      id: cards.id,
      term: cards.term,
      definition: cards.definition,
      example: cards.example,
      setId: cards.setId,
      setTitle: studySets.title,
      ease: cardReviews.ease,
      intervalDays: cardReviews.intervalDays,
      repetitions: cardReviews.repetitions,
      lapses: cardReviews.lapses,
      dueAt: cardReviews.dueAt,
      lastGrade: cardReviews.lastGrade,
    })
    .from(cards)
    .innerJoin(
      studySets,
      and(eq(studySets.id, cards.setId), eq(studySets.userId, userId), isNull(studySets.deletedAt)),
    )
    .leftJoin(cardReviews, eq(cardReviews.cardId, cards.id))
    .where(
      and(
        eq(cards.userId, userId),
        opts.setId ? eq(cards.setId, opts.setId) : undefined,
        or(isNull(cardReviews.cardId), lte(cardReviews.dueAt, now)),
      ),
    )
    // Reviewed cards (oldest due first) before new ones; new ones in set/card order.
    .orderBy(sql`${cardReviews.dueAt} asc nulls last`, asc(studySets.createdAt), asc(cards.position))
    .limit(opts.limit ?? 50);

  return rows.map((r) => ({
    id: r.id,
    term: r.term,
    definition: r.definition,
    example: r.example,
    setId: r.setId,
    setTitle: r.setTitle,
    isNew: r.dueAt === null,
    state:
      r.dueAt === null
        ? NEW_CARD
        : {
            ease: r.ease ?? NEW_CARD.ease,
            intervalDays: r.intervalDays ?? 0,
            repetitions: r.repetitions ?? 0,
            lapses: r.lapses ?? 0,
            dueAt: r.dueAt,
            lastGrade: r.lastGrade,
          },
  }));
}

/** Records one answer and schedules the next review. Returns null if the card isn't the user's. */
export async function recordReview(
  userId: string,
  cardId: string,
  grade: Grade,
  now: Date = new Date(),
): Promise<ReviewState | null> {
  const db = getDb();
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
    .limit(1);
  if (!card) return null;

  const [existing] = await db
    .select()
    .from(cardReviews)
    .where(and(eq(cardReviews.cardId, cardId), eq(cardReviews.userId, userId)))
    .limit(1);
  const next = schedule(existing ?? NEW_CARD, grade, now);

  await db
    .insert(cardReviews)
    .values({ cardId, userId, ...next })
    .onConflictDoUpdate({ target: cardReviews.cardId, set: { ...next } });
  return next;
}
