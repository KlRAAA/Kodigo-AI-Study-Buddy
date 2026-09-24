"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "../auth";
import { getOrCreateProfile } from "../db/queries/profiles";
import { consumeSignup } from "../db/queries/usage";
import { readLimits } from "../limits/config";
import { log } from "../log";
import { clientIp, hashIp } from "../request";
import { verifyTurnstile } from "../turnstile";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { fail, type ActionResult } from "./result";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);
const otp = z.string().trim().regex(/^\d{4,8}$/);

type AuthError = { code?: string; status?: number; message?: string } | null | undefined;

function mapAuthError(error: AuthError): ActionResult {
  const code = error?.code ?? "";
  if (code === "USER_ALREADY_EXISTS" || code.includes("ALREADY_EXISTS")) return fail("email_taken");
  if (code.includes("PASSWORD_TOO_SHORT") || code.includes("PASSWORD_TOO_LONG")) return fail("weak_password");
  if (code === "INVALID_EMAIL_OR_PASSWORD" || error?.status === 401) return fail("invalid_credentials");
  if (code.includes("OTP") || code.includes("INVALID_CODE") || code.includes("TOO_MANY_ATTEMPTS")) return fail("invalid_code");
  if (error?.status === 429) return fail("rate");
  return fail("unknown");
}

async function checkTurnstile(formData: FormData) {
  const token = formData.get("cf-turnstile-response");
  return verifyTurnstile(typeof token === "string" ? token : null, await clientIp());
}

const signUpSchema = z.object({ name: z.string().trim().min(1).max(60), email, password, locale: z.string().optional() });

export async function signUpAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const pw = formData.get("password");
    return fail(typeof pw === "string" && pw.length < 8 ? "weak_password" : "invalid_input");
  }
  if (!(await checkTurnstile(formData))) return fail("captcha");

  const ip = await clientIp();
  if (ip && !(await consumeSignup(hashIp(ip), readLimits().signupsPerIpPerHour))) return fail("signup_throttled");

  const { name, email: mail, password: pw } = parsed.data;
  const { data, error } = await getAuth().signUp.email({ email: mail, password: pw, name });
  if (error) {
    log.warn("auth.signup_failed", { code: error.code ?? null, status: error.status ?? null });
    return mapAuthError(error);
  }
  const userId = data?.user?.id;
  if (userId) {
    const locale = isLocale(parsed.data.locale) ? parsed.data.locale : "en";
    await getOrCreateProfile(userId, { displayName: name, locale });
  }
  redirect(`/auth/verify?email=${encodeURIComponent(mail)}`);
}

const signInSchema = z.object({ email, password: z.string().min(1).max(128) });

export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("invalid_credentials");
  if (!(await checkTurnstile(formData))) return fail("captcha");

  const { data, error } = await getAuth().signIn.email(parsed.data);
  if (error) {
    if (error.code === "EMAIL_NOT_VERIFIED") {
      await sendVerificationCode(parsed.data.email);
      redirect(`/auth/verify?email=${encodeURIComponent(parsed.data.email)}`);
    }
    log.warn("auth.signin_failed", { code: error.code ?? null, status: error.status ?? null });
    return mapAuthError(error);
  }
  const user = data?.user;
  if (user) {
    const profile = await getOrCreateProfile(user.id, { displayName: user.name });
    (await cookies()).set(LOCALE_COOKIE, profile.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    redirect(profile.onboarded ? "/home" : "/onboarding");
  }
  redirect("/home");
}

async function sendVerificationCode(mail: string) {
  const { error } = await getAuth().emailOtp.sendVerificationOtp({ email: mail, type: "email-verification" });
  if (error) log.warn("auth.send_otp_failed", { code: error.code ?? null, status: error.status ?? null });
  return !error;
}

export async function resendCodeAction(mailInput: string): Promise<ActionResult> {
  const parsed = email.safeParse(mailInput);
  if (!parsed.success) return fail("invalid_input");
  return (await sendVerificationCode(parsed.data)) ? { ok: true, data: null } : fail("rate");
}

const verifySchema = z.object({ email, otp });

export async function verifyEmailAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("invalid_code");

  const auth = getAuth();
  const { error } = await auth.emailOtp.verifyEmail({ email: parsed.data.email, otp: parsed.data.otp });
  if (error) return mapAuthError({ ...error, code: error.code ?? "INVALID_CODE" });

  const { data: session } = await auth.getSession();
  if (session?.user) redirect("/onboarding");
  redirect("/auth/sign-in?verified=1");
}

export async function requestResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return fail("invalid_input");
  if (!(await checkTurnstile(formData))) return fail("captcha");
  const { error } = await getAuth().emailOtp.sendVerificationOtp({ email: parsed.data, type: "forget-password" });
  // Same response whether or not the account exists.
  if (error) log.warn("auth.reset_request_failed", { code: error.code ?? null, status: error.status ?? null });
  redirect(`/auth/forgot-password?step=code&email=${encodeURIComponent(parsed.data)}`);
}

const resetSchema = z.object({ email, otp, password });

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const pw = formData.get("password");
    return fail(typeof pw === "string" && pw.length < 8 ? "weak_password" : "invalid_code");
  }
  const { error } = await getAuth().emailOtp.resetPassword(parsed.data);
  if (error) return mapAuthError({ ...error, code: error.code ?? "INVALID_CODE" });
  redirect("/auth/sign-in?reset=1");
}

export async function signOutAction() {
  await getAuth().signOut();
  redirect("/auth/sign-in");
}
