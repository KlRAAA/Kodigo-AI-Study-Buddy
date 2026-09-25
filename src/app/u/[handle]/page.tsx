import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { FollowButton } from "@/components/public/follow-button";
import { PublicHeader } from "@/components/public/public-header";
import { SetTile } from "@/components/public/set-tile";
import { handleSchema } from "@/lib/handle";
import { getSessionUser } from "@/server/auth";
import { getPublicProfile, isFollowing } from "@/server/db/queries/community";

// Cached so generateMetadata and the page share one lookup.
const load = cache(async (raw: string) => {
  const h = handleSchema.safeParse(raw);
  if (!h.success) notFound();
  const profile = await getPublicProfile(h.data);
  if (!profile) notFound();
  return profile;
});

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  const p = await load((await params).handle);
  return { title: `@${p.handle}`, robots: { index: false } };
}

export default async function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  const p = await load((await params).handle);
  const t = await getTranslations("community");
  const format = await getFormatter();
  const user = await getSessionUser();
  const signedIn = Boolean(user?.emailVerified);
  const isMe = user?.id === p.userId;
  const following = signedIn && !isMe ? await isFollowing(user!.id, p.userId) : false;

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-xl px-4 pb-10">
      <PublicHeader />
      {p.banned ? (
        <p className="rounded-3xl bg-surface p-8 text-center font-bold">{t("unavailable")}</p>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-black">{p.displayName ?? `@${p.handle}`}</h1>
            <p className="text-sm text-muted">
              @{p.handle} · {t("joined", { date: format.dateTime(p.joined, { month: "long", year: "numeric" }) })}
            </p>
            <p className="text-sm">
              <strong>{p.followers}</strong> {t("followersLabel")} · <strong>{p.following}</strong> {t("followingLabel")}
              {p.ratingAvg !== null ? ` · ★ ${p.ratingAvg.toFixed(1)} (${p.ratingTotal})` : ""}
            </p>
            {!isMe && <FollowButton handle={p.handle} following={following} signedIn={signedIn} />}
          </div>
          <section className="space-y-2">
            <h2 className="text-lg font-black">{t("publicSets")}</h2>
            {p.sets.length === 0 ? (
              <p className="text-muted">{t("noPublicSets")}</p>
            ) : (
              p.sets.map((s) => <SetTile key={s.slug} set={s} showOwner={false} />)
            )}
          </section>
        </div>
      )}
    </main>
  );
}
