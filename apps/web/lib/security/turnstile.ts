import { z } from "zod";
import { turnstileTokenSchema } from "@nextin/shared/schemas";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).default([]),
  action: z.string().optional(),
  hostname: z.string().optional(),
});

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

/**
 * Vérifie côté serveur un jeton Cloudflare Turnstile (widget invisible).
 * Utilisé à chaque prise de ticket ; la création de session anonyme est protégée par le captcha natif Supabase Auth.
 */
export async function verifyTurnstile(
  token: unknown,
  options: { secret: string; remoteIp?: string; expectedAction?: string; fetchImpl?: typeof fetch },
): Promise<TurnstileResult> {
  const parsedToken = turnstileTokenSchema.safeParse(token);
  if (!parsedToken.success) return { ok: false, reason: "missing-input-response" };

  const body = new URLSearchParams({ secret: options.secret, response: parsedToken.data });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);

  let json: unknown;
  try {
    const res = await (options.fetchImpl ?? fetch)(VERIFY_URL, { method: "POST", body });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    json = await res.json();
  } catch {
    return { ok: false, reason: "network-error" };
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "invalid-response" };
  if (!parsed.data.success) return { ok: false, reason: parsed.data["error-codes"][0] ?? "rejected" };
  if (options.expectedAction && parsed.data.action !== options.expectedAction) return { ok: false, reason: "action-mismatch" };
  return { ok: true };
}
