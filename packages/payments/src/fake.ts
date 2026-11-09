/**
 * Faux fournisseur (développement, tests, démo) en attendant le choix de l'agrégateur. Sans état : la référence du
 * fournisseur porte l'heure de début et l'issue prévue, ce qui permet la revérification depuis n'importe quel serveur.
 * Numéro se terminant par 99999 : échec simulé (même convention que le faux WhatsApp). Webhooks signés en HMAC SHA-256
 * (`x-nextin-signature`, secret `PAYMENT_WEBHOOK_SECRET`).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, CheckoutResult, PaymentEvent, PaymentProvider } from "./types";

export const FAKE_SIGNATURE_HEADER = "x-nextin-signature";
/** Délai avant la « confirmation sur le téléphone ». */
export const FAKE_DEFAULT_DELAY_MS = 3000;

type FakeRef = { e: string; t: number; f: boolean };

function encodeRef(ref: FakeRef): string {
  return `fake_${Buffer.from(JSON.stringify(ref)).toString("base64url")}`;
}

function decodeRef(providerRef: string | null): FakeRef | null {
  if (!providerRef?.startsWith("fake_")) return null;
  try {
    const ref = JSON.parse(Buffer.from(providerRef.slice(5), "base64url").toString("utf8")) as FakeRef;
    return typeof ref.e === "string" && typeof ref.t === "number" && typeof ref.f === "boolean" ? ref : null;
  } catch {
    return null;
  }
}

export function signFakeWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function isSimulatedFailure(msisdn: string): boolean {
  return msisdn.replace(/\D/g, "").endsWith("99999");
}

export function createFakeProvider(options: { secret: string; delayMs?: number; now?: () => number }): PaymentProvider {
  const delayMs = options.delayMs ?? FAKE_DEFAULT_DELAY_MS;
  const now = options.now ?? Date.now;

  const statusOf = (externalId: string, providerRef: string | null): PaymentEvent => {
    const ref = decodeRef(providerRef);
    if (!ref || ref.e !== externalId) {
      return { eventId: `fake:${externalId}:unknown`, externalId, status: "failed", providerRef, failureReason: "unknown_reference" };
    }
    if (now() - ref.t < delayMs) {
      return { eventId: `fake:${externalId}:pending`, externalId, status: "pending", providerRef, failureReason: null };
    }
    const status = ref.f ? "failed" : "succeeded";
    return { eventId: `fake:${externalId}:${status}`, externalId, status, providerRef, failureReason: ref.f ? "insufficient_funds" : null };
  };

  return {
    name: "fake",
    async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
      if (!Number.isInteger(request.amountXaf) || request.amountXaf <= 0) throw new RangeError("amount must be a positive integer");
      const providerRef = encodeRef({ e: request.externalId, t: now(), f: isSimulatedFailure(request.msisdn) });
      return { providerRef, status: "pending", redirectUrl: null };
    },
    verifyWebhook(rawBody: string, headers: Headers): boolean {
      const received = headers.get(FAKE_SIGNATURE_HEADER) ?? "";
      const expected = signFakeWebhook(rawBody, options.secret);
      if (!/^[0-9a-f]{64}$/.test(received)) return false;
      return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
    },
    parseEvent(rawBody: string): PaymentEvent {
      const body = JSON.parse(rawBody) as Partial<PaymentEvent>;
      if (typeof body.externalId !== "string" || !["pending", "succeeded", "failed", "expired"].includes(String(body.status))) {
        throw new SyntaxError("invalid fake payment event");
      }
      return {
        eventId: typeof body.eventId === "string" ? body.eventId : `fake:${body.externalId}:${body.status}`,
        externalId: body.externalId,
        status: body.status as PaymentEvent["status"],
        providerRef: typeof body.providerRef === "string" ? body.providerRef : null,
        failureReason: typeof body.failureReason === "string" ? body.failureReason : null,
      };
    },
    async fetchStatus(externalId: string, providerRef: string | null): Promise<PaymentEvent> {
      return statusOf(externalId, providerRef);
    },
  };
}
