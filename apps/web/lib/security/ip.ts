import { createHash } from "node:crypto";

/** Première adresse de X-Forwarded-For (Vercel), sinon X-Real-IP. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

/** Empreinte d'IP salée : seule forme stockée (rate limiting, audit). */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
