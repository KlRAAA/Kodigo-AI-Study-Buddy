import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SetTile } from "@/components/public/set-tile";
import { requireUser } from "@/server/auth";
import { exploreSets } from "@/server/db/queries/community";
import { listSets } from "@/server/db/queries/sets";
import { SearchBox } from "./search-box";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("search") };
}

/** One place to search: your own library first, then public sets. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { user } = await requireUser();
  const t = await getTranslations("search");
  const tHome = await getTranslations("home");
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const [mine, publicSets] = query
    ? await Promise.all([listSets(user.id, query), exploreSets({ query, sort: "top", page: 1 })])
    : [[], []];

  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <SearchBox initial={query} />

      {!query ? (
        <p className="text-center text-muted">{t("hint")}</p>
      ) : (
        <>
          <section aria-labelledby="mine-heading" className="space-y-2">
            <h2 id="mine-heading" className="text-lg font-black">
              {t("yourSets")}
            </h2>
            {mine.length === 0 ? (
              <p className="text-sm text-muted">{t("noneMine")}</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sets/${s.id}`} className="card-hover block rounded-2xl border border-border bg-surface p-4">
                      <span className="block truncate font-bold">{s.title}</span>
                      <span className="block text-sm text-muted">
                        {tHome("cardCount", { count: s.cardCount })}
                        {s.subject ? ` · ${s.subject}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="public-heading" className="space-y-2">
            <h2 id="public-heading" className="text-lg font-black">
              {t("publicSets")}
            </h2>
            {publicSets.length === 0 ? (
              <p className="text-sm text-muted">{t("nonePublic")}</p>
            ) : (
              <div className="space-y-2">
                {publicSets.map((s) => (
                  <SetTile key={s.slug} set={s} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
