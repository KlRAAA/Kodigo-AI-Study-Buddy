import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/auth/forgot-password">) {
  const { step, email } = await searchParams;
  return (
    <ForgotPasswordForm
      step={step === "code" ? "code" : "email"}
      email={typeof email === "string" ? email : ""}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
    />
  );
}
