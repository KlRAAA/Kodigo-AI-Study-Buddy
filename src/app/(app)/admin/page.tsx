import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { isAdminEmail, requireUser } from "@/server/auth";
import { usageToday } from "@/server/db/queries/admin";
import { listModelStatus } from "@/server/db/queries/ai";
import { getGlobalUsage } from "@/server/db/queries/usage";
import { readLimits } from "@/server/limits/config";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) notFound();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const limits = readLimits();
  const [rows, models, globalUsed] = await Promise.all([usageToday(), listModelStatus(), getGlobalUsage()]);
  const now = new Date();

  return (
    <div className="space-y-5 py-4">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <Card className="space-y-1">
        <h2 className="font-black">{t("global")}</h2>
        <p className="text-3xl font-black tabular-nums">
          {globalUsed}/{limits.globalDailyBudget}
        </p>
        <p className="text-sm text-muted">{t("globalHint", { pct: Math.round(limits.globalCutoff * 100) })}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-black">{t("models")}</h2>
        {models.length === 0 ? (
          <p className="text-sm text-muted">{t("allHealthy")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {models.map((m) => {
              const benched = m.benchedUntil && m.benchedUntil > now;
              return (
                <li key={m.providerModel} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-mono break-all">{m.providerModel}</span>
                  <span className={benched ? "shrink-0 font-bold text-danger" : "shrink-0 font-bold text-success"}>
                    {benched ? t("benchedUntil", { time: format.dateTime(m.benchedUntil!, { timeStyle: "short" }) }) : t("ok")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-black">{t("users")}</h2>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.userId} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{r.email ?? r.displayName ?? r.userId}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {t("usageLine", { generation: r.generation, assist: r.assist, tutor: r.tutor })}
                  </p>
                </div>
                {r.isSuspended && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">{t("suspended")}</span>}
              </div>
              <UserActions userId={r.userId} suspended={r.isSuspended} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
