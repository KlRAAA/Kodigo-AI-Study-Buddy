import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";
import { StrikeBanner } from "@/components/strike-banner";
import { Alert } from "@/components/ui";
import { isAdminEmail, requireUser } from "@/server/auth";
import { isGlobalBudgetLow } from "@/server/limits/limiter";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser();
  if (!profile.onboarded) redirect("/onboarding");
  const t = await getTranslations("banners");
  const budgetLow = await isGlobalBudgetLow().catch(() => false);

  return (
    <>
      <SideNav isAdmin={isAdminEmail(user.email)} />
      <div className="pt-safe pb-nav mx-auto min-h-dvh max-w-xl px-4 lg:ml-64 lg:max-w-3xl lg:px-8 lg:pb-10">
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
        <StrikeBanner userId={user.id} />
        {children}
        <BottomNav />
      </div>
    </>
  );
}
