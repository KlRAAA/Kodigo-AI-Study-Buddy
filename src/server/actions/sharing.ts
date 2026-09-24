"use server";

import { revalidatePath } from "next/cache";
import { handleSchema } from "@/lib/handle";
import { setHandle } from "../db/queries/profiles";
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
