"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import type { ErrorCode } from "@/server/actions/result";
import { Alert, Button } from "./ui";

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={className ?? "w-full"}>
      {pending && <Loader2 aria-hidden className="size-5 animate-spin" />}
      {children}
    </Button>
  );
}

/** Shows a translated, friendly message for an action error code. */
export function ErrorMessage({ code }: { code: ErrorCode | null | undefined }) {
  const t = useTranslations("errors");
  if (!code) return null;
  return <Alert>{t(code)}</Alert>;
}
