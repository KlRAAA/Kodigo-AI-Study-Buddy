"use client";

import { PartyPopper, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorMessage } from "@/components/form";
import { SpeakButton } from "@/components/study/speak-button";
import { Button, ProgressBar } from "@/components/ui";
import { GRADES, previewIntervals, type Grade, type ReviewState } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { reviewCardAction } from "@/server/actions/reviews";
import type { ErrorCode } from "@/server/actions/result";

export type SessionCard = {
  id: string;
  term: string;
  definition: string;
  example: string | null;
  setTitle: string;
  state: ReviewState;
};

const gradeStyle: Record<Grade, string> = {
  again: "bg-danger-soft text-danger",
  hard: "bg-accent-soft text-text",
  good: "bg-primary-soft text-primary",
  easy: "bg-success-soft text-success",
};

export function ReviewSession({ cards, title }: { cards: SessionCard[]; title: string }) {
  const t = useTranslations("review");
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<ErrorCode | null>(null);

  const card = queue[0];
  const total = cards.length;

  function grade(g: Grade) {
    if (!card) return;
    setRevealed(false);
    // "Again" cards come back at the end of this session; others are finished for now.
    setQueue(([first, ...rest]) => (g === "again" && first ? [...rest, first] : rest));
    if (g !== "again") setDone((n) => n + 1);
    void reviewCardAction(card.id, g).then((res) => {
      if (!res.ok) setError(res.error);
    });
  }

  if (!card) {
    return (
      <div className="space-y-4 rounded-3xl bg-surface p-8 text-center">
        <PartyPopper aria-hidden className="mx-auto size-12 text-accent" />
        <h2 className="text-2xl font-black">{t("doneTitle")}</h2>
        <p className="text-muted">{t("doneBody", { count: done })}</p>
        <ErrorMessage code={error} />
        <Link href="/review" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary">
          {t("backToReview")}
        </Link>
      </div>
    );
  }

  const preview = previewIntervals(card.state);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Link
          href="/review"
          aria-label={t("close")}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted active:bg-surface-2"
        >
          <X aria-hidden className="size-6" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted uppercase">{t("title")}</p>
          <h1 className="truncate font-black">{title}</h1>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <ProgressBar value={done / total} label={t("progress")} />
        <span className="shrink-0 text-sm font-bold text-muted tabular-nums">
          {done}/{total}
        </span>
      </div>

      <div className="relative flex min-h-[22rem] flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-surface p-6 text-center shadow-sm">
        <SpeakButton
          text={revealed ? [card.term, card.definition, card.example].filter(Boolean).join(". ") : card.term}
          className="absolute top-3 right-3"
        />
        <p className="text-xs font-semibold text-muted">{card.setTitle}</p>
        <p className="text-2xl font-black break-words">{card.term}</p>
        {revealed && (
          <div className="w-full space-y-2 border-t border-border pt-4">
            <p className="text-lg font-semibold break-words">{card.definition}</p>
            {card.example && <p className="text-sm break-words italic">{card.example}</p>}
          </div>
        )}
      </div>

      {!revealed ? (
        <Button size="lg" className="w-full" onClick={() => setRevealed(true)} autoFocus>
          {t("showAnswer")}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted">{t("howWell")}</p>
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => grade(g)}
                className={cn(
                  "card-hover flex min-h-16 flex-col items-center justify-center rounded-2xl font-bold active:scale-[0.97]",
                  gradeStyle[g],
                )}
              >
                <span>{t(`grades.${g}`)}</span>
                <span className="text-xs font-semibold opacity-80">{preview[g]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <ErrorMessage code={error} />
    </div>
  );
}
