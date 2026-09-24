import { Brain, CalendarClock, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { listSetsWithDue } from "@/server/db/queries/sets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("review") };
}

// Spaced repetition arrives in Phase 2; for now this lists sets with what's due
// and jumps straight into a study mode.
export default async function ReviewPage() {
  const { user } = await requireUser();
  const t = await getTranslations("review");
  const tHome = await getTranslations("home");
  const sets = await listSetsWithDue(user.id);
  const totalDue = sets.reduce((sum, s) => sum + s.dueCount, 0);

  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="flex items-center gap-4 rounded-3xl bg-primary p-5 text-on-primary">
        <CalendarClock aria-hidden className="size-10 shrink-0 opacity-80" />
        <div>
          <p className="text-xl font-black">{t("due", { count: totalDue })}</p>
          <p className="text-sm opacity-80">{t("comingSoon")}</p>
        </div>
      </div>

      {sets.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border p-8 text-center">
          <p className="font-bold">{tHome("empty")}</p>
          <Link
            href="/create"
            className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary"
          >
            {tHome("createFirst")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {sets.map((s) => (
            <li key={s.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <Link href={`/sets/${s.id}`} className="block">
                <span className="block truncate font-bold">{s.title}</span>
                <span className="block text-sm text-muted">
                  {t("setDue", { due: s.dueCount, total: s.cardCount })}
                  {s.subject ? ` · ${s.subject}` : ""}
                </span>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/sets/${s.id}/flashcards`}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-soft font-bold text-primary active:scale-[0.98]"
                >
                  <Layers aria-hidden className="size-4" /> {t("flashcards")}
                </Link>
                <Link
                  href={`/sets/${s.id}/learn`}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft font-bold active:scale-[0.98]"
                >
                  <Brain aria-hidden className="size-4" /> {t("learn")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
