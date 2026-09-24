import { shuffle } from "./utils";

// Learn mode: each card needs two correct answers to be mastered: first a
// recognition question (multiple choice or true/false), then typing the term.
// A miss resets that card and brings it back a few questions later.

export type LearnCard = { id: string; term: string; definition: string };

export type Question =
  | { kind: "mcq"; cardId: string; prompt: string; choices: string[]; answer: string }
  | { kind: "true_false"; cardId: string; term: string; shownDefinition: string; answer: boolean }
  | { kind: "typed"; cardId: string; prompt: string; answer: string };

export type LearnState = {
  queue: string[]; // card ids, front is next
  step: Record<string, 0 | 1 | 2>; // 2 = mastered
  answered: number;
  correct: number;
};

export const MASTERY_STEPS = 2;
const REQUEUE_GAP = 3;

export function startLearn(cards: LearnCard[], random: () => number = Math.random): LearnState {
  const ids = shuffle(
    cards.map((c) => c.id),
    random,
  );
  return {
    queue: ids,
    step: Object.fromEntries(ids.map((id) => [id, 0])) as LearnState["step"],
    answered: 0,
    correct: 0,
  };
}

export function progress(state: LearnState) {
  const ids = Object.keys(state.step);
  if (ids.length === 0) return 1;
  const done = ids.reduce((sum, id) => sum + state.step[id]!, 0);
  return done / (ids.length * MASTERY_STEPS);
}

export function isFinished(state: LearnState) {
  return state.queue.length === 0;
}

/** Records an answer for the card at the front of the queue. */
export function answer(state: LearnState, wasCorrect: boolean): LearnState {
  const [id, ...rest] = state.queue;
  if (!id) return state;
  const step = { ...state.step };
  let queue = rest;
  if (wasCorrect) {
    step[id] = Math.min(MASTERY_STEPS, step[id]! + 1) as 0 | 1 | 2;
    if (step[id]! < MASTERY_STEPS) queue = [...rest, id];
  } else {
    step[id] = 0;
    const at = Math.min(REQUEUE_GAP, rest.length);
    queue = [...rest.slice(0, at), id, ...rest.slice(at)];
  }
  return {
    queue,
    step,
    answered: state.answered + 1,
    correct: state.correct + (wasCorrect ? 1 : 0),
  };
}

/** Builds the question for a card at its current step. */
export function buildQuestion(
  card: LearnCard,
  all: LearnCard[],
  step: number,
  random: () => number = Math.random,
): Question {
  const others = all.filter((c) => c.id !== card.id && c.definition !== card.definition);

  if (step >= 1 || others.length === 0) {
    return { kind: "typed", cardId: card.id, prompt: card.definition, answer: card.term };
  }

  if (others.length >= 2 && random() < 0.7) {
    const distractors = shuffle(others, random)
      .slice(0, 3)
      .map((c) => c.term);
    return {
      kind: "mcq",
      cardId: card.id,
      prompt: card.definition,
      choices: shuffle([card.term, ...distractors], random),
      answer: card.term,
    };
  }

  const truthful = random() < 0.5;
  const shown = truthful ? card.definition : shuffle(others, random)[0]!.definition;
  return { kind: "true_false", cardId: card.id, term: card.term, shownDefinition: shown, answer: truthful };
}
