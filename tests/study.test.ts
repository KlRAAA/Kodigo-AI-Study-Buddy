import { describe, expect, it } from "vitest";
import { editDistance, isAnswerCorrect, normalizeAnswer } from "@/lib/answer-match";
import { checkEnumeration, parseListItems } from "@/lib/enumeration";
import { answer, buildQuestion, eligibleCards, isFinished, isTypeAvailable, progress, startLearn, type LearnCard } from "@/lib/learn";

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
    const q = buildQuestion(cards[0]!, cards, 0, ["mcq"], seq(0.1, 0.3, 0.6, 0.9));
    expect(q.kind).toBe("mcq");
    if (q.kind !== "mcq") return;
    expect(q.choices).toContain("Cell");
    expect(new Set(q.choices).size).toBe(4);
  });

  it("prefers recognition first and recall second, within the chosen types", () => {
    expect(buildQuestion(cards[0]!, cards, 0, ["true_false", "identification"], seq(0.2)).kind).toBe("true_false");
    expect(buildQuestion(cards[0]!, cards, 1, ["true_false", "identification"]).kind).toBe("identification");
    expect(buildQuestion(cards[0]!, cards, 0, ["identification"]).kind).toBe("identification");
    expect(buildQuestion(cards[0]!, cards, 1, ["mcq"], seq(0.1)).kind).toBe("mcq"); // only recognition chosen
    expect(buildQuestion(cards[0]!, [cards[0]!], 0, ["mcq", "identification"]).kind).toBe("identification"); // nothing to compare
  });

  it("true/false and MCQ carry what they need to explain a wrong answer", () => {
    const tf = buildQuestion(cards[0]!, cards, 0, ["true_false"], seq(0.9)); // 0.9 ≥ 0.5 → a false statement
    expect(tf.kind).toBe("true_false");
    if (tf.kind !== "true_false") return;
    expect(tf.answer).toBe(false);
    expect(tf.definition).toBe("Basic unit of life");
    const owner = cards.find((c) => c.definition === tf.shownDefinition);
    expect(tf.shownBelongsTo).toBe(owner?.term);

    const mcq = buildQuestion(cards[0]!, cards, 0, ["mcq"], seq(0.3));
    if (mcq.kind !== "mcq") throw new Error("expected mcq");
    for (const choice of mcq.choices) {
      expect(mcq.meanings[choice]).toBe(cards.find((c) => c.term === choice)?.definition);
    }
  });

  it("asks list cards as enumeration and skips cards a type can't use", () => {
    const list = { id: "L", term: "Types of rocks", definition: "Igneous; Sedimentary; Metamorphic" };
    const all = [...cards, list];
    const q = buildQuestion(list, all, 1, ["mcq", "enumeration"]);
    expect(q).toEqual({ kind: "enumeration", cardId: "L", prompt: "Types of rocks", items: ["Igneous", "Sedimentary", "Metamorphic"] });
    expect(isTypeAvailable("enumeration", cards)).toBe(false);
    expect(isTypeAvailable("enumeration", all)).toBe(true);
    expect(eligibleCards(all, ["enumeration"]).map((c) => c.id)).toEqual(["L"]);
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

describe("enumeration", () => {
  it("detects lists in definitions", () => {
    expect(parseListItems("Igneous; Sedimentary; Metamorphic")).toEqual(["Igneous", "Sedimentary", "Metamorphic"]);
    expect(parseListItems("Three branches:\n1. Executive\n2. Legislative\n3. Judicial")).toEqual([
      "Executive",
      "Legislative",
      "Judicial",
    ]);
    expect(parseListItems("- Mitosis\n- Meiosis")).toEqual(["Mitosis", "Meiosis"]);
    expect(parseListItems("Luzon, Visayas at Mindanao")).toEqual(["Luzon", "Visayas", "Mindanao"]);
    expect(parseListItems("The powerhouse of the cell, which makes energy for the body.")).toBeNull();
    expect(parseListItems("Basic unit of life")).toBeNull();
  });

  it("checks answers in any order with typo tolerance", () => {
    const items = ["Igneous", "Sedimentary", "Metamorphic"];
    expect(checkEnumeration(["metamorphic", "igneus", "Sedimentary"], items)).toEqual({ correct: true, missed: [] });
    expect(checkEnumeration(["Igneous", "Igneous", ""], items)).toEqual({ correct: false, missed: ["Sedimentary", "Metamorphic"] });
  });
});
