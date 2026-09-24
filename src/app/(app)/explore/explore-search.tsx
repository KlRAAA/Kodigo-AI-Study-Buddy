"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input, Segmented } from "@/components/ui";

type Sort = "top" | "new" | "copied";

export function ExploreSearch({ q, sort }: { q: string; sort: Sort }) {
  const t = useTranslations("explore");
  const router = useRouter();
  const [value, setValue] = useState(q);
  const pendingId = useRef<number | null>(null);
  const go = useCallback(
    (query: string, s: Sort) => {
      if (pendingId.current !== null) {
        window.clearTimeout(pendingId.current);
        pendingId.current = null;
      }
      router.replace(`/explore?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), sort: s })}`);
    },
    [router],
  );

  useEffect(() => {
    if (value === q) return;
    pendingId.current = window.setTimeout(() => {
      pendingId.current = null;
      go(value, sort);
    }, 300);
    return () => {
      if (pendingId.current !== null) window.clearTimeout(pendingId.current);
    };
  }, [value, sort, q, go]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <Input type="search" aria-label={t("search")} placeholder={t("search")} value={value} onChange={(e) => setValue(e.target.value)} className="pl-12" />
      </div>
      <Segmented
        label={t("sortLabel")}
        value={sort}
        onChange={(s) => go(value, s)}
        options={[
          { value: "top", label: t("top") },
          { value: "new", label: t("new") },
          { value: "copied", label: t("copied") },
        ]}
      />
    </div>
  );
}
