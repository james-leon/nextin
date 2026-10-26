import type { z } from "zod";
import type { Messages } from "@nextin/shared/i18n";

export type ErrorCode = keyof Messages["errors"];

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorCode; fieldErrors?: Partial<Record<string, ErrorCode>> };

const AUTH_CODES: Record<string, ErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "user_already_exists",
  email_exists: "user_already_exists",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  captcha_failed: "captcha_failed",
  weak_password: "weak_password",
  otp_expired: "code_invalid",
  otp_disabled: "code_invalid",
  email_address_invalid: "email_invalid",
  validation_failed: "email_invalid",
  user_not_found: "code_invalid",
};

/** Traduit une erreur Supabase Auth (champ `code`) en clé du dictionnaire `errors`. */
export function mapAuthError(error: { code?: string; status?: number } | null | undefined): ErrorCode {
  if (!error) return "generic";
  if (error.code && AUTH_CODES[error.code]) return AUTH_CODES[error.code]!;
  if (error.status === 429) return "rate_limited";
  return "generic";
}

/** Erreurs Zod → erreurs par champ (le message Zod est déjà une clé du dictionnaire). */
export function fieldErrorsFrom(error: z.ZodError, known: readonly string[]): Partial<Record<string, ErrorCode>> {
  const out: Partial<Record<string, ErrorCode>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (out[field]) continue;
    out[field] = (known.includes(issue.message) ? issue.message : "generic") as ErrorCode;
  }
  return out;
}
