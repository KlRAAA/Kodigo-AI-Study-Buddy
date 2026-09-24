import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SetTile } from "@/components/public/set-tile";
import { requireUser } from "@/server/auth";
import { exploreSets } from "@/server/db/queries/community";
import { ExploreSearch } from "./explore-search";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title") };
}

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  await requireUser();
  const t = await getTranslations("explore");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const sort = sp.sort === "new" || sp.sort === "copied" ? sp.sort : "top";
  const pageNum = Number(sp.page);
  const page = Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= 500 ? pageNum : 1;
  const sets = await exploreSets({ query: q, sort, page });

  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <ExploreSearch q={q} sort={sort} />
      {sets.length === 0 ? (
        <p className="rounded-3xl bg-surface p-8 text-center font-bold">{t("empty")}</p>
      ) : (
        <div className="space-y-2">{sets.map((s) => <SetTile key={s.slug} set={s} />)}</div>
      )}
      <div className="flex justify-between">
        {page > 1 ? <Link href={`/explore?${new URLSearchParams({ q, sort, page: String(page - 1) })}`} className="font-bold text-primary">← {t("prev")}</Link> : <span />}
        {sets.length === 20 ? <Link href={`/explore?${new URLSearchParams({ q, sort, page: String(page + 1) })}`} className="font-bold text-primary">{t("next")} →</Link> : <span />}
      </div>
    </div>
  );
}
