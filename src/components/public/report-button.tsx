"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Alert, Button, Textarea } from "@/components/ui";
import { reportSetAction } from "@/server/actions/moderation";
import type { ErrorCode } from "@/server/actions/result";

const REASONS = ["inappropriate", "harmful_link", "personal_info", "spam", "copyright", "other"] as const;

export function ReportButton({ setId, signedIn }: { setId: string; signedIn: boolean }) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("inappropriate");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link href="/auth/sign-in" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-muted">
        <Flag aria-hidden className="size-4" /> {t("button")}
      </Link>
    );
  }
  if (done) return <Alert tone="success">{t("thanks")}</Alert>;
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag aria-hidden className="size-4" /> {t("button")}
      </Button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-3xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await reportSetAction(setId, reason, note);
          if (res.ok || (!res.ok && res.error === "already_reported")) setDone(true);
          else setError(res.error);
        });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="font-black">{t("title")}</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex min-h-11 items-center gap-3">
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-[var(--primary)]" />
            {t(`reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} aria-label={t("notePlaceholder")} />
      <p className="text-xs text-muted">
        <Link href="/guidelines" className="underline">{t("guidelines")}</Link>
      </p>
      <ErrorMessage code={error} />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" className="flex-1" disabled={pending}>{t("send")}</Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>{t("cancel")}</Button>
      </div>
    </form>
  );
}
