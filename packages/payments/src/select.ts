/**
 * Fournisseur actif selon `PAYMENT_PROVIDER` (défaut : `fake`). Un fournisseur réel non encore branché est refusé
 * explicitement plutôt que de retomber en silence sur le faux.
 */
import { createFakeProvider } from "./fake";
import type { PaymentProvider } from "./types";

export class PaymentConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing or invalid payment configuration: ${variable}`);
    this.name = "PaymentConfigError";
  }
}

export function paymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  const name = env.PAYMENT_PROVIDER?.trim() || "fake";
  if (name !== "fake") throw new PaymentConfigError("PAYMENT_PROVIDER");
  const secret = env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) throw new PaymentConfigError("PAYMENT_WEBHOOK_SECRET");
  const delay = Number(env.PAYMENT_FAKE_DELAY_MS);
  return createFakeProvider({ secret, delayMs: Number.isFinite(delay) && delay >= 0 ? delay : undefined });
}
