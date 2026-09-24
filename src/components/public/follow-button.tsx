"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Button } from "@/components/ui";
import { followAction, unfollowAction } from "@/server/actions/community";
import type { ErrorCode } from "@/server/actions/result";

export function FollowButton({ handle, following, signedIn }: { handle: string; following: boolean; signedIn: boolean }) {
  const t = useTranslations("community");
  const [on, setOn] = useState(following);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  if (!signedIn) {
    return (
      <Link href="/auth/sign-in" className="inline-flex min-h-11 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary">
        {t("follow")}
      </Link>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        variant={on ? "secondary" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = on ? await unfollowAction(handle) : await followAction(handle);
            if (res.ok) setOn(!on);
            else setError(res.error);
          })
        }
      >
        {on ? t("following") : t("follow")}
      </Button>
      <ErrorMessage code={error} />
    </div>
  );
}
