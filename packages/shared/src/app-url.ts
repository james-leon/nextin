import { z } from "zod";

const appUrlSchema = z
  .string({ error: "APP_URL is not set" })
  .url("APP_URL must be an absolute URL")
  .transform((v) => v.replace(/\/+$/, ""));

/**
 * URL publique de l'application, lue exclusivement dans la variable APP_URL.
 * Toute URL absolue (QR codes, liens WhatsApp, PDF) doit être construite via cette fonction.
 */
export function getAppUrl(env: Record<string, string | undefined> = process.env): string {
  return appUrlSchema.parse(env.APP_URL);
}

export function absoluteUrl(path: string, env?: Record<string, string | undefined>): string {
  const base = getAppUrl(env);
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
