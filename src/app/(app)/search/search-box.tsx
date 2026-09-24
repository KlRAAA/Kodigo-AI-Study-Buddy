"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui";

export function SearchBox({ initial }: { initial: string }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (value === initial) return;
    const id = window.setTimeout(() => {
      router.replace(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : "/search");
    }, 300);
    return () => window.clearTimeout(id);
  }, [value, initial, router]);

  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        aria-label={t("placeholder")}
        placeholder={t("placeholder")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={!initial}
        enterKeyHint="search"
        className="pl-12"
      />
    </div>
  );
}
