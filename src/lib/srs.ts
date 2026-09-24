// Spaced repetition (SM-2, the algorithm behind Anki), with Anki-style buttons.
// Again = forgot, Hard = barely, Good = remembered, Easy = instantly.

export const GRADES = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof GRADES)[number];

/** SM-2 quality score per button. */
const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export type ReviewState = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
  lastGrade: number | null;
};

/** A card that has never been reviewed. */
export const NEW_CARD: ReviewState = {
  ease: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
  dueAt: new Date(0),
  lastGrade: null,
};

const MIN_EASE = 1.3;
const RELEARN_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Next state after answering a card. */
export function schedule(state: ReviewState, grade: Grade, now: Date = new Date()): ReviewState {
  const q = QUALITY[grade];
  const ease = Math.max(MIN_EASE, state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (grade === "again") {
    return {
      ease,
      intervalDays: 0,
      repetitions: 0,
      lapses: state.lapses + (state.repetitions > 0 ? 1 : 0),
      dueAt: new Date(now.getTime() + RELEARN_MS),
      lastGrade: q,
    };
  }

  const repetitions = state.repetitions + 1;
  const prev = state.intervalDays;
  let intervalDays: number;
  if (repetitions === 1) {
    intervalDays = grade === "easy" ? 4 : 1;
  } else if (repetitions === 2) {
    intervalDays = grade === "easy" ? 8 : grade === "hard" ? 4 : 6;
  } else if (grade === "hard") {
    intervalDays = Math.max(prev + 1, Math.round(prev * 1.2));
  } else if (grade === "easy") {
    intervalDays = Math.round(prev * state.ease * 1.3);
  } else {
    intervalDays = Math.round(prev * state.ease);
  }

  return {
    ease,
    intervalDays,
    repetitions,
    lapses: state.lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
    lastGrade: q,
  };
}

/** Short label for an interval: 10m, 3d, 1.5mo, 1.1y. */
export function formatInterval(days: number): string {
  if (days <= 0) return "10m";
  if (days < 30) return `${days}d`;
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (days < 365) return `${trim(days / 30)}mo`;
  return `${trim(days / 365)}y`;
}

/** What each button would schedule, for the labels under the buttons. */
export function previewIntervals(state: ReviewState, now: Date = new Date()): Record<Grade, string> {
  return Object.fromEntries(
    GRADES.map((g) => [g, formatInterval(schedule(state, g, now).intervalDays)]),
  ) as Record<Grade, string>;
}
