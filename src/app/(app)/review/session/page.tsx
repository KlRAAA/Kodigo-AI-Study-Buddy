import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { listDueCards } from "@/server/db/queries/reviews";
import { ReviewSession } from "./review-session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("review");
  return { title: t("title") };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A spaced-repetition session over everything due (or one set with ?set=<id>). */
export default async function ReviewSessionPage({ searchParams }: PageProps<"/review/session">) {
  const { user } = await requireUser();
  const t = await getTranslations("review");
  const { set } = await searchParams;
  const setId = typeof set === "string" && uuid.test(set) ? set : undefined;
  const due = await listDueCards(user.id, { setId, limit: 50 });

  if (due.length === 0) {
    return (
      <div className="space-y-4 py-4">
        <p className="rounded-3xl bg-surface p-8 text-center font-bold">{t("nothingDue")}</p>
        <Link href="/review" className="block text-center font-bold text-primary">
          {t("backToReview")}
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      <ReviewSession
        title={setId ? due[0]!.setTitle : t("allSets")}
        cards={due.map((c) => ({
          id: c.id,
          term: c.term,
          definition: c.definition,
          example: c.example,
          setTitle: c.setTitle,
          state: c.state,
        }))}
      />
    </div>
  );
}
