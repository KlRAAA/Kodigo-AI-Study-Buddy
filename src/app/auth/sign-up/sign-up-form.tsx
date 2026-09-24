"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorMessage, SubmitButton } from "@/components/form";
import { Turnstile } from "@/components/turnstile";
import { Input, Label } from "@/components/ui";
import { signUpAction } from "@/server/actions/auth";

export function SignUpForm({ siteKey }: { siteKey: string | undefined }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction] = useActionState(signUpAction, null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{t("signUpTitle")}</h1>
        <p className="mt-1 text-muted">{t("signUpSubtitle")}</p>
      </div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" autoComplete="given-name" maxLength={60} required />
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="mt-1 text-xs text-muted">
            {t("passwordHint")}
          </p>
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
