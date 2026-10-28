import { formatXaf } from "@nextin/shared";
import type { Locale } from "@nextin/shared/i18n";

export const BILLING_TIME_ZONE = "Africa/Douala";

/** « 12 novembre 2026 » à l'heure de Douala. */
export function formatDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BILLING_TIME_ZONE,
  }).format(new Date(iso));
}

/** « 12 nov. 2026 » (listes). */
export function formatShortDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BILLING_TIME_ZONE,
  }).format(new Date(iso));
}

/** Montant pour un PDF : espaces ordinaires (la police embarquée n'a pas l'espace fine insécable). */
export function formatXafPlain(amount: number, locale: Locale): string {
  return formatXaf(amount, locale).replace(/[  ]/g, " ");
}
