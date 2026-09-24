"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { resetCountersAction, setSuspendedAction } from "@/server/actions/admin";

export function UserActions({ userId, suspended }: { userId: string; suspended: boolean }) {
  const t = useTranslations("admin");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2 [&>button]:whitespace-nowrap">
      <Button
        size="sm"
        variant={suspended ? "secondary" : "danger"}
        disabled={pending}
        onClick={() => startTransition(async () => void (await setSuspendedAction(userId, !suspended)))}
      >
        {suspended ? t("unsuspend") : t("suspend")}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(async () => void (await resetCountersAction(userId)))}>
        {t("resetCounters")}
      </Button>
    </div>
  );
}
