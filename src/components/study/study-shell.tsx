"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";
import { saveSetOffline } from "@/lib/offline-cache";
import type { StudyCard } from "@/server/actions/sets";
import { Flashcards } from "./flashcards";
import { Learn } from "./learn";

/** Shared frame for study modes. Saves the set to IndexedDB for offline study. */
export function StudyShell({
  setId,
  title,
  cards,
  mode,
  online = true,
}: {
  setId: string;
  title: string;
  cards: StudyCard[];
  mode: "flashcards" | "learn";
  online?: boolean;
}) {
  const t = useTranslations("study");

  useEffect(() => {
    if (online) void saveSetOffline({ id: setId, title, cards });
  }, [online, setId, title, cards]);

  return (
    <div className="space-y-4 py-4">
      <header className="flex items-center gap-2">
        <Link
          href={online ? `/sets/${setId}` : "/offline"}
          aria-label={t("close")}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted active:bg-surface-2"
        >
          <X aria-hidden className="size-6" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted uppercase">{t(mode)}</p>
          <h1 className="truncate font-black">{title}</h1>
        </div>
      </header>
      {mode === "flashcards" ? <Flashcards cards={cards} online={online} /> : <Learn cards={cards} recordReviews={online} />}
    </div>
  );
}
