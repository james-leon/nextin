import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature des webhooks Meta : en-tête `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 du corps brut
 * avec le secret de l'application (WHATSAPP_APP_SECRET). Comparaison à temps constant.
 */
export function signMetaPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

export function verifyMetaSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !/^sha256=[0-9a-f]{64}$/.test(header)) return false;
  const expected = Buffer.from(signMetaPayload(rawBody, secret));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
