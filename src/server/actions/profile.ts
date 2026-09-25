"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth, getSessionUser } from "../auth";
import { deleteAllUserData, getOrCreateProfile, updateProfile } from "../db/queries/profiles";
import { log } from "../log";
import { LOCALE_COOKIE, locales } from "@/i18n/config";
import { actionUser } from "./session";
import { fail, ok, type ActionResult } from "./result";

const localeSchema = z.enum(locales);
const cookieOptions = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

/** Works signed in or out: always sets the cookie, and saves to the profile when signed in. */
export async function setLocaleAction(input: string): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  (await cookies()).set(LOCALE_COOKIE, parsed.data, cookieOptions);
  const user = await getSessionUser();
  if (user) {
    await getOrCreateProfile(user.id, { displayName: user.name });
    await updateProfile(user.id, { locale: parsed.data });
  }
  return ok(null);
}

export async function completeOnboardingAction(input: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  await updateProfile(me.user.id, { locale: parsed.data, onboarded: true });
  (await cookies()).set(LOCALE_COOKIE, parsed.data, cookieOptions);
  redirect("/home");
}

export async function updateDisplayNameAction(input: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = z.string().trim().min(1).max(60).safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  await updateProfile(me.user.id, { displayName: parsed.data });
  return ok(null);
}

/** Deletes all app data, then the Neon Auth account. Requires typing the confirmation word. */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized");
  // Banned accounts can't delete themselves to escape the ban.
  if ((await getOrCreateProfile(user.id)).bannedAt) return fail("banned");
  if (!["DELETE", "BURAHIN"].includes(confirmation.trim().toUpperCase())) return fail("invalid_input");

  await deleteAllUserData(user.id);
  const auth = getAuth();
  const { error } = await auth.deleteUser({});
  if (error) log.error("account.delete_auth_user_failed", { code: error.code ?? null, status: error.status ?? null });
  await auth.signOut().catch(() => {});
  (await cookies()).delete(LOCALE_COOKIE);
  redirect("/auth/sign-in?deleted=1");
}
