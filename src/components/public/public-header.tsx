import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { getSessionUser } from "@/server/auth";

export async function PublicHeader() {
  const t = await getTranslations("public");
  const user = await getSessionUser();
  return (
    <header className="flex items-center justify-between py-4">
      <Link href={user ? "/home" : "/"} aria-label="Kodigo">
        <Logo />
      </Link>
      {user ? (
        <Link href="/home" className="rounded-xl px-3 py-2 text-sm font-bold text-primary">
          {t("myLibrary")}
        </Link>
      ) : (
        <Link href="/auth/sign-up" className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary">
          {t("joinFree")}
        </Link>
      )}
    </header>
  );
}
