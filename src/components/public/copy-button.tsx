"use client";

import { CopyPlus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Button } from "@/components/ui";
import { copySetAction } from "@/server/actions/community";
import type { ErrorCode } from "@/server/actions/result";

export function CopyButton({ setId, signedIn }: { setId: string; signedIn: boolean }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link href="/auth/sign-up" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-on-primary">
        <CopyPlus aria-hidden className="size-5" /> {t("signUpToCopy")}
      </Link>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await copySetAction(setId);
            if (res.ok) router.push(`/sets/${res.data.id}`);
            else setError(res.error);
          })
        }
      >
        <CopyPlus aria-hidden className="size-5" /> {t("copy")}
      </Button>
      <ErrorMessage code={error} />
    </div>
  );
}
