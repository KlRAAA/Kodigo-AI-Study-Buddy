"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { approveSetAction, takeDownAction } from "@/server/actions/moderation";

export function QueueActions({ setId }: { setId: string }) {
  const t = useTranslations("admin");
  const [pending, startTransition] = useTransition();

  function takeDown(ban: boolean) {
    const reason = window.prompt(t("reasonPrompt"))?.trim();
    if (!reason) return;
    if (ban && !window.confirm(t("confirmBan"))) return;
    startTransition(async () => void (await takeDownAction(setId, reason, ban)));
  }

  return (
    <div className="flex flex-wrap gap-2 [&>button]:whitespace-nowrap">
      <Button size="sm" disabled={pending} onClick={() => startTransition(async () => void (await approveSetAction(setId)))}>
        {t("approve")}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => takeDown(false)}>
        {t("takeDown")}
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => takeDown(true)}>
        {t("takeDownBan")}
      </Button>
    </div>
  );
}
