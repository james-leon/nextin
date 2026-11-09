import type { Locale } from "./i18n/config";

/** Montants en francs CFA (XAF) : entiers, sans décimales. */
export function formatXaf(amount: number, locale: Locale = "fr"): string {
  if (!Number.isInteger(amount)) throw new RangeError("XAF amounts must be integers");
  const n = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 0 }).format(amount);
  // Intl utilise une espace fine insécable en français ; on la conserve pour éviter les retours à la ligne.
  return `${n} FCFA`;
}
