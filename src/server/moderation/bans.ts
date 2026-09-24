import "server-only";
import { createHash } from "node:crypto";

/** Banned emails are stored only as a salted hash. */
export function hashEmail(email: string) {
  return createHash("sha256")
    .update(`${process.env.NEON_AUTH_COOKIE_SECRET ?? ""}:email:${email.trim().toLowerCase()}`)
    .digest("hex");
}
