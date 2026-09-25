import { ArrowLeft, Brain, Layers } from "lucide-react";
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SharePanel } from "@/components/share/share-panel";
import { requireUser } from "@/server/auth";
import { listCards } from "@/server/db/queries/cards";
import { getSet } from "@/server/db/queries/sets";
import { appOrigin } from "@/server/request";
import { CardEditor } from "./card-editor";
import { SetHeader } from "./set-header";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cached so generateMetadata and the page share one lookup.
const load = cache(async (id: string) => {
  if (!uuid.test(id)) notFound();
  const { user, profile } = await requireUser();
  const set = await getSet(user.id, id);
  if (!set) notFound();
  return { user, profile, set };
});

export async function generateMetadata({ params }: PageProps<"/sets/[id]">): Promise<Metadata> {
  const { set } = await load((await params).id);
  return { title: set.title };
}

export default async function SetPage({ params }: PageProps<"/sets/[id]">) {
  const { user, profile, set } = await load((await params).id);
  const [cards, t, origin] = await Promise.all([listCards(user.id, set.id), getTranslations("set"), appOrigin()]);
  const shareUrl = set.shareSlug ? `${origin}/s/${set.shareSlug}` : null;

  return (
    <div className="space-y-5 py-4">
      <Link href="/home" className="inline-flex min-h-10 items-center gap-1 font-bold text-muted">
        <ArrowLeft aria-hidden className="size-5" /> {t("back")}
      </Link>

      <SetHeader setId={set.id} title={set.title} subject={set.subject ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/sets/${set.id}/flashcards`}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-3xl bg-primary font-bold text-on-primary active:scale-[0.98]"
        >
          <Layers aria-hidden className="size-6" /> {t("flashcards")}
        </Link>
        <Link
          href={`/sets/${set.id}/learn`}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-3xl bg-accent font-bold text-on-accent active:scale-[0.98]"
        >
          <Brain aria-hidden className="size-6" /> {t("learn")}
        </Link>
      </div>

      <SharePanel
        setId={set.id}
        visibility={set.visibility}
        status={set.moderationStatus}
        reasonCategories={(set.moderationReason ?? "").split(",").filter(Boolean)}
        shareUrl={shareUrl}
        handle={profile.handle}
      />

      {set.summary && (
        <details open className="rounded-3xl border border-border bg-surface p-5">
          <summary className="cursor-pointer text-lg font-black">{t("summary")}</summary>
          <div className="prose-kodigo mt-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{set.summary}</ReactMarkdown>
          </div>
        </details>
      )}

      <CardEditor
        setId={set.id}
        initial={cards.map((c) => ({
          id: c.id,
          term: c.term,
          definition: c.definition,
          example: c.example,
          starred: c.starred,
        }))}
      />
    </div>
  );
}
