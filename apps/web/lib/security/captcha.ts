import { verifyTurnstile, type TurnstileResult } from "./turnstile";

export type CaptchaConfig = { enabled: boolean; siteKey: string | null };

function isPublicUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Turnstile est actif dès que les deux clés sont présentes.
 * Sans clé, il est désactivé (développement local, CI) — mais un déploiement public
 * (APP_URL en https hors localhost) sans clé est refusé, pour ne jamais exposer la prise
 * de ticket ou la connexion sans protection.
 */
export function captchaConfig(env: Record<string, string | undefined> = process.env): CaptchaConfig {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  const secret = env.TURNSTILE_SECRET_KEY || null;
  if (siteKey && secret) return { enabled: true, siteKey };
  if (siteKey || secret) {
    throw new Error("Turnstile is half-configured: set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY");
  }
  if (isPublicUrl(env.APP_URL)) {
    throw new Error("Turnstile keys are required when APP_URL is a public https URL");
  }
  return { enabled: false, siteKey: null };
}

/**
 * Vérification serveur d'un jeton pour les actions hors Supabase Auth (création d'établissement, prise de ticket).
 * Les actions Supabase Auth transmettent le jeton à Supabase (captcha natif) : un jeton ne sert qu'une fois.
 */
export async function verifyCaptchaToken(
  token: unknown,
  options: { remoteIp?: string; expectedAction?: string; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<TurnstileResult> {
  const env = options.env ?? process.env;
  if (!captchaConfig(env).enabled) return { ok: true };
  return verifyTurnstile(token, {
    secret: env.TURNSTILE_SECRET_KEY!,
    remoteIp: options.remoteIp,
    expectedAction: options.expectedAction,
    fetchImpl: options.fetchImpl,
  });
}
