"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { Segmented } from "./ui";

/** Light / Dark / System. Saved in a cookie so the server renders the right theme (no flash). */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const t = useTranslations("profile");
  const [theme, setTheme] = useState<Theme>(initial);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <Segmented
      label={t("theme")}
      value={theme}
      onChange={apply}
      options={[
        { value: "system", label: t("themeSystem") },
        { value: "light", label: t("themeLight") },
        { value: "dark", label: t("themeDark") },
      ]}
    />
  );
}
