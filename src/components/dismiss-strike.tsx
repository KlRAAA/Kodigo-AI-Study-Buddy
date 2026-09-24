"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "./ui";
import { dismissStrikeAction } from "@/server/actions/moderation";

export function DismissStrike() {
  const t = useTranslations("banners");
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(async () => void (await dismissStrikeAction()))}>
      {t("strikeOk")}
    </Button>
  );
}
