import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/public/copy-button";
import { PublicHeader } from "@/components/public/public-header";
import { RatingStars } from "@/components/public/rating-stars";
import { ReportButton } from "@/components/public/report-button";
import { Flashcards } from "@/components/study/flashcards";
import { getSessionUser } from "@/server/auth";
import { getMyRating } from "@/server/db/queries/community";
import { getPublicSetBySlug, isSetOwner } from "@/server/db/queries/sharing";

const SLUG = /^[0-9A-Za-z]{10}$/;

async function load(slug: string) {
  if (!SLUG.test(slug)) notFound();
  const view = await getPublicSetBySlug(slug);
  if (!view) notFound();
  return view;
}

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const view = await load((await params).slug);
  return { title: "updating" in view ? "Kodigo" : view.title, robots: { index: false } };
}

export default async function PublicSetPage({ params }: PageProps<"/s/[slug]">) {
  const view = await load((await params).slug);
  const t = await getTranslations("public");
  const user = await getSessionUser();
  const signedIn = Boolean(user?.emailVerified);
  const isOwner = Boolean(user) && !("updating" in view) && (await isSetOwner(user!.id, view.id));
  const myRating = signedIn && !isOwner && !("updating" in view) ? await getMyRating(user!.id, view.id) : null;

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-xl px-4 pb-10">
      <PublicHeader />
      {"updating" in view ? (
        <p className="rounded-3xl bg-surface p-8 text-center font-bold">{t("updating")}</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl leading-tight font-black break-words">{view.title}</h1>
            <p className="text-sm text-muted">
              {view.ownerHandle && (
                <Link href={`/u/${view.ownerHandle}`} className="font-bold text-primary">
                  @{view.ownerHandle}
                </Link>
              )}
              {view.subject ? ` · ${view.subject}` : ""} · {t("cardCount", { count: view.cards.length })}
              {view.ratingCount > 0 ? ` · ★ ${view.ratingAvg.toFixed(1)} (${view.ratingCount})` : ""}
            </p>
            {view.copiedFromHandle && <p className="text-xs text-muted">{t("copiedFrom", { handle: view.copiedFromHandle })}</p>}
          </div>

          {isOwner ? (
            <p className="rounded-2xl bg-surface p-3 text-sm">
              {t.rich("yourSet", {
                link: (c) => (
                  <Link href={`/sets/${view.id}`} className="font-bold text-primary underline">
                    {c}
                  </Link>
                ),
              })}
            </p>
          ) : (
            <div id="public-actions" className="space-y-3">
              <CopyButton setId={view.id} signedIn={signedIn} />
              <p className="text-xs text-muted">{t("learnAfterCopy")}</p>
              <div className="flex items-center justify-between rounded-2xl bg-surface p-3">
                <span className="text-sm font-bold">{t("rateThis")}</span>
                <RatingStars setId={view.id} initial={myRating} signedIn={signedIn} />
              </div>
            </div>
          )}

          <Flashcards cards={view.cards.map((c) => ({ ...c, starred: false }))} online={false} canStar={false} />

          {view.summary && (
            <details className="rounded-3xl border border-border bg-surface p-5">
              <summary className="cursor-pointer text-lg font-black">{t("summary")}</summary>
              <div className="prose-kodigo mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{view.summary}</ReactMarkdown>
              </div>
            </details>
          )}

          {!isOwner && <ReportButton setId={view.id} signedIn={signedIn} />}
        </div>
      )}
    </main>
  );
}
