import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AllowanceChip } from "@/components/allowance-chip";
import { requireUser } from "@/server/auth";
import { readLimits } from "@/server/limits/config";
import { CreateFlow } from "./create-flow";

// Generation of long notes can take a while (several chunks, possible fallbacks).
export const maxDuration = 120;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("create") };
}

export default async function CreatePage() {
  const { user } = await requireUser();
  const t = await getTranslations("create");
  return (
    <div className="space-y-5 py-4">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-black">{t("title")}</h1>
        <AllowanceChip userId={user.id} />
      </header>
      <CreateFlow maxChars={readLimits().maxInputChars} />
    </div>
  );
}
