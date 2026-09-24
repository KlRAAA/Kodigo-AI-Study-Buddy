import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUpTitle") };
}

export default function SignUpPage() {
  return <SignUpForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
