import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/logo";

export default async function NotFound() {
  const t = await getTranslations("errorPage");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <LogoMark className="size-16" />
      <h1 className="text-2xl font-black">{t("notFound")}</h1>
      <Link href="/home" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-on-primary">
        {t("goHome")}
      </Link>
    </main>
  );
}
