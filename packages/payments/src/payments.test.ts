import { describe, expect, it } from "vitest";
import { createFakeProvider, FAKE_SIGNATURE_HEADER, paymentProvider, PaymentConfigError, signFakeWebhook } from "./index";

const secret = "test-secret-0123456789";
const request = {
  externalId: "nx_ABCDEFGHIJKLMNOPQRST",
  amountXaf: 25000,
  channel: "mtn_momo" as const,
  msisdn: "+237677100001",
  description: "NextIn FAC-2026-000001",
  callbackUrl: "https://example.test/api/payments/webhook/fake",
  returnUrl: "https://example.test/pay/x",
};

describe("faux fournisseur", () => {
  it("en attente, puis réussi après le délai (sans état)", async () => {
    let t = 1_000_000;
    const provider = createFakeProvider({ secret, delayMs: 3000, now: () => t });
    const checkout = await provider.createCheckout(request);
    expect(checkout.status).toBe("pending");
    expect((await provider.fetchStatus(request.externalId, checkout.providerRef)).status).toBe("pending");
    t += 3000;
    const done = await provider.fetchStatus(request.externalId, checkout.providerRef);
    expect(done).toMatchObject({ status: "succeeded", failureReason: null });
    // Une autre instance (autre serveur) donne la même réponse.
    const other = createFakeProvider({ secret, delayMs: 3000, now: () => t });
    expect((await other.fetchStatus(request.externalId, checkout.providerRef)).status).toBe("succeeded");
  });
  it("numéro en 99999 : échec simulé", async () => {
    const provider = createFakeProvider({ secret, delayMs: 0 });
    const checkout = await provider.createCheckout({ ...request, msisdn: "+237677999999" });
    expect(await provider.fetchStatus(request.externalId, checkout.providerRef)).toMatchObject({ status: "failed", failureReason: "insufficient_funds" });
  });
  it("référence d'un autre paiement : refusée", async () => {
    const provider = createFakeProvider({ secret, delayMs: 0 });
    const checkout = await provider.createCheckout(request);
    expect((await provider.fetchStatus("nx_OTHEROTHEROTHEROTHE", checkout.providerRef)).status).toBe("failed");
    expect((await provider.fetchStatus(request.externalId, "garbage")).status).toBe("failed");
  });
  it("montant entier positif exigé", async () => {
    const provider = createFakeProvider({ secret });
    await expect(provider.createCheckout({ ...request, amountXaf: 10.5 })).rejects.toThrow(RangeError);
  });
  it("webhook signé HMAC SHA-256", () => {
    const provider = createFakeProvider({ secret });
    const body = JSON.stringify({ externalId: request.externalId, status: "succeeded", eventId: "evt_1" });
    const ok = new Headers({ [FAKE_SIGNATURE_HEADER]: signFakeWebhook(body, secret) });
    expect(provider.verifyWebhook(body, ok)).toBe(true);
    expect(provider.verifyWebhook(body + " ", ok)).toBe(false);
    expect(provider.verifyWebhook(body, new Headers({ [FAKE_SIGNATURE_HEADER]: signFakeWebhook(body, "other-secret-000000") }))).toBe(false);
    expect(provider.verifyWebhook(body, new Headers())).toBe(false);
    expect(provider.parseEvent(body)).toEqual({ eventId: "evt_1", externalId: request.externalId, status: "succeeded", providerRef: null, failureReason: null });
    expect(() => provider.parseEvent('{"status":"paid"}')).toThrow(SyntaxError);
  });
});

describe("choix du fournisseur", () => {
  it("faux par défaut, secret exigé", () => {
    expect(paymentProvider({ PAYMENT_WEBHOOK_SECRET: secret }).name).toBe("fake");
    expect(() => paymentProvider({})).toThrow(PaymentConfigError);
  });
  it("fournisseur réel non branché : refusé explicitement", () => {
    expect(() => paymentProvider({ PAYMENT_PROVIDER: "notchpay", PAYMENT_WEBHOOK_SECRET: secret })).toThrow(PaymentConfigError);
  });
});
