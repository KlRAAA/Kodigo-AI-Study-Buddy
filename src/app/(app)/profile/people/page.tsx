import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { listFollowers, listFollowing } from "@/server/db/queries/community";
import { RemoveFollowerButton } from "./remove-button";

export default async function PeoplePage() {
  const { user } = await requireUser();
  const t = await getTranslations("community");
  const [followers, following] = await Promise.all([listFollowers(user.id), listFollowing(user.id)]);
  const row = (p: { handle: string | null; displayName: string | null }) =>
    p.handle ? (
      <Link href={`/u/${p.handle}`} className="font-bold">
        {p.displayName ?? `@${p.handle}`} <span className="text-muted">@{p.handle}</span>
      </Link>
    ) : (
      <span>{p.displayName}</span>
    );

  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("people")}</h1>
      <section className="space-y-2">
        <h2 className="font-black">
          {t("followersLabel")} ({followers.length})
        </h2>
        <ul className="divide-y divide-border rounded-2xl bg-surface px-4">
          {followers.map((f) => (
            <li key={f.userId} className="flex min-h-14 items-center justify-between gap-2">
              {row(f)}
              <RemoveFollowerButton userId={f.userId} />
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-black">
          {t("followingLabel")} ({following.length})
        </h2>
        <ul className="divide-y divide-border rounded-2xl bg-surface px-4">
          {following.map((f) => (
            <li key={f.userId} className="flex min-h-14 items-center">
              {row(f)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
