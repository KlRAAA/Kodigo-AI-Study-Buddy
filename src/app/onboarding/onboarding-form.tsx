"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { completeOnboardingAction, setLocaleAction } from "@/server/actions/profile";
import { cn } from "@/lib/utils";

const choices = [
  { value: "en", label: "English", sub: "Study in English" },
  { value: "tl", label: "Tagalog", sub: "Mag-aral sa Tagalog" },
] as const;

export function OnboardingForm({ name, initial }: { name: string; initial: "en" | "tl" }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [locale, setLocale] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="py-4">
        <Logo />
      </div>
      <div className="flex-1 space-y-6 py-6">
        <div>
          <h1 className="text-3xl font-black">{t("title", { name: name || "👋" })}</h1>
          <p className="mt-1 text-muted">{t("subtitle")}</p>
        </div>
        <div role="radiogroup" aria-label={t("subtitle")} className="space-y-3">
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={locale === c.value}
              onClick={() => {
                setLocale(c.value);
                // Preview the UI in the chosen language right away.
                startTransition(async () => {
                  await setLocaleAction(c.value);
                  router.refresh();
                });
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border-2 bg-surface p-5 text-left",
                locale === c.value ? "border-primary" : "border-border",
              )}
            >
              <span>
                <span className="block text-xl font-black">{c.label}</span>
                <span className="text-sm text-muted">{c.sub}</span>
              </span>
              {locale === c.value && <Check aria-hidden className="size-6 text-primary" />}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{t("changeLater")}</p>
      </div>
      <div className="py-6">
        <Button
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => startTransition(() => completeOnboardingAction(locale).then(() => undefined))}
        >
          {t("continue")}
        </Button>
      </div>
    </main>
  );
}
