"use client";

import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { Button, ProgressBar } from "@/components/ui";
import { cn, shuffle } from "@/lib/utils";
import { toggleStarAction, type StudyCard } from "@/server/actions/sets";
import { SpeakButton } from "./speak-button";

export function Flashcards({
  cards: initial,
  online = true,
  canStar = true,
}: {
  cards: StudyCard[];
  online?: boolean;
  canStar?: boolean;
}) {
  const t = useTranslations("study");
  const [cards, setCards] = useState(initial);
  const [order, setOrder] = useState(() => initial.map((c) => c.id));
  const [starredOnly, setStarredOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchX = useRef<number | null>(null);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const visible = order.map((id) => byId.get(id)!).filter((c) => c && (!starredOnly || c.starred));
  const card = visible[Math.min(index, visible.length - 1)];

  function go(delta: number) {
    if (visible.length === 0) return;
    setFlipped(false);
    setIndex((i) => (i + delta + visible.length) % visible.length);
  }

  function toggleStar(c: StudyCard) {
    setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, starred: !x.starred } : x)));
    if (online) void toggleStarAction(c.id, !c.starred);
  }

  if (!card) {
    return (
      <div className="space-y-4 rounded-3xl bg-surface p-8 text-center">
        <p className="font-bold">{starredOnly ? t("noStarred") : t("noCards")}</p>
        {starredOnly && (
          <Button variant="secondary" onClick={() => setStarredOnly(false)}>
            {t("showAll")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ProgressBar value={(index + 1) / visible.length} label={t("progress")} />
        <span className="shrink-0 text-sm font-bold text-muted tabular-nums">
          {Math.min(index, visible.length - 1) + 1}/{visible.length}
        </span>
      </div>

      <div
        className="flip-card relative"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null) return;
          if (end - start < -50) go(1);
          else if (end - start > 50) go(-1);
        }}
      >
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? t("showTerm") : t("showDefinition")}
          className={cn("flip-inner relative grid min-h-[22rem] w-full", flipped && "flipped")}
        >
          <span className="flip-face col-start-1 row-start-1 flex flex-col items-center justify-center rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <span className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">{t("term")}</span>
            <span className="text-2xl font-black break-words">{card.term}</span>
          </span>
          <span className="flip-face flip-back col-start-1 row-start-1 flex flex-col items-center justify-center rounded-3xl border border-primary bg-primary-soft p-6 shadow-sm">
            <span className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">{t("definition")}</span>
            <span className="text-lg font-semibold break-words">{card.definition}</span>
            {card.example && <span className="mt-3 text-sm break-words italic">{card.example}</span>}
          </span>
        </button>
        <SpeakButton
          text={flipped ? [card.definition, card.example].filter(Boolean).join(". ") : card.term}
          className="absolute top-3 right-3 z-10"
        />
      </div>
      <p className="text-center text-xs text-muted">{t("tapToFlip")}</p>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" size="lg" aria-label={t("previous")} onClick={() => go(-1)}>
          <ChevronLeft aria-hidden className="size-6" />
        </Button>
        {canStar ? (
          <Button
            variant="secondary"
            size="lg"
            aria-label={card.starred ? t("unstar") : t("star")}
            aria-pressed={card.starred}
            onClick={() => toggleStar(card)}
          >
            <Star aria-hidden className={cn("size-6", card.starred && "fill-accent text-accent")} />
          </Button>
        ) : (
          <span aria-hidden />
        )}
        <Button size="lg" aria-label={t("next")} onClick={() => go(1)}>
          <ChevronRight aria-hidden className="size-6" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOrder(shuffle(order));
            setIndex(0);
            setFlipped(false);
          }}
        >
          <Shuffle aria-hidden className="size-4" /> {t("shuffle")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOrder(initial.map((c) => c.id));
            setIndex(0);
            setFlipped(false);
          }}
        >
          <RotateCcw aria-hidden className="size-4" /> {t("restart")}
        </Button>
        {canStar && (
          <Button
            variant={starredOnly ? "accent" : "ghost"}
            size="sm"
            aria-pressed={starredOnly}
            onClick={() => {
              setStarredOnly((s) => !s);
              setIndex(0);
              setFlipped(false);
            }}
          >
            <Star aria-hidden className="size-4" /> {t("starredOnly")}
          </Button>
        )}
      </div>
    </div>
  );
}
