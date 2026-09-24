"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useDialogs } from "@/components/dialog";
import { Button } from "@/components/ui";
import { approveSetAction, takeDownAction } from "@/server/actions/moderation";

/** Approve is only offered for sets in review or already approved; others can only be taken down. */
export function QueueActions({ setId, canApprove }: { setId: string; canApprove: boolean }) {
  const t = useTranslations("admin");
  const [pending, startTransition] = useTransition();
  const { confirm, prompt, dialog } = useDialogs();

  async function takeDown(ban: boolean) {
    const reason = await prompt({ title: ban ? t("takeDownBan") : t("takeDown"), label: t("reasonPrompt"), maxLength: 200, confirmLabel: t("continue") });
    if (!reason) return;
    if (ban && !(await confirm({ title: t("takeDownBan"), message: t("confirmBan"), confirmLabel: t("takeDownBan"), danger: true }))) return;
    startTransition(async () => void (await takeDownAction(setId, reason, ban)));
  }

  return (
    <div className="flex flex-wrap gap-2 [&>button]:whitespace-nowrap">
      {dialog}
      {canApprove && (
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => void (await approveSetAction(setId)))}>
          {t("approve")}
        </Button>
      )}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => takeDown(false)}>
        {t("takeDown")}
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => takeDown(true)}>
        {t("takeDownBan")}
      </Button>
    </div>
  );
}
