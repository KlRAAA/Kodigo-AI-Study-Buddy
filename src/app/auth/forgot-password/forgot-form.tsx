"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorMessage, SubmitButton } from "@/components/form";
import { PasswordInput } from "@/components/password-input";
import { Turnstile } from "@/components/turnstile";
import { Input, Label } from "@/components/ui";
import { requestResetAction, resetPasswordAction } from "@/server/actions/auth";

export function ForgotPasswordForm({
  step,
  email,
  siteKey,
}: {
  step: "email" | "code";
  email: string;
  siteKey: string | undefined;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [requestState, requestAction] = useActionState(requestResetAction, null);
  const [resetState, resetAction] = useActionState(resetPasswordAction, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{t("forgotTitle")}</h1>
        <p className="mt-1 text-muted">
          {step === "email" ? t("forgotSubtitle") : t("resetSubtitle", { email })}
        </p>
      </div>

      {step === "email" ? (
        <form action={requestAction} className="space-y-4">
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={email} required />
          </div>
          <Turnstile siteKey={siteKey} language={locale} />
          {requestState && !requestState.ok && <ErrorMessage code={requestState.error} />}
          <SubmitButton>{t("sendCode")}</SubmitButton>
        </form>
      ) : (
        <form action={resetAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
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
          <div>
            <Label htmlFor="password">{t("newPassword")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              maxLength={128}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? "confirm-error" : undefined}
            />
            {mismatch && (
              <p id="confirm-error" className="mt-1 text-xs font-bold text-danger">
                {t("passwordMismatch")}
              </p>
            )}
          </div>
          {resetState && !resetState.ok && <ErrorMessage code={resetState.error} />}
          <SubmitButton>{t("resetPassword")}</SubmitButton>
        </form>
      )}

      <p className="text-center text-sm">
        <Link href="/auth/sign-in" className="font-bold text-primary">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
