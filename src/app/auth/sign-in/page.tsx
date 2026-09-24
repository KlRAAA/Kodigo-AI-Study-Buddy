import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signInTitle") };
}

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  const params = await searchParams;
  const notice =
    params.verified === "1" ? "verified" : params.reset === "1" ? "reset" : params.deleted === "1" ? "deleted" : null;
  return <SignInForm notice={notice} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
