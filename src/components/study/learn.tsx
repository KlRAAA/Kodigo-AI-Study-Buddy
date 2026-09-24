"use client";

import { Check, PartyPopper, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button, Input, ProgressBar } from "@/components/ui";
import { isAnswerCorrect } from "@/lib/answer-match";
import { answer, buildQuestion, isFinished, progress, startLearn, type LearnState, type Question } from "@/lib/learn";
import { cn } from "@/lib/utils";
import type { StudyCard } from "@/server/actions/sets";

type Feedback = { correct: boolean; expected: string } | null;

export function Learn({ cards }: { cards: StudyCard[] }) {
  const t = useTranslations("study");
  const [state, setState] = useState<LearnState>(() => startLearn(cards));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [typed, setTyped] = useState("");
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const currentId = state.queue[0];
  // Build the question once per turn (keyed by answered count) so choices don't reshuffle on re-render.
  const question = useMemo<Question | null>(() => {
    const card = currentId ? byId.get(currentId) : undefined;
    return card ? buildQuestion(card, cards, state.step[card.id] ?? 0) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, state.answered]);

  if (cards.length === 0) {
    return <p className="rounded-3xl bg-surface p-8 text-center font-bold">{t("noCards")}</p>;
  }

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
      </div>
    );
  }

  function submit(correct: boolean, expected: string) {
    if (feedback) return;
    setFeedback({ correct, expected });
  }

  function next() {
    if (!feedback) return;
    setState((s) => answer(s, feedback.correct));
    setFeedback(null);
    setTyped("");
  }

  return (
    <div className="space-y-5">
      <ProgressBar value={progress(state)} label={t("progress")} />

      <div className="rounded-3xl border border-border bg-surface p-6">
        {question.kind === "true_false" ? (
          <>
            <p className="text-xs font-bold tracking-wide text-muted uppercase">{t("trueOrFalse")}</p>
            <p className="mt-3 text-xl font-black break-words">{question.term}</p>
            <p className="mt-2 text-lg break-words">{question.shownDefinition}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold tracking-wide text-muted uppercase">
              {question.kind === "mcq" ? t("pickTerm") : t("typeTerm")}
            </p>
            <p className="mt-3 text-lg font-semibold break-words">{question.prompt}</p>
          </>
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
                onClick={() => submit(isAnswer, question.answer)}
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
          <Button size="lg" variant="secondary" disabled={!!feedback} onClick={() => submit(question.answer === true, question.answer ? t("true") : t("false"))}>
            {t("true")}
          </Button>
          <Button size="lg" variant="secondary" disabled={!!feedback} onClick={() => submit(question.answer === false, question.answer ? t("true") : t("false"))}>
            {t("false")}
          </Button>
        </div>
      )}

      {question.kind === "typed" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (feedback) return next();
            if (typed.trim()) submit(isAnswerCorrect(typed, question.answer), question.answer);
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
              <Button type="button" variant="ghost" onClick={() => submit(false, question.answer)}>
                {t("dontKnow")}
              </Button>
              <Button type="submit" disabled={!typed.trim()}>
                {t("check")}
              </Button>
            </div>
          )}
        </form>
      )}

      {feedback && (
        <div
          role="status"
          className={cn("space-y-3 rounded-3xl p-5", feedback.correct ? "bg-success-soft" : "bg-danger-soft")}
        >
          <p className={cn("flex items-center gap-2 text-lg font-black", feedback.correct ? "text-success" : "text-danger")}>
            {feedback.correct ? <Check aria-hidden className="size-6" /> : <X aria-hidden className="size-6" />}
            {feedback.correct ? t("correct") : t("notQuite")}
          </p>
          {!feedback.correct && (
            <p className="break-words">
              {t("answerWas")} <strong>{feedback.expected}</strong>
            </p>
          )}
          <Button size="lg" className="w-full" onClick={next} autoFocus>
            {t("continue")}
          </Button>
        </div>
      )}
    </div>
  );
}
