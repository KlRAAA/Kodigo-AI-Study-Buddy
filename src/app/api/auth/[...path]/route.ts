import { getAuth } from "@/server/auth";

// Sign-up, sign-in, OTP and password reset go through our Server Actions (which
// check Turnstile and throttles first), so the browser proxy only exposes the
// few endpoints the SDK needs directly.
const ALLOWED = [/^get-session$/, /^sign-out$/, /^callback\/[a-z]+$/, /^token$/];

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(method: "GET" | "POST", request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  if (!ALLOWED.some((re) => re.test(path.join("/")))) {
    return new Response("Not found", { status: 404 });
  }
  return getAuth().handler()[method](request, ctx);
}

export const GET = (request: Request, ctx: Ctx) => handle("GET", request, ctx);
export const POST = (request: Request, ctx: Ctx) => handle("POST", request, ctx);
