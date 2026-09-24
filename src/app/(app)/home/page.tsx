import { BookOpen, Camera, FileText, Presentation, Type } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AllowanceChip } from "@/components/allowance-chip";
import { requireUser } from "@/server/auth";
import { countDueCards, listSets } from "@/server/db/queries/sets";
import type { SourceType } from "@/server/db/schema";
import { SearchBox } from "./search-box";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("home") };
}

const sourceIcons: Record<SourceType, typeof FileText> = {
  text: Type,
  pdf: FileText,
  pptx: Presentation,
  photo: Camera,
  quizlet: BookOpen,
};

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const { user, profile } = await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  const t = await getTranslations("home");
  const format = await getFormatter();
  const [sets, due] = await Promise.all([listSets(user.id, query), countDueCards(user.id)]);

  return (
    <div className="space-y-5 py-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted">{t("hello")}</p>
          <h1 className="text-2xl font-black">{profile.displayName || user.name}</h1>
        </div>
        <AllowanceChip userId={user.id} />
      </header>

      <Link
        href="/review"
        className="flex items-center justify-between rounded-3xl bg-primary p-5 text-on-primary active:scale-[0.99]"
      >
        <span>
          <span className="block text-sm font-bold opacity-80">{t("dueToday")}</span>
          <span className="text-3xl font-black">{t("dueCount", { count: due })}</span>
        </span>
        <BookOpen aria-hidden className="size-10 opacity-80" />
      </Link>

      <SearchBox initial={query} />

      <section aria-labelledby="library-heading" className="space-y-3">
        <h2 id="library-heading" className="text-lg font-black">
          {t("library")}
        </h2>
        {sets.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-border p-8 text-center">
            <p className="font-bold">{query ? t("noResults") : t("empty")}</p>
            {!query && (
              <Link
                href="/create"
                className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary"
              >
                {t("createFirst")}
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => {
              const Icon = sourceIcons[s.sourceType];
              return (
                <li key={s.id}>
                  <Link
                    href={`/sets/${s.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:bg-surface-2"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{s.title}</span>
                      <span className="block text-sm text-muted">
                        {t("cardCount", { count: s.cardCount })}
                        {s.subject ? ` · ${s.subject}` : ""} · {format.relativeTime(s.updatedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
