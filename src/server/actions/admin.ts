"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser, isAdminEmail } from "../auth";
import { setSuspended } from "../db/queries/admin";
import { resetUserCounters } from "../db/queries/usage";
import { fail, ok, type ActionResult } from "./result";

const userId = z.string().min(1).max(100);

async function isAdmin() {
  const user = await getSessionUser();
  return Boolean(user?.emailVerified && isAdminEmail(user.email));
}

export async function setSuspendedAction(targetUserId: string, suspended: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return fail("unauthorized");
  if (!userId.safeParse(targetUserId).success || typeof suspended !== "boolean") return fail("invalid_input");
  await setSuspended(targetUserId, suspended);
  revalidatePath("/admin");
  return ok(null);
}

export async function resetCountersAction(targetUserId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return fail("unauthorized");
  if (!userId.safeParse(targetUserId).success) return fail("invalid_input");
  await resetUserCounters(targetUserId);
  revalidatePath("/admin");
  return ok(null);
}
