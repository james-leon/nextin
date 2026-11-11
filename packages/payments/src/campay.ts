/**
 * Adaptateur CamPay (B1) : débit Mobile Money demandé sur le téléphone (`/collect/`, MTN et Orange), statut par
 * `/transaction/<référence>/`. Le webhook de CamPay est un appel GET avec les paramètres dans l'adresse et un jeton
 * `signature` (JWT HS256 signé avec la clé de webhook du compte) : la route le transmet comme chaîne de requête.
 * Le statut est toujours revérifié par l'API avant toute activation.
 *
 * Variables : `CAMPAY_USERNAME`, `CAMPAY_PASSWORD` (identifiants de l'application), `CAMPAY_WEBHOOK_KEY`,
 * `CAMPAY_API_URL` (bac à sable par défaut ; production : https://www.campay.net/api).
 * Formats d'après la documentation publique de CamPay : à valider en bac à sable avant la mise en production.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, CheckoutResult, PaymentEvent, PaymentProvider, ProviderPaymentStatus } from "./types";

export const CAMPAY_DEFAULT_API_URL = "https://demo.campay.net/api";

export type CamPayOptions = {
  username: string;
  password: string;
  webhookKey: string;
  apiUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
};

type CamPayTransaction = { reference?: string; external_reference?: string | null; status?: string; reason?: string | null };

/** Statut CamPay → statut NextIn. */
export function campayStatus(status: string | undefined): ProviderPaymentStatus {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESSFUL":
    case "SUCCESS":
      return "succeeded";
    case "FAILED":
    case "CANCELLED":
    case "CANCELED":
      return "failed";
    case "EXPIRED":
      return "expired";
    default:
      return "pending";
  }
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Jeton HS256 (tests et faux webhooks) : même format que la signature envoyée par CamPay. */
export function signCamPayJwt(payload: Record<string, unknown>, key: string): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", key).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** Vérifie un JWT HS256 (signature en temps constant, expiration si présente). */
export function verifyCamPayJwt(token: string, key: string, now = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [head, body, sig] = parts as [string, string, string];
  try {
    const header = JSON.parse(Buffer.from(head, "base64url").toString("utf8")) as { alg?: string };
    if (header.alg !== "HS256") return false;
    const expected = createHmac("sha256", key).update(`${head}.${body}`).digest();
    const received = Buffer.from(sig, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: number };
    return typeof claims.exp !== "number" || claims.exp * 1000 > now;
  } catch {
    return false;
  }
}

export function createCamPayProvider(options: CamPayOptions): PaymentProvider {
  const base = (options.apiUrl ?? CAMPAY_DEFAULT_API_URL).replace(/\/+$/, "");
  const http = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let cached: { token: string; until: number } | null = null;

  /** Jeton d'accès de l'application (valable environ une heure ; renouvelé 5 minutes avant). */
  const token = async (): Promise<string> => {
    if (cached && cached.until > now()) return cached.token;
    const response = await http(`${base}/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: options.username, password: options.password }),
    });
    const body = (await response.json().catch(() => ({}))) as { token?: string; expires_in?: number };
    if (!response.ok || !body.token) throw new Error(`campay token: ${response.status}`);
    cached = { token: body.token, until: now() + Math.max(60, (body.expires_in ?? 3600) - 300) * 1000 };
    return body.token;
  };

  const call = async (path: string, init: RequestInit = {}): Promise<Record<string, unknown>> => {
    const response = await http(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Token ${await token()}`, "Content-Type": "application/json", Accept: "application/json" },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new Error(`campay ${path}: ${response.status} ${String(body.message ?? "")}`.trim());
    return body;
  };

  return {
    name: "campay",
    async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
      if (!Number.isInteger(request.amountXaf) || request.amountXaf <= 0) throw new RangeError("amount must be a positive integer");
      const body = await call("/collect/", {
        method: "POST",
        body: JSON.stringify({
          amount: String(request.amountXaf),
          currency: "XAF",
          from: request.msisdn.replace(/^\+/, ""),
          description: request.description,
          external_reference: request.externalId,
        }),
      });
      const reference = typeof body.reference === "string" ? body.reference : null;
      // Confirmation sur le téléphone (code secret) : pas de page hébergée.
      return { providerRef: reference, status: "pending", redirectUrl: null };
    },
    /** `rawBody` : chaîne de requête de l'appel GET de CamPay (`status=…&reference=…&signature=…`). */
    verifyWebhook(rawBody: string): boolean {
      const signature = new URLSearchParams(rawBody).get("signature");
      return !!signature && verifyCamPayJwt(signature, options.webhookKey, now());
    },
    parseEvent(rawBody: string): PaymentEvent {
      const q = new URLSearchParams(rawBody);
      const externalId = q.get("external_reference");
      const reference = q.get("reference");
      if (!externalId || !reference) throw new SyntaxError("invalid campay event");
      const status = campayStatus(q.get("status") ?? undefined);
      return {
        eventId: `campay:${reference}:${status}`,
        externalId,
        status,
        providerRef: reference,
        failureReason: status === "failed" ? (q.get("reason") ?? "failed") : null,
      };
    },
    async fetchStatus(externalId: string, providerRef: string | null): Promise<PaymentEvent> {
      if (!providerRef) {
        return { eventId: `campay:${externalId}:unknown`, externalId, status: "pending", providerRef: null, failureReason: null };
      }
      const tx = (await call(`/transaction/${encodeURIComponent(providerRef)}/`)) as CamPayTransaction;
      if (tx.external_reference && tx.external_reference !== externalId) {
        return { eventId: `campay:${externalId}:mismatch`, externalId, status: "failed", providerRef, failureReason: "reference_mismatch" };
      }
      const status = campayStatus(tx.status);
      return {
        eventId: `campay:${providerRef}:${status}`,
        externalId,
        status,
        providerRef,
        failureReason: status === "failed" ? (tx.reason ?? "failed") : null,
      };
    },
  };
}
