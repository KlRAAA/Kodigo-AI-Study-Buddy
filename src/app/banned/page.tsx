import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/logo";
import { SignOutButton } from "@/app/(app)/profile/profile-forms";
import { getSessionUser } from "@/server/auth";
import { getOrCreateProfile } from "@/server/db/queries/profiles";

export default async function BannedPage() {
  const t = await getTranslations("banned");
  const user = await getSessionUser();
  const profile = user ? await getOrCreateProfile(user.id) : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <LogoMark className="size-16" />
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <p className="text-muted">{t("body")}</p>
      {profile?.banReason && <p className="rounded-2xl bg-surface p-3 text-sm">{t("reason", { reason: profile.banReason })}</p>}
      {user && <SignOutButton />}
    </main>
  );
}
