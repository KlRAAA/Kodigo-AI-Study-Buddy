import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** The site's origin for absolute links: NEXT_PUBLIC_APP_URL, else the request's host. */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** IPs are only stored hashed (salted with the cookie secret). */
export function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${process.env.NEON_AUTH_COOKIE_SECRET ?? ""}:${ip}`)
    .digest("hex");
}
