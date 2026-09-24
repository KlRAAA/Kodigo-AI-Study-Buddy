import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ListedSet } from "@/server/db/queries/community";

export async function SetTile({ set, showOwner = true }: { set: ListedSet; showOwner?: boolean }) {
  const t = await getTranslations("community");
  return (
    <Link href={`/s/${set.slug}`} className="block rounded-2xl border border-border bg-surface p-4 active:bg-surface-2">
      <span className="block truncate font-bold">{set.title}</span>
      <span className="block text-sm text-muted">
        {showOwner && set.ownerHandle ? `@${set.ownerHandle} · ` : ""}
        {t("cards", { count: set.cardCount })}
        {set.ratingCount > 0 ? ` · ★ ${set.ratingAvg.toFixed(1)} (${set.ratingCount})` : ""}
        {set.copyCount > 0 ? ` · ${t("copies", { count: set.copyCount })}` : ""}
      </span>
    </Link>
  );
}
