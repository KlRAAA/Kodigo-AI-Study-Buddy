"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { ErrorMessage, SubmitButton } from "@/components/form";
import { Alert, Button, Input, Label } from "@/components/ui";
import { resendCodeAction, verifyEmailAction } from "@/server/actions/auth";

export function VerifyForm({ email: initialEmail }: { email: string }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(verifyEmailAction, null);
  const [email, setEmail] = useState(initialEmail);
  const [resent, setResent] = useState<"ok" | "fail" | null>(null);
  const [resending, startResend] = useTransition();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{t("verifyTitle")}</h1>
        <p className="mt-1 text-muted">{t("verifySubtitle", { email: email || "…" })}</p>
      </div>
      <form action={formAction} className="space-y-4">
        {initialEmail ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <Label htmlFor="otp">{t("code")}</Label>
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4,8}"
            maxLength={8}
            required
            className="text-center text-2xl font-black tracking-[0.4em]"
          />
        </div>
        {state && !state.ok && <ErrorMessage code={state.error} />}
        {resent === "ok" && <Alert tone="success">{t("codeResent")}</Alert>}
        {resent === "fail" && <ErrorMessage code="rate" />}
        <SubmitButton>{t("verify")}</SubmitButton>
      </form>
      <Button
        variant="ghost"
        className="w-full"
        disabled={resending || !email}
        onClick={() =>
          startResend(async () => {
            const res = await resendCodeAction(email);
            setResent(res.ok ? "ok" : "fail");
          })
        }
      >
        {t("resendCode")}
      </Button>
    </div>
  );
}
