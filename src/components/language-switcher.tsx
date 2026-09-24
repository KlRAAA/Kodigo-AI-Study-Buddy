"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/server/actions/profile";
import { Segmented } from "./ui";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div aria-busy={pending}>
      <Segmented
        label={t("label")}
        value={locale}
        options={[
          { value: "en", label: "English" },
          { value: "tl", label: "Tagalog" },
        ]}
        onChange={(next) =>
          startTransition(async () => {
            await setLocaleAction(next);
            router.refresh();
          })
        }
      />
    </div>
  );
}
