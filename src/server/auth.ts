import "server-only";
import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getOrCreateProfile } from "./db/queries/profiles";
import type { Profile } from "./db/schema";

let instance: NeonAuth | undefined;

/** Neon Auth server instance. Created lazily so builds work without env vars. */
export function getAuth(): NeonAuth {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret) throw new Error("Neon Auth env vars are not set");
    instance = createNeonAuth({ baseUrl, cookies: { secret }, logLevel: "warn" });
  }
  return instance;
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  // Mark the render as per-request before touching cookies, so Next doesn't try
  // (and fail noisily) to prerender session-dependent pages at build time.
  await connection();
  try {
    const { data } = await getAuth().getSession();
    const user = data?.user;
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified };
  } catch (err) {
    unstable_rethrow(err); // let Next's own control-flow errors through
    return null;
  }
}

/** For pages: redirects to sign-in when there's no session. */
export async function requireUser(): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/sign-in");
  if (!user.emailVerified) redirect(`/auth/verify?email=${encodeURIComponent(user.email)}`);
  const profile = await getOrCreateProfile(user.id, { displayName: user.name });
  return { user, profile };
}

export function isAdminEmail(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
