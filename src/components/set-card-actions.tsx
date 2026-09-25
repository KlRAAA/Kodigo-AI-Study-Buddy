"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDialogs } from "@/components/dialog";
import { ErrorMessage } from "@/components/form";
import { deleteSetAction, updateSetMetaAction } from "@/server/actions/sets";
import type { ErrorCode } from "@/server/actions/result";

/** Rename / delete buttons for a set card in Home and Review. */
export function SetCardActions({ setId, title }: { setId: string; title: string }) {
  const t = useTranslations("set");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  const { confirm, prompt, dialog } = useDialogs();

  async function rename() {
    const next = await prompt({ title: t("renameTitle"), label: t("renamePrompt"), initial: title, maxLength: 120, confirmLabel: t("save") });
    if (!next || next === title) return;
    startTransition(async () => {
      const res = await updateSetMetaAction({ setId, title: next.slice(0, 120) });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  async function remove() {
    const yes = await confirm({ title: t("trashTitle"), message: t("trashConfirm"), confirmLabel: t("trashButton"), danger: true });
    if (!yes) return;
    startTransition(async () => {
      const res = await deleteSetAction(setId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {dialog}
      <div className="flex">
        <button
          type="button"
          onClick={rename}
          disabled={pending}
          aria-label={t("renameSet", { title })}
          className="flex size-11 items-center justify-center rounded-xl text-muted active:bg-surface-2"
        >
          <Pencil aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={t("deleteSetNamed", { title })}
          className="flex size-11 items-center justify-center rounded-xl text-muted active:bg-surface-2"
        >
          <Trash2 aria-hidden className="size-5" />
        </button>
      </div>
      {error && (
        <div className="w-48">
          <ErrorMessage code={error} />
        </div>
      )}
    </div>
  );
}
