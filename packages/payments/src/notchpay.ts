/**
 * Adaptateur Notch Pay (B1) : paiement créé avec la référence NextIn, débit Mobile Money demandé directement sur le
 * téléphone (MTN, Orange), page hébergée de Notch Pay en secours. Webhook signé en HMAC SHA-256 du corps brut avec la
 * clé de hachage du compte (en-tête `x-notch-signature`, hexadécimal). Le statut est toujours revérifié par l'API
 * avant toute activation (route du webhook et page de paiement).
 *
 * Variables : `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_PRIVATE_KEY`, `NOTCHPAY_WEBHOOK_HASH`, `NOTCHPAY_API_URL` (facultative).
 * Formats d'après la documentation publique de Notch Pay (developer.notchpay.co) : à valider en bac à sable avant la
 * mise en production (voir docs/payment-providers.md).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, CheckoutResult, PaymentChannel, PaymentEvent, PaymentProvider, ProviderPaymentStatus } from "./types";

export const NOTCHPAY_SIGNATURE_HEADER = "x-notch-signature";
export const NOTCHPAY_DEFAULT_API_URL = "https://api.notchpay.co";

export type NotchPayOptions = {
  publicKey: string;
  privateKey: string;
  webhookHash: string;
  apiUrl?: string;
  fetch?: typeof fetch;
};

type NotchTransaction = {
  reference?: string;
  merchant_reference?: string | null;
  trxref?: string | null;
  status?: string;
};

const CHANNELS: Record<PaymentChannel, string> = { mtn_momo: "cm.mtn", orange_money: "cm.orange" };

/** Statut Notch Pay → statut NextIn. */
export function notchStatus(status: string | undefined): ProviderPaymentStatus {
  switch ((status ?? "").toLowerCase()) {
    case "complete":
    case "completed":
    case "success":
    case "successful":
      return "succeeded";
    case "failed":
    case "canceled":
    case "cancelled":
    case "rejected":
    case "refunded":
      return "failed";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

export function signNotchWebhook(rawBody: string, hash: string): string {
  return createHmac("sha256", hash).update(rawBody).digest("hex");
}

export function createNotchPayProvider(options: NotchPayOptions): PaymentProvider {
  const base = (options.apiUrl ?? NOTCHPAY_DEFAULT_API_URL).replace(/\/+$/, "");
  const http = options.fetch ?? fetch;
  const headers = {
    Authorization: options.publicKey,
    "X-Grant": options.privateKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const call = async (path: string, init: RequestInit = {}): Promise<Record<string, unknown>> => {
    const response = await http(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new Error(`notchpay ${path}: ${response.status} ${String(body.message ?? "")}`.trim());
    return body;
  };

  const toEvent = (externalId: string, tx: NotchTransaction | undefined, eventId?: string): PaymentEvent => {
    const status = notchStatus(tx?.status);
    return {
      eventId: eventId ?? `notchpay:${tx?.reference ?? externalId}:${status}`,
      externalId: tx?.merchant_reference ?? externalId,
      status,
      providerRef: tx?.reference ?? null,
      failureReason: status === "failed" ? (tx?.status ?? "failed") : null,
    };
  };

  return {
    name: "notchpay",
    async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
      if (!Number.isInteger(request.amountXaf) || request.amountXaf <= 0) throw new RangeError("amount must be a positive integer");
      const created = await call("/payments", {
        method: "POST",
        body: JSON.stringify({
          amount: request.amountXaf,
          currency: "XAF",
          reference: request.externalId,
          description: request.description,
          phone: request.msisdn,
          callback: request.returnUrl,
        }),
      });
      const tx = created.transaction as NotchTransaction | undefined;
      const providerRef = tx?.reference ?? null;
      const hosted = typeof created.authorization_url === "string" ? created.authorization_url : null;
      if (!providerRef) return { providerRef: null, status: "pending", redirectUrl: hosted };
      // Débit direct sur le téléphone (code secret Mobile Money) ; en cas de refus, la page hébergée prend le relais.
      try {
        const charged = await call(`/payments/${encodeURIComponent(providerRef)}`, {
          method: "POST",
          body: JSON.stringify({ channel: CHANNELS[request.channel], data: { phone: request.msisdn } }),
        });
        const status = notchStatus((charged.transaction as NotchTransaction | undefined)?.status ?? (charged.status as string | undefined));
        return { providerRef, status: status === "succeeded" ? "pending" : status, redirectUrl: null };
      } catch {
        return { providerRef, status: "pending", redirectUrl: hosted };
      }
    },
    verifyWebhook(rawBody: string, requestHeaders: Headers): boolean {
      const received = (requestHeaders.get(NOTCHPAY_SIGNATURE_HEADER) ?? "").trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(received)) return false;
      const expected = signNotchWebhook(rawBody, options.webhookHash);
      return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
    },
    parseEvent(rawBody: string): PaymentEvent {
      const body = JSON.parse(rawBody) as { id?: string; type?: string; event?: string; data?: NotchTransaction };
      const tx = body.data;
      const externalId = tx?.merchant_reference ?? tx?.trxref;
      if (!tx || typeof externalId !== "string") throw new SyntaxError("invalid notchpay event");
      const type = body.type ?? body.event ?? "payment";
      return toEvent(externalId, tx, body.id ? `notchpay:${body.id}` : `notchpay:${type}:${tx.reference ?? externalId}`);
    },
    async fetchStatus(externalId: string, providerRef: string | null): Promise<PaymentEvent> {
      const body = await call(`/payments/${encodeURIComponent(providerRef ?? externalId)}`);
      const tx = (body.transaction ?? body) as NotchTransaction;
      // Référence d'un autre paiement : jamais d'activation.
      if (tx.merchant_reference && tx.merchant_reference !== externalId) {
        return { eventId: `notchpay:${externalId}:mismatch`, externalId, status: "failed", providerRef: tx.reference ?? null, failureReason: "reference_mismatch" };
      }
      return toEvent(externalId, { ...tx, merchant_reference: externalId });
    },
  };
}
