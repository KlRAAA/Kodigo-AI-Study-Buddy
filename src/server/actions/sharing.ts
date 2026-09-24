"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { handleSchema } from "@/lib/handle";
import { setHandle } from "../db/queries/profiles";
import { screenSet } from "../moderation";
import { shareSet, type ShareOutcome } from "../sharing/share";
import { actionUser } from "./session";
import { fail, ok, type ActionResult } from "./result";

export async function setHandleAction(input: string): Promise<ActionResult<{ handle: string }>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const parsed = handleSchema.safeParse(input);
  if (!parsed.success) return fail("handle_invalid");
  const result = await setHandle(me.user.id, parsed.data);
  if (result === "taken") return fail("handle_taken");
  if (result === "too_soon") return fail("handle_too_soon");
  revalidatePath("/profile");
  return ok({ handle: parsed.data });
}

const visibilitySchema = z.enum(["private", "link", "public"]);

export async function shareSetAction(setId: string, visibility: string): Promise<ActionResult<ShareOutcome>> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const v = visibilitySchema.safeParse(visibility);
  if (!z.string().uuid().safeParse(setId).success || !v.success) return fail("invalid_input");
  const res = await shareSet({ userId: me.user.id, profile: me.profile, setId, visibility: v.data, screen: screenSet });
  revalidatePath(`/sets/${setId}`);
  return res;
}
