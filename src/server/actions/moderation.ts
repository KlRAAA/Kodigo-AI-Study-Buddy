"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth, getSessionUser, isAdminEmail } from "../auth";
import { emailForUser } from "../db/queries/admin";
import {
  approveSet,
  createReport,
  getSetOwnerId,
  markStrikesSeen,
  takeDownSet,
  unbanUser,
} from "../db/queries/moderation";
import { consumeDaily } from "../db/queries/usage";
import { readLimits } from "../limits/config";
import { log } from "../log";
import { hashEmail } from "../moderation/bans";
import { actionUser } from "./session";
import { fail, ok, type ActionResult } from "./result";

const uuid = z.string().uuid();
const reasonSchema = z.enum(["inappropriate", "harmful_link", "personal_info", "spam", "copyright", "other"]);

export async function reportSetAction(setId: string, reason: string, note?: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const r = reasonSchema.safeParse(reason);
  const n = z.string().trim().max(300).optional().safeParse(note);
  if (!uuid.safeParse(setId).success || !r.success || !n.success) return fail("invalid_input");
  if ((await consumeDaily(me.user.id, "report", readLimits().daily.report)) === null) return fail("community_limit");
  const res = await createReport(me.user.id, setId, r.data, n.data || null);
  if (res === "duplicate") return fail("already_reported");
  if (res === "own_set") return fail("own_set");
  if (res === "not_found") return fail("not_found");
  return ok(null);
}

export async function dismissStrikeAction(): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  await markStrikesSeen(me.user.id);
  revalidatePath("/home");
  return ok(null);
}

async function admin() {
  const user = await getSessionUser();
  return user?.emailVerified && isAdminEmail(user.email) ? user : null;
}

export async function approveSetAction(setId: string): Promise<ActionResult> {
  if (!(await admin())) return fail("unauthorized");
  if (!uuid.safeParse(setId).success) return fail("invalid_input");
  if (!(await approveSet(setId))) return fail("not_found");
  revalidatePath("/admin");
  return ok(null);
}

export async function takeDownAction(setId: string, reason: string, ban: boolean): Promise<ActionResult> {
  const me = await admin();
  if (!me) return fail("unauthorized");
  const why = z.string().trim().min(2).max(200).safeParse(reason);
  if (!uuid.safeParse(setId).success || !why.success || typeof ban !== "boolean") return fail("invalid_input");

  // Look up the owner's email first so a ban (now or via a 3rd strike) also blocks re-sign-up.
  const ownerId = await getSetOwnerId(setId);
  if (!ownerId) return fail("not_found");
  const email = await emailForUser(ownerId);
  const result = await takeDownSet(setId, me.id, why.data, { ban, emailHash: email ? hashEmail(email) : null });
  if (!result) return fail("not_found");
  if (result.banned) await revokeSessions(ownerId);
  revalidatePath("/admin");
  return ok(null);
}

/** Best effort: requireUser/actionUser already reject banned users on every request. */
async function revokeSessions(userId: string) {
  try {
    await getAuth().admin.revokeUserSessions({ userId });
  } catch {
    log.warn("moderation.revoke_sessions_failed");
  }
}

export async function unbanAction(userId: string): Promise<ActionResult> {
  if (!(await admin())) return fail("unauthorized");
  if (!z.string().min(1).max(100).safeParse(userId).success) return fail("invalid_input");
  const email = await emailForUser(userId);
  await unbanUser(userId, email ? hashEmail(email) : null);
  revalidatePath("/admin");
  return ok(null);
}
