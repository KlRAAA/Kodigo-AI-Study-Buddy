"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorMessage, SubmitButton } from "@/components/form";
import { PasswordInput } from "@/components/password-input";
import { Turnstile } from "@/components/turnstile";
import { Alert, Input, Label } from "@/components/ui";
import { signInAction } from "@/server/actions/auth";

export function SignInForm({
  notice,
  siteKey,
}: {
  notice: "verified" | "reset" | "deleted" | null;
  siteKey: string | undefined;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction] = useActionState(signInAction, null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{t("signInTitle")}</h1>
        <p className="mt-1 text-muted">{t("signInSubtitle")}</p>
      </div>
      {notice && <Alert tone="success">{t(`notice.${notice}`)}</Alert>}
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        <Turnstile siteKey={siteKey} language={locale} />
        {state && !state.ok && <ErrorMessage code={state.error} />}
        <SubmitButton>{t("signIn")}</SubmitButton>
      </form>
      <div className="space-y-2 text-center text-sm">
        <p>
          <Link href="/auth/forgot-password" className="font-bold text-primary">
            {t("forgot")}
          </Link>
        </p>
        <p className="text-muted">
          {t("noAccount")}{" "}
          <Link href="/auth/sign-up" className="font-bold text-primary">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
