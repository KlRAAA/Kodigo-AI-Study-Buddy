import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { remainingAllowance } from "@/server/limits/limiter";

export async function AllowanceChip({ userId }: { userId: string }) {
  const t = await getTranslations("home");
  const { generation } = await remainingAllowance(userId);
  const left = Math.max(0, generation.limit - generation.used);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-bold">
      <Sparkles aria-hidden className="size-4 text-accent" />
      {t("allowance", { left, limit: generation.limit })}
    </span>
  );
}
