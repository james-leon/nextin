import { randomUUID } from "node:crypto";
import { maskPhone, type SendResult, type WhatsAppProvider } from "./types";

/** Version de la Graph API de Meta (WhatsApp Cloud API). */
export const GRAPH_API_VERSION = "v23.0";
const GRAPH_API = "https://graph.facebook.com";

/** Codes d'erreur Meta temporaires (limites de débit, indisponibilité) : nouvel essai plus tard. */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 80007, 130429, 131000, 131016, 131048, 131056, 133004]);

type GraphError = { error?: { code?: number; message?: string; error_data?: { details?: string } } };

/** WhatsApp Cloud API : POST /<WHATSAPP_PHONE_NUMBER_ID>/messages avec le jeton d'accès permanent. */
export function cloudWhatsApp(config: { token: string; phoneNumberId: string }, fetchImpl: typeof fetch = fetch): WhatsAppProvider {
  async function post(body: Record<string, unknown>): Promise<SendResult> {
    let res: Response;
    try {
      res = await fetchImpl(`${GRAPH_API}/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      return { ok: false, retryable: true, error: `network: ${(e as Error).message}` };
    }
    const json = (await res.json().catch(() => ({}))) as GraphError & { messages?: { id: string }[] };
    const id = json.messages?.[0]?.id;
    if (res.ok && id) return { ok: true, messageId: id };
    const code = json.error?.code ?? res.status;
    const detail = json.error?.error_data?.details ?? json.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, retryable: res.status >= 500 || res.status === 429 || RETRYABLE_CODES.has(code), error: `${code}: ${detail}` };
  }
  return {
    name: "cloud",
    sendText: (to, text) => post({ to: to.replace(/^\+/, ""), type: "text", text: { body: text, preview_url: true } }),
    sendTemplate: (to, template, language, params) =>
      post({
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
  };
}

/**
 * Faux fournisseur (compte Meta pas encore prêt, développement, tests) : rien n'est envoyé, le texte est gardé
 * dans `notification_jobs.payload` (`pnpm notify:outbox`). Numéro de test se terminant par 99999 : échec
 * définitif simulé (bascule vers le SMS de secours).
 */
export function fakeWhatsApp(log: (line: string) => void = () => undefined): WhatsAppProvider {
  const send = async (to: string, what: string): Promise<SendResult> => {
    if (to.endsWith("99999")) return { ok: false, retryable: false, error: "131026: fake undeliverable recipient" };
    log(`[whatsapp:fake] ${maskPhone(to)} ${what}`);
    return { ok: true, messageId: `fake.${randomUUID()}` };
  };
  return {
    name: "fake",
    sendText: (to, text) => send(to, text.split("\n")[0]!),
    sendTemplate: (to, template, language, params) => send(to, `${template}/${language} ${params.join(" | ")}`),
  };
}
