"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useDialogs } from "@/components/dialog";
import { Button } from "@/components/ui";
import { removeFollowerAction } from "@/server/actions/community";

export function RemoveFollowerButton({ userId }: { userId: string }) {
  const t = useTranslations("community");
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useDialogs();
  return (
    <>
      {dialog}
      <Button
        size="sm"
        variant="secondary"
        className="whitespace-nowrap"
        disabled={pending}
        onClick={async () => {
          const yes = await confirm({
            title: t("remove"),
            message: t("confirmRemove"),
            confirmLabel: t("remove"),
            danger: true,
          });
          if (!yes) return;
          startTransition(async () => void (await removeFollowerAction(userId)));
        }}
      >
        {t("remove")}
      </Button>
    </>
  );
}
