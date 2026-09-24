import { NextRequest, NextResponse } from "next/server";
import { createNeonAuth } from "@neondatabase/auth/next/server";

// Paths anyone can open. Everything else needs a session.
const PUBLIC_PREFIXES = ["/auth", "/privacy", "/terms", "/offline", "/api/auth"];

function isPublic(pathname: string) {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

let authMiddleware: ((req: NextRequest) => Promise<NextResponse>) | undefined;
function getAuthMiddleware() {
  if (!authMiddleware) {
    const auth = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL ?? "",
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET ?? "" },
    });
    authMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" });
  }
  return authMiddleware;
}

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by React and the Turnstile widget.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  if (isPublic(request.nextUrl.pathname)) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    try {
      // Neon Auth checks/refreshes the session and forwards our request headers.
      response = await getAuthMiddleware()(new NextRequest(request, { headers: requestHeaders }));
    } catch {
      // Misconfigured or unreachable auth: fail closed.
      response = NextResponse.redirect(new URL("/auth/sign-in", request.url));
    }
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/auth|_next/static|_next/image|favicon.ico|icons/|pwa-icon/|apple-icon|sw.js|manifest.webmanifest|pdf.worker.min.mjs).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
