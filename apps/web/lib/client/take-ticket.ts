import type { PriorityReason } from "@nextin/shared/queue/live";
import { clearAnonSession, getAnonAccessToken, hasAnonSession } from "./anon-session";
import { requestTurnstileToken } from "./turnstile";

export type TakeTicketOutcome =
  | { ok: true; token: string; code: string }
  | { ok: false; error: string; existingPath?: string };

/**
 * Prise de ticket depuis la page client : session anonyme (créée au besoin, captcha natif Supabase),
 * nouveau jeton captcha pour la demande, puis POST /api/tickets avec le jeton d'accès.
 */
export async function takeTicket(
  input:
    | { serviceId: string; source: "qr" | "short_code"; entryCode: string; priorityReason: PriorityReason | null }
    | { serviceId: string; source: "remote"; position: { lat: number; lng: number } | null },
  captcha: { siteKey: string | null; container: HTMLElement | null },
): Promise<TakeTicketOutcome> {
  const token = async (action: string) =>
    captcha.siteKey && captcha.container ? requestTurnstileToken(captcha.siteKey, action, captcha.container) : undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    let access: string | null;
    let captchaToken: string | undefined;
    try {
      access = await getAnonAccessToken(hasAnonSession() ? undefined : await token("anonymous_sign_in"));
      captchaToken = await token("take_ticket");
    } catch {
      return { ok: false, error: "captcha_failed" };
    }
    if (!access) return { ok: false, error: navigator.onLine === false ? "network" : "generic" };

    let res: Response;
    try {
      res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify(
          input.source === "remote"
            ? {
                serviceId: input.serviceId,
                source: "remote",
                latitude: input.position?.lat,
                longitude: input.position?.lng,
                captchaToken,
              }
            : {
                serviceId: input.serviceId,
                source: input.source,
                entryCode: input.entryCode,
                priorityReason: input.priorityReason ?? undefined,
                captchaToken,
              },
        ),
      });
    } catch {
      return { ok: false, error: "network" };
    }
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      ticketUrl?: string;
      ticket?: { publicToken: string; displayCode: string };
    };
    if (res.status === 201 && body.ticket) return { ok: true, token: body.ticket.publicToken, code: body.ticket.displayCode };
    // Session expirée ou effacée côté serveur : une nouvelle session anonyme, une seule fois.
    if (res.status === 401 && attempt === 0) {
      clearAnonSession();
      continue;
    }
    return {
      ok: false,
      error: body.error ?? "generic",
      existingPath: body.ticketUrl ? new URL(body.ticketUrl).pathname : undefined,
    };
  }
  return { ok: false, error: "generic" };
}
