import { Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Card } from "@/components/ui";
import { isAdminEmail, requireUser } from "@/server/auth";
import { remainingAllowance } from "@/server/limits/limiter";
import { DeleteAccount, DisplayNameForm, SignOutButton } from "./profile-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("profile") };
}

export default async function ProfilePage() {
  const { user, profile } = await requireUser();
  const t = await getTranslations("profile");
  const allowance = await remainingAllowance(user.id);

  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <Card className="space-y-4">
        <DisplayNameForm initial={profile.displayName ?? user.name} />
        <p className="text-sm text-muted">{user.email}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-black">{t("language")}</h2>
        <LanguageSwitcher />
      </Card>

      <Card className="space-y-2">
        <h2 className="font-black">{t("allowanceTitle")}</h2>
        <ul className="space-y-1 text-sm">
          {(["generation", "assist", "tutor"] as const).map((kind) => (
            <li key={kind} className="flex justify-between">
              <span>{t(`allowance.${kind}`)}</span>
              <span className="font-bold tabular-nums">
                {Math.max(0, allowance[kind].limit - allowance[kind].used)}/{allowance[kind].limit}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t("allowanceReset")}</p>
      </Card>

      {isAdminEmail(user.email) && (
        <Link href="/admin" className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-5 font-bold">
          <Shield aria-hidden className="size-5" /> {t("admin")}
        </Link>
      )}

      <div className="space-y-2">
        <SignOutButton />
        <p className="text-center text-sm">
          <Link href="/privacy" className="underline">
            {t("privacy")}
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline">
            {t("terms")}
          </Link>
        </p>
      </div>

      <DeleteAccount />
    </div>
  );
}
