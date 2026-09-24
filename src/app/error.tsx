"use client";

import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <LogoMark className="size-16" />
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <p className="text-muted">{t("body")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
