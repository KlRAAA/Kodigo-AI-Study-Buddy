"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDialogs } from "@/components/dialog";
import { ErrorMessage } from "@/components/form";
import { Button } from "@/components/ui";
import { deleteForeverAction, restoreSetAction } from "@/server/actions/sets";
import type { ErrorCode } from "@/server/actions/result";

export function TrashActions({ setId, title }: { setId: string; title: string }) {
  const t = useTranslations("trash");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  const { confirm, dialog } = useDialogs();

  function run(action: (id: string) => Promise<{ ok: boolean; error?: ErrorCode }>) {
    startTransition(async () => {
      const res = await action(setId);
      if (res.ok) router.refresh();
      else setError(res.error ?? "unknown");
    });
  }

  return (
    <div className="flex flex-wrap gap-2 [&>button]:whitespace-nowrap">
      {dialog}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(restoreSetAction)}>
        <RotateCcw aria-hidden className="size-4" /> {t("restore")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger"
        disabled={pending}
        onClick={async () => {
          const yes = await confirm({
            title: t("confirmTitle"),
            message: t("confirmBody", { title }),
            confirmLabel: t("deleteForever"),
            danger: true,
          });
          if (yes) run(deleteForeverAction);
        }}
      >
        <Trash2 aria-hidden className="size-4" /> {t("deleteForever")}
      </Button>
      {error && (
        <div className="w-full">
          <ErrorMessage code={error} />
        </div>
      )}
    </div>
  );
}
