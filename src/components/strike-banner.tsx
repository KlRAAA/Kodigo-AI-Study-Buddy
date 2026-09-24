import { getTranslations } from "next-intl/server";
import { unseenStrike } from "@/server/db/queries/moderation";
import { DismissStrike } from "./dismiss-strike";

export async function StrikeBanner({ userId }: { userId: string }) {
  const strike = await unseenStrike(userId);
  if (!strike) return null;
  const t = await getTranslations("banners");
  return (
    <div role="alert" className="mt-2 space-y-2 rounded-2xl bg-danger-soft p-4 text-sm font-semibold text-danger">
      <p>{t("strike", { title: strike.setTitle ?? "—", reason: strike.reason })}</p>
      <DismissStrike />
    </div>
  );
}
