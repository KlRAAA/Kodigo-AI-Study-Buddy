import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { isAdminEmail, requireUser } from "@/server/auth";
import { usageToday } from "@/server/db/queries/admin";
import { listModelStatus } from "@/server/db/queries/ai";
import { APPROVABLE, listModerationQueue } from "@/server/db/queries/moderation";
import { getGlobalUsage } from "@/server/db/queries/usage";
import { readLimits } from "@/server/limits/config";
import { QueueActions } from "./queue-actions";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) notFound();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const limits = readLimits();
  const [rows, models, globalUsed, queue] = await Promise.all([usageToday(), listModelStatus(), getGlobalUsage(), listModerationQueue()]);
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
        <h2 className="font-black">{t("queue", { count: queue.length })}</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-muted">{t("queueEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {queue.map((q) => (
              <li key={q.setId} className="space-y-2 py-3">
                <p className="font-bold break-words">{q.title}</p>
                <p className="text-xs text-muted">
                  @{q.ownerHandle ?? "?"} · {q.status} · {t("reportsCount", { count: q.reportCount })}
                  {q.reason ? ` · ${q.reason}` : ""}
                </p>
                {q.reports.length > 0 && (
                  <ul className="list-disc pl-5 text-sm">
                    {q.reports.map((r, i) => (
                      <li key={i}>{r.reason}{r.note ? `: ${r.note}` : ""}</li>
                    ))}
                  </ul>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">{t("viewCards", { count: q.cards.length })}</summary>
                  <ul className="mt-1 space-y-1">
                    {q.cards.map((c, i) => (
                      <li key={i} className="break-words"><strong>{c.term}</strong>: {c.definition}</li>
                    ))}
                  </ul>
                </details>
                <QueueActions setId={q.setId} canApprove={APPROVABLE.includes(q.status)} />
              </li>
            ))}
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
              <UserActions userId={r.userId} suspended={r.isSuspended} banned={Boolean(r.bannedAt)} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
