import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { countDueCards } from "@/server/db/queries/sets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("review") };
}

// Spaced repetition arrives in Phase 2; for now this shows what's due.
export default async function ReviewPage() {
  const { user } = await requireUser();
  const t = await getTranslations("review");
  const due = await countDueCards(user.id);
  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <div className="space-y-3 rounded-3xl bg-surface p-8 text-center">
        <CalendarClock aria-hidden className="mx-auto size-12 text-primary" />
        <p className="text-xl font-black">{t("due", { count: due })}</p>
        <p className="text-muted">{t("comingSoon")}</p>
        <Link href="/home" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary">
          {t("pickSet")}
        </Link>
      </div>
    </div>
  );
}
