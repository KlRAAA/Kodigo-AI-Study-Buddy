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
      {/* The sidebar is fixed; reserve its width, then center the page in the space left. */}
      <div className="lg:pl-64">
        <div className="pt-safe pb-nav mx-auto min-h-dvh max-w-xl px-4 lg:max-w-4xl lg:px-10">
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
      </div>
    </>
  );
}
