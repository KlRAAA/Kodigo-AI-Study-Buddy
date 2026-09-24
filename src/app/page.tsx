import { Camera, FileText, Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { getSessionUser } from "@/server/auth";

export default async function Landing() {
  const user = await getSessionUser();
  if (user?.emailVerified) redirect("/home");
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");

  const features = [
    { Icon: FileText, text: t("f1") },
    { Icon: Camera, text: t("f2") },
    { Icon: Layers, text: t("f3") },
    { Icon: Sparkles, text: t("f4") },
  ];

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="py-4">
        <Logo />
      </div>
      <section className="flex-1 space-y-6 py-6">
        <h1 className="text-4xl leading-tight font-black">{t("headline")}</h1>
        <p className="text-lg text-muted italic">“{tApp("tagline")}”</p>
        <ul className="space-y-3">
          {features.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-2xl bg-surface p-4 font-semibold">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon aria-hidden className="size-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <p className="text-sm font-bold text-primary">{t("free")}</p>
      </section>
      <div className="space-y-3 py-6">
        <Link
          href="/auth/sign-up"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-lg font-bold text-on-primary active:scale-[0.98]"
        >
          {t("cta")}
        </Link>
        <Link
          href="/auth/sign-in"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-border bg-surface text-lg font-bold active:scale-[0.98]"
        >
          {t("signIn")}
        </Link>
        <div className="pt-3">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
