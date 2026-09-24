import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BottomNav } from "@/components/bottom-nav";
import { Alert } from "@/components/ui";
import { requireUser } from "@/server/auth";
import { isGlobalBudgetLow } from "@/server/limits/limiter";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  if (!profile.onboarded) redirect("/onboarding");
  const t = await getTranslations("banners");
  const budgetLow = await isGlobalBudgetLow().catch(() => false);

  return (
    <div className="pt-safe pb-nav mx-auto min-h-dvh max-w-xl px-4">
      {budgetLow && (
        <div className="pt-2">
          <Alert tone="info">{t("globalBudget")}</Alert>
        </div>
      )}
      {profile.isSuspended && (
        <div className="pt-2">
          <Alert tone="info">{t("suspended")}</Alert>
        </div>
      )}
      {children}
      <BottomNav />
    </div>
  );
}
