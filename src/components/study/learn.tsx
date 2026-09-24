"use client";

import { Check, PartyPopper, Settings2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button, Input, ProgressBar } from "@/components/ui";
import { isAnswerCorrect } from "@/lib/answer-match";
import { checkEnumeration } from "@/lib/enumeration";
import {
  QUESTION_TYPES,
  answer,
  buildQuestion,
  eligibleCards,
  isFinished,
  isTypeAvailable,
  progress,
  startLearn,
  type LearnState,
  type Question,
  type QuestionType,
} from "@/lib/learn";
import { cn } from "@/lib/utils";
import type { StudyCard } from "@/server/actions/sets";

type Feedback = { correct: boolean; expected: string; missed?: string[]; picked?: string } | null;

const STORAGE_KEY = "kodigo.learnTypes";

const noSubscribe = () => () => {};

function readSavedRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseSavedTypes(rawText: string | null): QuestionType[] | null {
  try {
    const raw = JSON.parse(rawText ?? "null") as unknown;
    if (!Array.isArray(raw)) return null;
    const types = raw.filter((t): t is QuestionType => QUESTION_TYPES.includes(t as QuestionType));
    return types.length ? types : null;
  } catch {
    return null;
  }
}

export function Learn({ cards }: { cards: StudyCard[] }) {
  const t = useTranslations("study");
  const available = useMemo(
    () => QUESTION_TYPES.filter((type) => isTypeAvailable(type, cards)),
    [cards],
  );
  // Last choice on this device (only types this set supports), until the student changes it.
  const savedRaw = useSyncExternalStore(noSubscribe, readSavedRaw, () => null);
  const saved = parseSavedTypes(savedRaw)?.filter((type) => available.includes(type));
  const [picked, setPicked] = useState<QuestionType[] | null>(null);
  const chosen = picked ?? (saved?.length ? saved : available);
  const [session, setSession] = useState<{ types: QuestionType[]; cards: StudyCard[] } | null>(null);

  if (cards.length === 0) {
    return <p className="rounded-3xl bg-surface p-8 text-center font-bold">{t("noCards")}</p>;
  }

  if (!session) {
    const toggle = (type: QuestionType) =>
      setPicked(chosen.includes(type) ? chosen.filter((x) => x !== type) : [...chosen, type]);
    return (
      <div className="space-y-4 rounded-3xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-xl font-black">{t("setupTitle")}</h2>
          <p className="text-sm text-muted">{t("setupSubtitle")}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="sr-only">{t("setupTitle")}</legend>
          {QUESTION_TYPES.map((type) => {
            const enabled = available.includes(type);
            const checked = enabled && chosen.includes(type);
            return (
              <label
                key={type}
                className={cn(
                  "flex min-h-14 items-start gap-3 rounded-2xl border-2 p-3",
                  checked ? "border-primary bg-primary-soft" : "border-border",
                  !enabled && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                  checked={checked}
                  disabled={!enabled}
                  onChange={() => toggle(type)}
                />
                <span>
                  <span className="block font-bold">{t(`types.${type}`)}</span>
                  <span className="block text-sm text-muted">
                    {enabled ? t(`typeHints.${type}`) : t(`typeUnavailable.${type}`)}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <Button
          size="lg"
          className="w-full"
          disabled={chosen.length === 0}
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(chosen));
            } catch {
              // Private mode: just don't remember.
            }
            setSession({ types: chosen, cards: eligibleCards(cards, chosen) as StudyCard[] });
          }}
        >
          {chosen.length === 0 ? t("pickOne") : t("start")}
        </Button>
      </div>
    );
  }

  return (
    <LearnSession
      key={session.types.join(",")}
      cards={session.cards}
      allCards={cards}
      types={session.types}
      onChangeTypes={() => setSession(null)}
    />
  );
}

/** Why an answer was wrong: what the terms involved actually mean. */
function Explanation({ question, picked }: { question: Question; picked?: string }) {
  const t = useTranslations("study");
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  if (question.kind === "true_false") {
    return (
      <div className="space-y-2 rounded-2xl bg-surface/70 p-3 text-sm break-words">
        {question.shownBelongsTo && <p>{t.rich("describesOther", { term: question.shownBelongsTo, strong })}</p>}
        <p>{t.rich("termMeans", { term: question.term, strong })}</p>
        <p className="font-semibold">{question.definition}</p>
      </div>
    );
  }

  if (question.kind === "mcq" && picked && picked !== question.answer) {
    return (
      <div className="space-y-2 rounded-2xl bg-surface/70 p-3 text-sm break-words">
        <p>{t.rich("youPicked", { term: picked, strong })}</p>
        <p className="font-semibold">{question.meanings[picked]}</p>
      </div>
    );
  }

  return null;
}

function LearnSession({
  cards,
  allCards,
  types,
  onChangeTypes,
}: {
  cards: StudyCard[];
  allCards: StudyCard[];
  types: QuestionType[];
  onChangeTypes: () => void;
}) {
  const t = useTranslations("study");
  const [state, setState] = useState<LearnState>(() => startLearn(cards));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [typed, setTyped] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const currentId = state.queue[0];
  // Build the question once per turn (keyed by answered count) so choices don't reshuffle on re-render.
  const question = useMemo<Question | null>(() => {
    const card = currentId ? byId.get(currentId) : undefined;
    // Distractors can come from any card in the set, not only the eligible ones.
    return card ? buildQuestion(card, allCards, state.step[card.id] ?? 0, types) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, state.answered]);

  const itemCount = question?.kind === "enumeration" ? question.items.length : 0;
  const itemValues = Array.from({ length: itemCount }, (_, i) => items[i] ?? "");

  if (isFinished(state) || !question) {
    const accuracy = state.answered ? Math.round((state.correct / state.answered) * 100) : 100;
    return (
      <div className="space-y-4 rounded-3xl bg-surface p-8 text-center">
        <PartyPopper aria-hidden className="mx-auto size-12 text-accent" />
        <h2 className="text-2xl font-black">{t("allMastered")}</h2>
        <p className="text-muted">{t("accuracy", { accuracy, answered: state.answered })}</p>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            setState(startLearn(cards));
            setFeedback(null);
          }}
        >
          {t("again")}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onChangeTypes}>
          <Settings2 aria-hidden className="size-5" /> {t("changeTypes")}
        </Button>
      </div>
    );
  }

  function submit(result: Feedback) {
    if (feedback || !result) return;
    setFeedback(result);
  }

  function next() {
    if (!feedback) return;
    setState((s) => answer(s, feedback.correct));
    setFeedback(null);
    setTyped("");
    setItems([]);
  }

  const label =
    question.kind === "mcq"
      ? t("pickTerm")
      : question.kind === "true_false"
        ? t("trueOrFalse")
        : question.kind === "identification"
          ? t("typeTerm")
          : t("enumeratePrompt", { count: question.items.length });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ProgressBar value={progress(state)} label={t("progress")} />
        <button
          type="button"
          onClick={onChangeTypes}
          aria-label={t("changeTypes")}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted active:bg-surface-2"
        >
          <Settings2 aria-hidden className="size-5" />
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-6">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">{label}</p>
        {question.kind === "true_false" ? (
          <>
            <p className="mt-3 text-xl font-black break-words">{question.term}</p>
            <p className="mt-2 text-lg break-words">{question.shownDefinition}</p>
          </>
        ) : (
          <p className={cn("mt-3 break-words", question.kind === "enumeration" ? "text-xl font-black" : "text-lg font-semibold")}>
            {question.prompt}
          </p>
        )}
      </div>

      {question.kind === "mcq" && (
        <div className="grid gap-2">
          {question.choices.map((choice) => {
            const isAnswer = choice === question.answer;
            return (
              <button
                key={choice}
                type="button"
                disabled={!!feedback}
                onClick={() => submit({ correct: isAnswer, expected: question.answer, picked: choice })}
                className={cn(
                  "min-h-14 rounded-2xl border-2 bg-surface px-4 py-3 text-left font-bold break-words active:scale-[0.99]",
                  feedback && isAnswer ? "border-success bg-success-soft" : "border-border",
                )}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}

      {question.kind === "true_false" && (
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((value) => (
            <Button
              key={String(value)}
              size="lg"
              variant="secondary"
              className={cn(feedback && question.answer === value && "border-2 border-success bg-success-soft disabled:opacity-100")}
              disabled={!!feedback}
              onClick={() =>
                submit({ correct: question.answer === value, expected: question.answer ? t("true") : t("false") })
              }
            >
              {value ? t("true") : t("false")}
            </Button>
          ))}
        </div>
      )}

      {question.kind === "identification" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (feedback) return next();
            if (typed.trim()) submit({ correct: isAnswerCorrect(typed, question.answer), expected: question.answer });
          }}
        >
          <Input
            aria-label={t("yourAnswer")}
            placeholder={t("yourAnswer")}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            readOnly={!!feedback}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          {!feedback && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => submit({ correct: false, expected: question.answer })}>
                {t("dontKnow")}
              </Button>
              <Button type="submit" disabled={!typed.trim()}>
                {t("check")}
              </Button>
            </div>
          )}
        </form>
      )}

      {question.kind === "enumeration" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (feedback) return next();
            const result = checkEnumeration(itemValues, question.items);
            submit({ correct: result.correct, expected: question.items.join(", "), missed: result.missed });
          }}
        >
          {itemValues.map((value, i) => (
            <Input
              key={i}
              aria-label={t("itemPlaceholder", { n: i + 1 })}
              placeholder={t("itemPlaceholder", { n: i + 1 })}
              value={value}
              onChange={(e) => setItems(itemValues.map((v, j) => (j === i ? e.target.value : v)))}
              readOnly={!!feedback}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
          ))}
          {!feedback && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => submit({ correct: false, expected: question.items.join(", "), missed: question.items })}
              >
                {t("dontKnow")}
              </Button>
              <Button type="submit" disabled={itemValues.every((v) => !v.trim())}>
                {t("check")}
              </Button>
            </div>
          )}
        </form>
      )}

      {feedback && (
        <div role="status" className={cn("space-y-3 rounded-3xl p-5", feedback.correct ? "bg-success-soft" : "bg-danger-soft")}>
          <p className={cn("flex items-center gap-2 text-lg font-black", feedback.correct ? "text-success" : "text-danger")}>
            {feedback.correct ? <Check aria-hidden className="size-6" /> : <X aria-hidden className="size-6" />}
            {feedback.correct ? t("correct") : t("notQuite")}
          </p>
          {!feedback.correct &&
            (feedback.missed ? (
              <div className="break-words">
                <p>{t("missed")}</p>
                <ul className="mt-1 list-disc pl-5 font-bold">
                  {feedback.missed.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="break-words">
                {t("answerWas")} <strong>{feedback.expected}</strong>
              </p>
            ))}
          {!feedback.correct && <Explanation question={question} picked={feedback.picked} />}
          <Button size="lg" className="w-full" onClick={next} autoFocus>
            {t("continue")}
          </Button>
        </div>
      )}
    </div>
  );
}
