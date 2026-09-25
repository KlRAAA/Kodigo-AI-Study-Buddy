"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { handleSchema } from "@/lib/handle";
import { copySet, followUser, rateSet, removeFollower, unfollowUser } from "../db/queries/community";
import { getProfileByHandle } from "../db/queries/profiles";
import { consumeDaily, refundDaily } from "../db/queries/usage";
import { readLimits } from "../limits/config";
import { actionUser } from "./session";
import { fail, ok, type ActionResult } from "./result";

const uuid = z.string().uuid();

export async function copySetAction(setId: string): Promise<ActionResult<{ id: string }>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!uuid.safeParse(setId).success) return fail("invalid_input");
  if ((await consumeDaily(me.user.id, "copy", readLimits().daily.copy)) === null) return fail("community_limit");
  const res = await copySet(me.user.id, setId);
  if (res === "not_found" || res === "own_set") {
    await refundDaily(me.user.id, "copy"); // a failed copy doesn't use up the daily limit
    return fail(res);
  }
  revalidatePath("/home");
  return ok(res);
}

export async function rateSetAction(setId: string, stars: number | null): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const s = z.number().int().min(1).max(5).nullable().safeParse(stars);
  if (!uuid.safeParse(setId).success || !s.success) return fail("invalid_input");
  const res = await rateSet(me.user.id, setId, s.data);
  if (res !== "ok") return fail(res);
  return ok(null);
}

async function targetByHandle(handle: string) {
  const h = handleSchema.safeParse(handle);
  return h.success ? getProfileByHandle(h.data) : null;
}

export async function followAction(handle: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const target = await targetByHandle(handle);
  if (!target || target.bannedAt) return fail("not_found");
  if ((await consumeDaily(me.user.id, "follow", readLimits().daily.follow)) === null) return fail("community_limit");
  const res = await followUser(me.user.id, target.userId);
  if (res !== "ok") return fail("cannot_follow");
  revalidatePath(`/u/${target.handle}`);
  return ok(null);
}

export async function unfollowAction(handle: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const target = await targetByHandle(handle);
  if (!target) return fail("not_found");
  await unfollowUser(me.user.id, target.userId);
  revalidatePath(`/u/${target.handle}`);
  return ok(null);
}

export async function removeFollowerAction(followerId: string): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  if (!z.string().min(1).max(100).safeParse(followerId).success) return fail("invalid_input");
  await removeFollower(me.user.id, followerId);
  revalidatePath("/profile/people");
  return ok(null);
}
