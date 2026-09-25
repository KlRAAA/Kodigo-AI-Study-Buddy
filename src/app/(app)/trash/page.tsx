import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { listTrash, purgeTrash } from "@/server/db/queries/sets";
import { TrashActions } from "./trash-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trash");
  return { title: t("title") };
}

export default async function TrashPage() {
  const { user } = await requireUser();
  await purgeTrash(user.id);
  const t = await getTranslations("trash");
  const format = await getFormatter();
  const sets = await listTrash(user.id);

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="text-2xl font-black">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

      {sets.length === 0 ? (
        <div className="space-y-3 rounded-3xl border-2 border-dashed border-border p-10 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Trash2 aria-hidden className="size-8" />
          </span>
          <p className="font-bold">{t("empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sets.map((s) => {
            const deletedAt = new Date(s.deletedAt);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.title}</p>
                  <p className="text-sm text-muted">
                    {t("cards", { count: s.cardCount })} · {t("deletedAgo", { when: format.relativeTime(deletedAt) })} ·{" "}
                    {t("daysLeft", { days: s.daysLeft })}
                  </p>
                </div>
                <TrashActions setId={s.id} title={s.title} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
