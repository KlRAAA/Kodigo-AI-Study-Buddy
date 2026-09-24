"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { rateSetAction } from "@/server/actions/community";
import { cn } from "@/lib/utils";

export function RatingStars({ setId, initial, signedIn }: { setId: string; initial: number | null; signedIn: boolean }) {
  const t = useTranslations("community");
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link href="/auth/sign-in" className="text-sm font-bold text-primary">
        {t("signInToRate")}
      </Link>
    );
  }
  return (
    <div role="radiogroup" aria-label={t("rate")} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("stars", { count: n })}
          disabled={pending}
          onClick={() => {
            const next = value === n ? null : n;
            setValue(next);
            startTransition(async () => {
              const res = await rateSetAction(setId, next);
              if (!res.ok) setValue(initial);
            });
          }}
          className="flex size-11 items-center justify-center"
        >
          <Star aria-hidden className={cn("size-7", value !== null && n <= value ? "fill-accent text-accent" : "text-muted")} />
        </button>
      ))}
    </div>
  );
}
