import { headers } from "next/headers";
import Link from "next/link";
import Script from "next/script";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const t = await getTranslations("legal");
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="flex items-center justify-between py-4">
        <Link href="/" aria-label="Kodigo">
          <Logo />
        </Link>
      </div>
      <div className="flex-1 py-4">{children}</div>
      <div className="space-y-4 py-6">
        <LanguageSwitcher />
        <p className="text-center text-xs text-muted">
          <Link href="/privacy" className="underline">
            {t("privacy")}
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline">
            {t("terms")}
          </Link>
        </p>
      </div>
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          nonce={nonce}
        />
      )}
    </main>
  );
}
