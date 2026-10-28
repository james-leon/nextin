import { clearAnonSession, getAnonAccessToken, hasAnonSession } from "./anon-session";
import { requestTurnstileToken } from "./turnstile";

export type RequestOutcome = { ok: true; token: string } | { ok: false; error: string };
type Captcha = { siteKey: string | null; container: HTMLElement | null };

const captchaToken = (captcha: Captcha, action: string) =>
  captcha.siteKey && captcha.container ? requestTurnstileToken(captcha.siteKey, action, captcha.container) : Promise.resolve(undefined);

/**
 * Demande de rendez-vous depuis la page publique (M9) : session anonyme (créée au besoin), jeton captcha,
 * puis POST /api/appointment-requests. Renvoie le jeton du lien /r/<jeton> (saisie du code WhatsApp).
 */
export async function sendAppointmentRequest(body: Record<string, unknown>, captcha: Captcha): Promise<RequestOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let access: string | null;
    let token: string | undefined;
    try {
      access = await getAnonAccessToken(hasAnonSession() ? undefined : await captchaToken(captcha, "anonymous_sign_in"));
      token = await captchaToken(captcha, "appointment_request");
    } catch {
      return { ok: false, error: "captcha_failed" };
    }
    if (!access) return { ok: false, error: navigator.onLine === false ? "network" : "generic" };
    let res: Response;
    try {
      res = await fetch("/api/appointment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ ...body, captchaToken: token }),
      });
    } catch {
      return { ok: false, error: "network" };
    }
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; error?: string };
    if (res.status === 201 && json.token) return { ok: true, token: json.token };
    if (res.status === 401 && attempt === 0) {
      clearAnonSession();
      continue;
    }
    return { ok: false, error: json.error ?? "generic" };
  }
  return { ok: false, error: "generic" };
}

/** Nouveau code de vérification (3 au plus par demande). */
export async function resendRequestCode(requestToken: string, captcha: Captcha): Promise<{ ok: boolean; error?: string }> {
  let token: string | undefined;
  try {
    token = await captchaToken(captcha, "request_code");
  } catch {
    return { ok: false, error: "captcha_failed" };
  }
  try {
    const res = await fetch("/api/appointment-requests/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: requestToken, captchaToken: token }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return json.ok ? { ok: true } : { ok: false, error: json.error ?? "generic" };
  } catch {
    return { ok: false, error: "network" };
  }
}
