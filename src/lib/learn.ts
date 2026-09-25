import { parseListItems } from "./enumeration";
import { shuffle } from "./utils";

// Learn mode: each card needs two correct answers to be mastered. The first
// prefers a recognition question (multiple choice / true-false), the second a
// recall question (identification / enumeration), limited to the types the
// student picked. A miss resets that card and brings it back a few questions later.

export type LearnCard = { id: string; term: string; definition: string };

export const QUESTION_TYPES = ["mcq", "true_false", "identification", "enumeration"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

const RECOGNITION: QuestionType[] = ["mcq", "true_false"];
const RECALL: QuestionType[] = ["identification", "enumeration"];

export type Question =
  | {
      kind: "mcq";
      cardId: string;
      prompt: string;
      choices: string[];
      answer: string;
      /** What each choice actually means, to explain a wrong pick. */
      meanings: Record<string, string>;
    }
  | {
      kind: "true_false";
      cardId: string;
      term: string;
      shownDefinition: string;
      answer: boolean;
      /** The real definition of the term. */
      definition: string;
      /** When false: the term the shown definition really belongs to. */
      shownBelongsTo: string | null;
    }
  | { kind: "identification"; cardId: string; prompt: string; answer: string }
  | { kind: "enumeration"; cardId: string; prompt: string; items: string[] };

export type LearnState = {
  queue: string[]; // card ids, front is next
  step: Record<string, 0 | 1 | 2>; // 2 = mastered
  answered: number;
  correct: number;
};

export const MASTERY_STEPS = 2;
const REQUEUE_GAP = 3;

/** Which of the chosen question types can be asked about this card. */
export function typesForCard(card: LearnCard, all: LearnCard[], chosen: readonly QuestionType[]) {
  const others = all.filter((c) => c.id !== card.id && c.definition !== card.definition);
  return chosen.filter((type) => {
    if (type === "mcq") return others.length >= 2;
    if (type === "true_false") return others.length >= 1;
    if (type === "enumeration") return parseListItems(card.definition) !== null;
    return true;
  });
}

/** True if at least one card in the set can be asked with this type. */
export function isTypeAvailable(type: QuestionType, cards: LearnCard[]) {
  return cards.some((c) => typesForCard(c, cards, [type]).length > 0);
}

/** Cards that can be asked with at least one chosen type. */
export function eligibleCards(cards: LearnCard[], chosen: readonly QuestionType[]) {
  return cards.filter((c) => typesForCard(c, cards, chosen).length > 0);
}

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

/** Builds the question for a card at its current step, using only the chosen types. */
export function buildQuestion(
  card: LearnCard,
  all: LearnCard[],
  step: number,
  chosen: readonly QuestionType[] = QUESTION_TYPES,
  random: () => number = Math.random,
): Question {
  const possible = typesForCard(card, all, chosen);
  const preferred = possible.filter((t) => (step >= 1 ? RECALL : RECOGNITION).includes(t));
  const pool = preferred.length > 0 ? preferred : possible;
  // A list card asked for recall should be enumerated when that's allowed.
  const type: QuestionType =
    pool.includes("enumeration") && step >= 1
      ? "enumeration"
      : (pool[Math.floor(random() * pool.length)] ?? "identification");

  const others = all.filter((c) => c.id !== card.id && c.definition !== card.definition);

  switch (type) {
    case "mcq": {
      const picked = shuffle(others, random).slice(0, 3);
      return {
        kind: "mcq",
        cardId: card.id,
        prompt: card.definition,
        choices: shuffle([card.term, ...picked.map((c) => c.term)], random),
        answer: card.term,
        meanings: Object.fromEntries([card, ...picked].map((c) => [c.term, c.definition])),
      };
    }
    case "true_false": {
      const truthful = random() < 0.5;
      const other = truthful ? null : shuffle(others, random)[0]!;
      return {
        kind: "true_false",
        cardId: card.id,
        term: card.term,
        shownDefinition: other ? other.definition : card.definition,
        answer: truthful,
        definition: card.definition,
        shownBelongsTo: other ? other.term : null,
      };
    }
    case "enumeration":
      return { kind: "enumeration", cardId: card.id, prompt: card.term, items: parseListItems(card.definition)! };
    default:
      return { kind: "identification", cardId: card.id, prompt: card.definition, answer: card.term };
  }
}

/** "Get a hint" for multiple choice: two wrong choices to remove (none if there aren't enough). */
export function choicesToHide(choices: string[], answer: string, random: () => number = Math.random): string[] {
  const wrong = choices.filter((c) => c !== answer);
  if (wrong.length < 3) return [];
  return shuffle(wrong, random).slice(0, 2);
}

/** "Get a hint" for typed answers: the first letter and how many letters the answer has. */
export function letterHint(answer: string): { letter: string; count: number } {
  const letters = answer.match(/[\p{L}\p{N}]/gu) ?? [];
  return { letter: (letters[0] ?? "").toUpperCase(), count: letters.length };
}
