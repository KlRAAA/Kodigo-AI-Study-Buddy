import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

type Section = { heading: string; body: string[] };

export async function LegalPage({ kind }: { kind: "privacy" | "terms" | "guidelines" }) {
  const t = await getTranslations(`legal.${kind}Page`);
  const common = await getTranslations("legal");
  const sections = t.raw("sections") as Section[];

  return (
    <main className="pt-safe pb-safe mx-auto max-w-xl px-5 py-6">
      <Link href="/" aria-label="Kodigo">
        <Logo />
      </Link>
      <h1 className="mt-6 text-3xl font-black">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{common("updated", { date: "2026-09-24" })}</p>
      <div className="mt-6 space-y-6">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-black">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
      <div className="mt-10">
        <LanguageSwitcher />
      </div>
    </main>
  );
}
