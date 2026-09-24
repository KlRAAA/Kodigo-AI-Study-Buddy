import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** IPs are only stored hashed (salted with the cookie secret). */
export function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${process.env.NEON_AUTH_COOKIE_SECRET ?? ""}:${ip}`)
    .digest("hex");
}
