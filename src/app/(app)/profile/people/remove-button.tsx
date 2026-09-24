"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { removeFollowerAction } from "@/server/actions/community";

export function RemoveFollowerButton({ userId }: { userId: string }) {
  const t = useTranslations("community");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      className="whitespace-nowrap"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("confirmRemove"))) return;
        startTransition(async () => void (await removeFollowerAction(userId)));
      }}
    >
      {t("remove")}
    </Button>
  );
}
