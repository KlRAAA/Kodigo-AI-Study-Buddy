import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { profile } = await requireUser();
  if (profile.onboarded) redirect("/home");
  return <OnboardingForm name={profile.displayName ?? ""} initial={profile.locale} />;
}
