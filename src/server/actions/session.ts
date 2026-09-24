import "server-only";
import { getSessionUser, type SessionUser } from "../auth";
import { getOrCreateProfile } from "../db/queries/profiles";
import type { Profile } from "../db/schema";

/** Identity for server actions. Always from the session cookie, never from client input. */
export async function actionUser(): Promise<{ user: SessionUser; profile: Profile } | null> {
  const user = await getSessionUser();
  if (!user || !user.emailVerified) return null;
  const profile = await getOrCreateProfile(user.id, { displayName: user.name });
  if (profile.bannedAt) return null;
  return { user, profile };
}
