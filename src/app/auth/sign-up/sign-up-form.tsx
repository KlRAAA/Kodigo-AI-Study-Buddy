"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorMessage, SubmitButton, useFormChecks } from "@/components/form";
import { PasswordInput } from "@/components/password-input";
import { Turnstile } from "@/components/turnstile";
import { Input, Label } from "@/components/ui";
import { signUpAction } from "@/server/actions/auth";

export function SignUpForm({ siteKey }: { siteKey: string | undefined }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction] = useActionState(signUpAction, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;
  const checks = useFormChecks({
    name: ["required"],
    email: ["required", "email"],
    password: ["required", "password"],
    confirmPassword: ["required"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{t("signUpTitle")}</h1>
        <p className="mt-1 text-muted">{t("signUpSubtitle")}</p>
      </div>
      <form action={formAction} noValidate onSubmit={checks.onSubmit} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" autoComplete="given-name" maxLength={60} required {...checks.field("name")} />
          {checks.message("name")}
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required {...checks.field("email")} />
          {checks.message("email")}
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...checks.field("password", "password-hint")}
          />
          {checks.message("password")}
          <p id="password-hint" className="mt-1 text-xs text-muted">
            {t("passwordHint")}
          </p>
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
          {checks.message("confirmPassword")}
          {mismatch && (
            <p id="confirm-error" className="mt-1 text-xs font-bold text-danger">
              {t("passwordMismatch")}
            </p>
          )}
        </div>
        <Turnstile siteKey={siteKey} language={locale} />
        {state && !state.ok && <ErrorMessage code={state.error} />}
        <SubmitButton>{t("signUp")}</SubmitButton>
        <p className="text-center text-xs text-muted">
          {t.rich("agree", {
            privacy: (chunks) => (
              <Link href="/privacy" className="underline">
                {chunks}
              </Link>
            ),
            terms: (chunks) => (
              <Link href="/terms" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </form>
      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/auth/sign-in" className="font-bold text-primary">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
