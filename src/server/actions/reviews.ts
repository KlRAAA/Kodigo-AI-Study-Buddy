"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GRADES, type Grade } from "@/lib/srs";
import { recordReview } from "../db/queries/reviews";
import { actionUser } from "./session";
import { fail, ok, type ActionResult } from "./result";

const cardId = z.string().uuid();
const gradeSchema = z.enum(GRADES);

/** Records a spaced-repetition answer (Review session, or a card mastered in Learn). */
export async function reviewCardAction(id: string, grade: Grade): Promise<ActionResult> {
  const me = await actionUser();
  if (!me) return fail("unauthorized");
  const g = gradeSchema.safeParse(grade);
  if (!cardId.safeParse(id).success || !g.success) return fail("invalid_input");
  const next = await recordReview(me.user.id, id, g.data);
  if (!next) return fail("not_found");
  revalidatePath("/review");
  revalidatePath("/home");
  return ok(null);
}
