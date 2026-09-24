import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../client";
import {
  cardReviews,
  cards,
  profiles,
  quizAttempts,
  quizQuestions,
  quizzes,
  rateEvents,
  studySessions,
  studySets,
  tutorMessages,
  usageCounters,
  type Locale,
  type Profile,
} from "../schema";

/** Returns the user's profile, creating it on first use. */
export async function getOrCreateProfile(
  userId: string,
  defaults: { displayName?: string | null; locale?: Locale } = {},
): Promise<Profile> {
  const db = getDb();
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const created = await db
    .insert(profiles)
    .values({ userId, displayName: defaults.displayName ?? null, locale: defaults.locale ?? "en" })
    .onConflictDoNothing()
    .returning();
  if (created[0]) return created[0];
  const again = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return again[0]!;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "displayName" | "locale" | "onboarded">>,
) {
  await getDb().update(profiles).set(patch).where(eq(profiles.userId, userId));
}

const HANDLE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Claims or changes a handle (already validated by handleSchema). */
export async function setHandle(
  userId: string,
  handle: string,
  now = new Date(),
): Promise<"ok" | "taken" | "too_soon"> {
  const db = getDb();
  const [me] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (me?.handle === handle) return "ok";
  if (me?.handle && me.handleChangedAt && now.getTime() - me.handleChangedAt.getTime() < HANDLE_COOLDOWN_MS) {
    return "too_soon";
  }
  const [other] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.handle, handle), ne(profiles.userId, userId)))
    .limit(1);
  if (other) return "taken";
  try {
    await db.update(profiles).set({ handle, handleChangedAt: now }).where(eq(profiles.userId, userId));
    return "ok";
  } catch {
    return "taken"; // unique index race
  }
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const rows = await getDb().select().from(profiles).where(eq(profiles.handle, handle.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

/** Deletes every row the user owns. Child rows cascade from study_sets/quizzes/cards. */
export async function deleteAllUserData(userId: string) {
  const db = getDb();
  // Explicit deletes for tables that also carry user_id, in child → parent order.
  await db.delete(quizAttempts).where(eq(quizAttempts.userId, userId));
  await db.delete(quizQuestions).where(eq(quizQuestions.userId, userId));
  await db.delete(quizzes).where(eq(quizzes.userId, userId));
  await db.delete(tutorMessages).where(eq(tutorMessages.userId, userId));
  await db.delete(cardReviews).where(eq(cardReviews.userId, userId));
  await db.delete(cards).where(eq(cards.userId, userId));
  await db.delete(studySessions).where(eq(studySessions.userId, userId));
  await db.delete(studySets).where(eq(studySets.userId, userId));
  await db.delete(usageCounters).where(eq(usageCounters.userId, userId));
  await db.delete(rateEvents).where(eq(rateEvents.userId, userId));
  await db.delete(profiles).where(eq(profiles.userId, userId));
}
