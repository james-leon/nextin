import { describe, expect, it, vi } from "vitest";
import { campayStatus, createCamPayProvider, signCamPayJwt, verifyCamPayJwt } from "./campay";
import { createNotchPayProvider, notchStatus, signNotchWebhook } from "./notchpay";
import { PaymentConfigError, paymentProvider } from "./select";

const request = {
  externalId: "nx_abc123",
  amountXaf: 25000,
  channel: "mtn_momo" as const,
  msisdn: "+237677123456",
  description: "Abonnement NextIn",
  callbackUrl: "https://app.nextin.example/api/payments/webhook/x",
  returnUrl: "https://app.nextin.example/pay/token",
};

/** Faux réseau : réponses successives, appels enregistrés. */
function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("sélection du fournisseur (PAYMENT_PROVIDER)", () => {
  it("faux fournisseur par défaut", () => {
    expect(paymentProvider({ PAYMENT_WEBHOOK_SECRET: "s".repeat(32) }).name).toBe("fake");
  });
  it("Notch Pay et CamPay avec leurs clés", () => {
    expect(
      paymentProvider({ PAYMENT_PROVIDER: "notchpay", NOTCHPAY_PUBLIC_KEY: "pk.test_abcdef", NOTCHPAY_PRIVATE_KEY: "sk.test_abcdef", NOTCHPAY_WEBHOOK_HASH: "hash_abcdef12" }).name,
    ).toBe("notchpay");
    expect(paymentProvider({ PAYMENT_PROVIDER: "campay", CAMPAY_USERNAME: "app", CAMPAY_PASSWORD: "password1", CAMPAY_WEBHOOK_KEY: "webhookkey1" }).name).toBe("campay");
  });
  it("clé manquante : erreur qui nomme la variable", () => {
    expect(() => paymentProvider({ PAYMENT_PROVIDER: "notchpay", NOTCHPAY_PUBLIC_KEY: "pk.test_abcdef" })).toThrow(
      new PaymentConfigError("NOTCHPAY_PRIVATE_KEY"),
    );
    expect(() => paymentProvider({ PAYMENT_PROVIDER: "cinetpay" })).toThrow(new PaymentConfigError("PAYMENT_PROVIDER"));
  });
});

describe("Notch Pay", () => {
  const options = { publicKey: "pk.test_abc", privateKey: "sk.test_abc", webhookHash: "hash_secret", apiUrl: "https://api.notchpay.test" };

  it("statuts", () => {
    expect(notchStatus("complete")).toBe("succeeded");
    expect(notchStatus("canceled")).toBe("failed");
    expect(notchStatus("expired")).toBe("expired");
    expect(notchStatus("processing")).toBe("pending");
  });

  it("paiement créé avec la référence NextIn, puis débit direct sur le téléphone (MTN)", async () => {
    const net = fakeFetch([
      { status: 201, body: { transaction: { reference: "trx.123", status: "pending" }, authorization_url: "https://pay.notchpay.test/trx.123" } },
      { status: 202, body: { transaction: { reference: "trx.123", status: "processing" } } },
    ]);
    const provider = createNotchPayProvider({ ...options, fetch: net.fn });
    const result = await provider.createCheckout(request);
    expect(result).toEqual({ providerRef: "trx.123", status: "pending", redirectUrl: null });
    expect(net.calls[0]!.url).toBe("https://api.notchpay.test/payments");
    expect(JSON.parse(String(net.calls[0]!.init.body))).toMatchObject({ amount: 25000, currency: "XAF", reference: "nx_abc123" });
    expect((net.calls[0]!.init.headers as Record<string, string>).Authorization).toBe("pk.test_abc");
    expect(net.calls[1]!.url).toBe("https://api.notchpay.test/payments/trx.123");
    expect(JSON.parse(String(net.calls[1]!.init.body))).toEqual({ channel: "cm.mtn", data: { phone: "+237677123456" } });
  });

  it("débit direct refusé : page hébergée en secours", async () => {
    const net = fakeFetch([
      { body: { transaction: { reference: "trx.9" }, authorization_url: "https://pay.notchpay.test/trx.9" } },
      { status: 422, body: { message: "channel unavailable" } },
    ]);
    const result = await createNotchPayProvider({ ...options, fetch: net.fn }).createCheckout({ ...request, channel: "orange_money" });
    expect(result).toEqual({ providerRef: "trx.9", status: "pending", redirectUrl: "https://pay.notchpay.test/trx.9" });
  });

  it("webhook : signature HMAC SHA-256 du corps brut, en-tête x-notch-signature", () => {
    const provider = createNotchPayProvider(options);
    const raw = JSON.stringify({ id: "evt_1", type: "payment.complete", data: { reference: "trx.123", merchant_reference: "nx_abc123", status: "complete" } });
    const good = new Headers({ "x-notch-signature": signNotchWebhook(raw, "hash_secret") });
    expect(provider.verifyWebhook(raw, good)).toBe(true);
    expect(provider.verifyWebhook(`${raw} `, good)).toBe(false);
    expect(provider.verifyWebhook(raw, new Headers({ "x-notch-signature": signNotchWebhook(raw, "autre") }))).toBe(false);
    expect(provider.verifyWebhook(raw, new Headers())).toBe(false);
    expect(provider.parseEvent(raw)).toEqual({
      eventId: "notchpay:evt_1",
      externalId: "nx_abc123",
      status: "succeeded",
      providerRef: "trx.123",
      failureReason: null,
    });
  });

  it("revérification : statut de l'API ; référence d'un autre paiement refusée", async () => {
    const net = fakeFetch([
      { body: { transaction: { reference: "trx.123", merchant_reference: "nx_abc123", status: "complete" } } },
      { body: { transaction: { reference: "trx.123", merchant_reference: "nx_other", status: "complete" } } },
    ]);
    const provider = createNotchPayProvider({ ...options, fetch: net.fn });
    expect((await provider.fetchStatus("nx_abc123", "trx.123")).status).toBe("succeeded");
    expect(await provider.fetchStatus("nx_abc123", "trx.123")).toMatchObject({ status: "failed", failureReason: "reference_mismatch" });
  });
});

describe("CamPay", () => {
  const options = { username: "app", password: "password1", webhookKey: "webhook-key", apiUrl: "https://demo.campay.test/api" };

  it("statuts", () => {
    expect(campayStatus("SUCCESSFUL")).toBe("succeeded");
    expect(campayStatus("FAILED")).toBe("failed");
    expect(campayStatus("PENDING")).toBe("pending");
  });

  it("jeton d'accès puis demande de débit sur le téléphone (numéro sans +), jeton réutilisé", async () => {
    const net = fakeFetch([
      { body: { token: "tok-1", expires_in: 3600 } },
      { body: { reference: "cp-ref-1", ussd_code: "*126#", operator: "MTN" } },
      { body: { reference: "cp-ref-1", external_reference: "nx_abc123", status: "SUCCESSFUL" } },
    ]);
    const provider = createCamPayProvider({ ...options, fetch: net.fn });
    expect(await provider.createCheckout(request)).toEqual({ providerRef: "cp-ref-1", status: "pending", redirectUrl: null });
    expect(net.calls[0]!.url).toBe("https://demo.campay.test/api/token/");
    expect(net.calls[1]!.url).toBe("https://demo.campay.test/api/collect/");
    expect((net.calls[1]!.init.headers as Record<string, string>).Authorization).toBe("Token tok-1");
    expect(JSON.parse(String(net.calls[1]!.init.body))).toMatchObject({ amount: "25000", currency: "XAF", from: "237677123456", external_reference: "nx_abc123" });
    expect((await provider.fetchStatus("nx_abc123", "cp-ref-1")).status).toBe("succeeded");
    expect(net.calls).toHaveLength(3);
    expect(net.calls[2]!.url).toBe("https://demo.campay.test/api/transaction/cp-ref-1/");
  });

  it("webhook GET : signature JWT HS256 avec la clé de webhook", () => {
    const provider = createCamPayProvider(options);
    const query = (signature: string) =>
      new URLSearchParams({ status: "SUCCESSFUL", reference: "cp-ref-1", external_reference: "nx_abc123", amount: "25000", signature }).toString();
    expect(provider.verifyWebhook(query(signCamPayJwt({ ref: "cp-ref-1" }, "webhook-key")), new Headers())).toBe(true);
    expect(provider.verifyWebhook(query(signCamPayJwt({ ref: "cp-ref-1" }, "autre-cle")), new Headers())).toBe(false);
    expect(provider.verifyWebhook(query("pas.un.jeton"), new Headers())).toBe(false);
    expect(provider.parseEvent(query("x"))).toEqual({
      eventId: "campay:cp-ref-1:succeeded",
      externalId: "nx_abc123",
      status: "succeeded",
      providerRef: "cp-ref-1",
      failureReason: null,
    });
  });

  it("jeton expiré ou d'un autre algorithme : refusé", () => {
    expect(verifyCamPayJwt(signCamPayJwt({ exp: Math.floor(Date.now() / 1000) - 60 }, "k"), "k")).toBe(false);
    const none = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from("{}").toString("base64url")}.`;
    expect(verifyCamPayJwt(none, "k")).toBe(false);
  });
});
