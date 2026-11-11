/**
 * Fournisseur actif selon `PAYMENT_PROVIDER` : `fake` (défaut), `notchpay` ou `campay` (B1). Une variable manquante
 * est refusée explicitement (le nom de la variable est donné) plutôt que de retomber en silence sur le faux.
 */
import { createCamPayProvider } from "./campay";
import { createFakeProvider } from "./fake";
import { createNotchPayProvider } from "./notchpay";
import type { PaymentProvider } from "./types";

export class PaymentConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing or invalid payment configuration: ${variable}`);
    this.name = "PaymentConfigError";
  }
}

export const PAYMENT_PROVIDERS = ["fake", "notchpay", "campay"] as const;

function required(env: Record<string, string | undefined>, name: string, minLength = 8): string {
  const value = env[name]?.trim();
  if (!value || value.length < minLength) throw new PaymentConfigError(name);
  return value;
}

export function paymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  const name = env.PAYMENT_PROVIDER?.trim() || "fake";
  switch (name) {
    case "fake": {
      const secret = required(env, "PAYMENT_WEBHOOK_SECRET", 16);
      const delay = Number(env.PAYMENT_FAKE_DELAY_MS);
      return createFakeProvider({ secret, delayMs: Number.isFinite(delay) && delay >= 0 ? delay : undefined });
    }
    case "notchpay":
      return createNotchPayProvider({
        publicKey: required(env, "NOTCHPAY_PUBLIC_KEY"),
        privateKey: required(env, "NOTCHPAY_PRIVATE_KEY"),
        webhookHash: required(env, "NOTCHPAY_WEBHOOK_HASH"),
        apiUrl: env.NOTCHPAY_API_URL?.trim() || undefined,
      });
    case "campay":
      return createCamPayProvider({
        username: required(env, "CAMPAY_USERNAME", 3),
        password: required(env, "CAMPAY_PASSWORD"),
        webhookKey: required(env, "CAMPAY_WEBHOOK_KEY"),
        apiUrl: env.CAMPAY_API_URL?.trim() || undefined,
      });
    default:
      throw new PaymentConfigError("PAYMENT_PROVIDER");
  }
}
