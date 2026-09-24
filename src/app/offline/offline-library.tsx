"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { keys } from "idb-keyval";
import { StudyShell } from "@/components/study/study-shell";
import { Button } from "@/components/ui";
import { loadSetOffline, type CachedSet } from "@/lib/offline-cache";

/** Lists sets saved in IndexedDB and lets the student keep studying without a connection. */
export function OfflineLibrary() {
  const t = useTranslations("offline");
  const [sets, setSets] = useState<CachedSet[] | null>(null);
  const [active, setActive] = useState<{ set: CachedSet; mode: "flashcards" | "learn" } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ids = (await keys()).map(String).filter((k) => k.startsWith("set:"));
        const loaded = await Promise.all(ids.map((k) => loadSetOffline(k.slice(4))));
        setSets(loaded.filter((s): s is CachedSet => s !== null).sort((a, b) => b.savedAt - a.savedAt));
      } catch {
        setSets([]);
      }
    })();
  }, []);

  if (active) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          ← {t("back")}
        </Button>
        <StudyShell setId={active.set.id} title={active.set.title} cards={active.set.cards} mode={active.mode} online={false} />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div className="space-y-2 text-center">
        <WifiOff aria-hidden className="mx-auto size-12 text-muted" />
        <h1 className="text-2xl font-black">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {sets && sets.length === 0 && <p className="text-center font-bold">{t("none")}</p>}
      <ul className="space-y-2">
        {sets?.map((s) => (
          <li key={s.id} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
            <p className="font-bold">{s.title}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => setActive({ set: s, mode: "flashcards" })}>
                {t("flashcards")}
              </Button>
              <Button size="sm" variant="accent" onClick={() => setActive({ set: s, mode: "learn" })}>
                {t("learn")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>
        {t("retry")}
      </Button>
    </div>
  );
}
