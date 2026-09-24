// Error codes map 1:1 to keys under "errors" in messages/*.json. Never send raw errors to the client.
export type ErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "not_verified"
  | "not_found"
  | "suspended"
  | "rate"
  | "daily"
  | "global"
  | "ai_unavailable"
  | "captcha"
  | "signup_throttled"
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "password_mismatch"
  | "invalid_code"
  | "too_long"
  | "handle_invalid"
  | "handle_taken"
  | "handle_too_soon"
  | "needs_handle"
  | "share_blocked"
  | "not_shareable"
  | "banned"
  | "own_set"
  | "already_reported"
  | "cannot_follow"
  | "taken_down"
  | "community_limit"
  | "unknown";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: ErrorCode };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: ErrorCode): { ok: false; error: ErrorCode } => ({ ok: false, error });
