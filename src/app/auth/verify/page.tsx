import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VerifyForm } from "./verify-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("verifyTitle") };
}

export default async function VerifyPage({ searchParams }: PageProps<"/auth/verify">) {
  const { email } = await searchParams;
  return <VerifyForm email={typeof email === "string" ? email : ""} />;
}
