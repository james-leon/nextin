/**
 * Tableau de bord (M8) : périodes, comparaison, écarts et export CSV. Logique pure, sans dépendance, testée.
 * Les jours sont des jours locaux de l'agence (`YYYY-MM-DD`).
 */
import { addDays, weekStart, type IsoDate } from "../appointments/calendar";

/**
 * « 30 derniers jours » (glissants, période par défaut), « Aujourd'hui », « Hier », puis jour, semaine, mois et
 * « Période personnalisée » (C4 : du … au …, 92 jours au plus, dans la limite d'historique de la formule).
 */
export const STATS_PERIODS = ["last30", "today", "yesterday", "day", "week", "month", "custom"] as const;
/** Durée maximale d'une période personnalisée (au-delà : export, et alerte de sécurité S3). */
export const MAX_CUSTOM_DAYS = 92;
/** Durée de la période glissante par défaut. */
export const ROLLING_DAYS = 30;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export type DateRange = { from: IsoDate; to: IsoDate };

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}
function monthEnd(date: IsoDate): IsoDate {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Période contenant le jour de référence : les 30 jours qui s'y terminent, le jour, la semaine (lundi → dimanche) ou le mois. */
export function periodRange(period: StatsPeriod, anchor: IsoDate): DateRange {
  if (period === "last30") return { from: addDays(anchor, -(ROLLING_DAYS - 1)), to: anchor };
  // « Aujourd'hui » et « Personnalisée » (sans bornes) : le jour de référence ; « Hier » : la veille.
  if (period === "day" || period === "today" || period === "custom") return { from: anchor, to: anchor };
  if (period === "yesterday") return { from: addDays(anchor, -1), to: addDays(anchor, -1) };
  if (period === "week") return { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) };
  return { from: monthStart(anchor), to: monthEnd(anchor) };
}

/**
 * Période de comparaison : même jour de la semaine précédente (« vs mardi dernier »), semaine précédente,
 * mois précédent. Une période en cours n'est comparée qu'à la même durée écoulée (`today`).
 */
export function comparisonRange(period: StatsPeriod, range: DateRange, today: IsoDate): DateRange {
  const end = range.to > today ? today : range.to;
  if (period === "last30") return { from: addDays(range.from, -ROLLING_DAYS), to: addDays(range.from, -1) };
  // Aujourd'hui, hier, personnalisée : la période précédente de même durée (aujourd'hui → hier).
  if (period === "today" || period === "yesterday" || period === "custom") {
    return { from: addDays(range.from, -rangeDays(range)), to: addDays(range.from, -1) };
  }
  if (period === "day") return { from: addDays(range.from, -7), to: addDays(range.from, -7) };
  if (period === "week") return { from: addDays(range.from, -7), to: addDays(end, -7) };
  const previousStart = monthStart(addDays(range.from, -1));
  const elapsed = Math.round((Date.parse(end) - Date.parse(range.from)) / 86_400_000);
  const candidate = addDays(previousStart, elapsed);
  const previousEnd = monthEnd(previousStart);
  return { from: previousStart, to: candidate > previousEnd ? previousEnd : candidate };
}

/** Nombre de jours d'une période (bornes comprises). */
export function rangeDays(range: DateRange): number {
  return Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) + 1;
}

/** Une période d'un seul jour (affluence par heure plutôt que par jour). */
export function isSingleDay(period: StatsPeriod, range: DateRange): boolean {
  return period === "day" || period === "today" || period === "yesterday" || range.from === range.to;
}

/** Périodes qui se parcourent avec « précédente / suivante » (les autres sont fixes ou choisies). */
export function isNavigable(period: StatsPeriod): boolean {
  return period === "last30" || period === "day" || period === "week" || period === "month";
}

export type CustomRangeError = "range_invalid" | "range_order" | "range_future" | "range_too_long" | "range_history";

/**
 * Période personnalisée valide : dates lisibles, début avant la fin, rien dans le futur, 92 jours au plus,
 * pas avant le premier jour couvert par la formule (`historyFrom`, null : tout l'historique).
 */
export function customRangeError(from: string, to: string, today: IsoDate, historyFrom: IsoDate | null): CustomRangeError | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(from) || !iso.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return "range_invalid";
  if (from > to) return "range_order";
  if (to > today) return "range_future";
  if (rangeDays({ from, to }) > MAX_CUSTOM_DAYS) return "range_too_long";
  if (historyFrom && from < historyFrom) return "range_history";
  return null;
}

/** Période suivante ou précédente (navigation). */
export function shiftPeriod(period: StatsPeriod, anchor: IsoDate, step: -1 | 1): IsoDate {
  if (!isNavigable(period)) return anchor;
  if (period === "last30") return addDays(anchor, ROLLING_DAYS * step);
  if (period === "day") return addDays(anchor, step);
  if (period === "week") return addDays(anchor, 7 * step);
  return step === 1 ? addDays(monthEnd(anchor), 1) : monthStart(addDays(monthStart(anchor), -1));
}

/** En dessous de ce nombre de jours renseignés, une courbe n'est pas tracée (état vide « pas encore assez de données »). */
export const MIN_CHART_POINTS = 7;

/** Assez de points pour tracer une courbe ? (valeurs non nulles) */
export function hasEnoughPoints(values: readonly (number | null | undefined)[], min = MIN_CHART_POINTS): boolean {
  return values.filter((v) => v != null).length >= min;
}

export type DeltaKind = "percent" | "minutes" | "points";
/** Sens souhaité : `up` (plus de tickets), `down` (moins d'attente, moins d'abandons), `neutral`. */
export type DeltaGoal = "up" | "down" | "neutral";
export type Delta = { value: number; kind: DeltaKind; tone: "good" | "bad" | "neutral" } | null;

/**
 * Écart avec la période de comparaison : en % pour un volume, en minutes pour une durée (secondes en entrée),
 * en points pour un taux. Null si la comparaison n'a pas de sens (pas de donnée).
 */
export function delta(current: number | null | undefined, previous: number | null | undefined, kind: DeltaKind, goal: DeltaGoal): Delta {
  if (current == null || previous == null) return null;
  let value: number;
  if (kind === "percent") {
    if (previous === 0) return null;
    value = Math.round(((current - previous) / previous) * 100);
  } else if (kind === "minutes") {
    value = Math.round((current - previous) / 60);
  } else {
    value = Math.round((current - previous) * 10) / 10;
  }
  const tone = value === 0 || goal === "neutral" ? "neutral" : (value > 0) === (goal === "up") ? "good" : "bad";
  return { value, kind, tone };
}

/** Index du maximum (pic d'affluence), ou -1 si tout est nul. */
export function peakIndex(values: readonly number[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (v > 0 && (best < 0 || v > values[best]!)) best = i;
  });
  return best;
}

/** Durée en minutes arrondies (null conservé). */
export function toMinutes(seconds: number | null | undefined): number | null {
  return seconds == null ? null : Math.round(seconds / 60);
}

/**
 * CSV pour Excel en français : séparateur « ; », guillemets si nécessaire, fins de ligne CRLF et BOM UTF-8
 * (accents corrects à l'ouverture). Les cellules commençant par =, +, - ou @ sont neutralisées (injection de formule).
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v == null) return "";
    if (typeof v === "number") return String(v).replace(".", ",");
    const text = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
