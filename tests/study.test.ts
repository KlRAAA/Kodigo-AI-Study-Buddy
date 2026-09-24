import { describe, expect, it } from "vitest";
import { editDistance, isAnswerCorrect, normalizeAnswer } from "@/lib/answer-match";
import { answer, buildQuestion, isFinished, progress, startLearn, type LearnCard } from "@/lib/learn";

describe("answer matching", () => {
  it("ignores case, accents, punctuation and articles", () => {
    expect(normalizeAnswer("  The Mitochondria! ")).toBe("mitochondria");
    expect(isAnswerCorrect("jose rizal", "José Rizal")).toBe(true);
    expect(isAnswerCorrect("ang katipunan", "Katipunan")).toBe(true);
    expect(isAnswerCorrect("PHOTO-SYNTHESIS", "photosynthesis")).toBe(true); // hyphen → space is one small edit
  });

  it("forgives small typos relative to answer length", () => {
    expect(isAnswerCorrect("photosynthesys", "photosynthesis")).toBe(true);
    expect(isAnswerCorrect("mitocondria", "mitochondria")).toBe(true);
    expect(isAnswerCorrect("cat", "car")).toBe(false); // too short for any typo
    expect(isAnswerCorrect("respiration", "photosynthesis")).toBe(false);
    expect(isAnswerCorrect("", "anything")).toBe(false);
  });

  it("computes edit distance with an early exit", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("abc", "abcdefgh", 2)).toBe(3);
  });
});

const cards: LearnCard[] = [
  { id: "1", term: "Cell", definition: "Basic unit of life" },
  { id: "2", term: "Nucleus", definition: "Holds DNA" },
  { id: "3", term: "Ribosome", definition: "Makes proteins" },
  { id: "4", term: "Membrane", definition: "Controls what enters" },
];

// Deterministic "random" for tests.
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("learn mode", () => {
  it("builds an MCQ with the answer and distinct distractors", () => {
    const q = buildQuestion(cards[0]!, cards, 0, seq(0.1, 0.3, 0.6, 0.9));
    expect(q.kind).toBe("mcq");
    if (q.kind !== "mcq") return;
    expect(q.choices).toContain("Cell");
    expect(new Set(q.choices).size).toBe(4);
  });

  it("uses true/false when MCQ isn't chosen, and typed at step 1", () => {
    const tf = buildQuestion(cards[0]!, cards, 0, seq(0.9, 0.2));
    expect(tf.kind).toBe("true_false");
    expect(buildQuestion(cards[0]!, cards, 1).kind).toBe("typed");
    expect(buildQuestion(cards[0]!, [cards[0]!], 0).kind).toBe("typed"); // single card: nothing to compare
  });

  it("requires two correct answers per card and re-queues misses", () => {
    let s = startLearn(cards.slice(0, 2), seq(0.5));
    expect(progress(s)).toBe(0);
    const first = s.queue[0]!;
    s = answer(s, false); // miss: card goes back into the queue
    expect(s.step[first]).toBe(0);
    expect(s.queue).toContain(first);
    // Answer everything correctly until done.
    let guard = 0;
    while (!isFinished(s) && guard++ < 20) s = answer(s, true);
    expect(isFinished(s)).toBe(true);
    expect(progress(s)).toBe(1);
    expect(s.answered).toBe(5);
    expect(s.correct).toBe(4);
  });
});
