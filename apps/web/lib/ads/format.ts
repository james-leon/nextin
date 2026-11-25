import type { CampaignStatus, StatusTone } from "@nextin/shared/ads";
import type { Locale } from "@nextin/shared/i18n";

const tag = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");
const at = (day: string) => new Date(`${day}T12:00:00Z`);

/** « 28 nov. » : jour d'une campagne (date seule, sans fuseau). */
export function shortDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(at(day));
}

/** « 23 novembre ». */
export function longDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "long", timeZone: "UTC" }).format(at(day));
}

/**
 * Bornes d'une période en toutes lettres : « 14 » et « 28 novembre » dans le même mois (« du 14 au 28 novembre »),
 * sinon « 23 novembre » et « 6 décembre ».
 */
export function dayRange(from: string, to: string, locale: Locale): { from: string; to: string } {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return { from: sameMonth ? String(Number(from.slice(8, 10))) : longDay(from, locale), to: longDay(to, locale) };
}

/** Couleur du carré d'une campagne dans la liste (même teinte que sa pastille). */
export const STATUS_FILL: Record<StatusTone, string> = {
  green: "var(--green-fill)",
  orange: "var(--orange-fill)",
  accent: "var(--accent-fill)",
  red: "var(--red-fill)",
  neutral: "var(--icon-gray)",
};

/** Pastille d'une formule (Bronze, Argent, Or) ; une formule ajoutée par Wintek prend la couleur d'accent. */
export function medalColor(code: string): string {
  return ({ bronze: "var(--medal-bronze)", argent: "var(--medal-silver)", or: "var(--medal-gold)" } as Record<string, string>)[code] ?? "var(--accent-fill)";
}

export type { CampaignStatus };
