import { BookOpen, Camera, Compass, FileText, Presentation, Type } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AllowanceChip } from "@/components/allowance-chip";
import { SetTile } from "@/components/public/set-tile";
import { SetCardActions } from "@/components/set-card-actions";
import { requireUser } from "@/server/auth";
import { followFeed } from "@/server/db/queries/community";
import { countDueCards, listSets } from "@/server/db/queries/sets";
import type { SourceType } from "@/server/db/schema";

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

export default async function HomePage() {
  const { user, profile } = await requireUser();
  const t = await getTranslations("home");
  const format = await getFormatter();
  const [sets, due, feed] = await Promise.all([listSets(user.id), countDueCards(user.id), followFeed(user.id)]);

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

      <Link href="/explore" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface font-bold active:bg-surface-2">
        <Compass aria-hidden className="size-5 text-primary" /> {t("explore")}
      </Link>
      {feed.length > 0 && (
        <section aria-labelledby="feed-heading" className="space-y-2">
          <h2 id="feed-heading" className="text-lg font-black">{t("fromFollowing")}</h2>
          <div className="space-y-2">{feed.map((s) => <SetTile key={s.slug} set={s} />)}</div>
        </section>
      )}


      <section aria-labelledby="library-heading" className="space-y-3">
        <h2 id="library-heading" className="text-lg font-black">
          {t("library")}
        </h2>
        {sets.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-border p-8 text-center">
            <p className="font-bold">{t("empty")}</p>
            <Link
              href="/create"
              className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary"
            >
              {t("createFirst")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => {
              const Icon = sourceIcons[s.sourceType];
              return (
                <li key={s.id} className="flex items-center gap-1 rounded-2xl border border-border bg-surface pr-1">
                  <Link
                    href={`/sets/${s.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-4 active:bg-surface-2"
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
                  <SetCardActions setId={s.id} title={s.title} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
