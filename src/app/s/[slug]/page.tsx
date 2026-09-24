import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PublicHeader } from "@/components/public/public-header";
import { Flashcards } from "@/components/study/flashcards";
import { getPublicSetBySlug } from "@/server/db/queries/sharing";

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

          {/* Task 11 adds: rating stars, copy, report, Learn buttons here */}
          <div id="public-actions" />

          <Flashcards cards={view.cards.map((c) => ({ ...c, starred: false }))} online={false} canStar={false} />

          {view.summary && (
            <details className="rounded-3xl border border-border bg-surface p-5">
              <summary className="cursor-pointer text-lg font-black">{t("summary")}</summary>
              <div className="prose-kodigo mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{view.summary}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
