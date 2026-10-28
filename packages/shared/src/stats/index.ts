/**
 * Tableau de bord (M8) : périodes, comparaison, écarts et export CSV. Logique pure, sans dépendance, testée.
 * Les jours sont des jours locaux de l'agence (`YYYY-MM-DD`).
 */
import { addDays, weekStart, type IsoDate } from "../appointments/calendar";

export const STATS_PERIODS = ["day", "week", "month"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export type DateRange = { from: IsoDate; to: IsoDate };

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}
function monthEnd(date: IsoDate): IsoDate {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Période contenant le jour de référence : le jour, la semaine (lundi → dimanche) ou le mois. */
export function periodRange(period: StatsPeriod, anchor: IsoDate): DateRange {
  if (period === "day") return { from: anchor, to: anchor };
  if (period === "week") return { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) };
  return { from: monthStart(anchor), to: monthEnd(anchor) };
}

/**
 * Période de comparaison : même jour de la semaine précédente (« vs mardi dernier »), semaine précédente,
 * mois précédent. Une période en cours n'est comparée qu'à la même durée écoulée (`today`).
 */
export function comparisonRange(period: StatsPeriod, range: DateRange, today: IsoDate): DateRange {
  const end = range.to > today ? today : range.to;
  if (period === "day") return { from: addDays(range.from, -7), to: addDays(range.from, -7) };
  if (period === "week") return { from: addDays(range.from, -7), to: addDays(end, -7) };
  const previousStart = monthStart(addDays(range.from, -1));
  const elapsed = Math.round((Date.parse(end) - Date.parse(range.from)) / 86_400_000);
  const candidate = addDays(previousStart, elapsed);
  const previousEnd = monthEnd(previousStart);
  return { from: previousStart, to: candidate > previousEnd ? previousEnd : candidate };
}

/** Période suivante ou précédente (navigation). */
export function shiftPeriod(period: StatsPeriod, anchor: IsoDate, step: -1 | 1): IsoDate {
  if (period === "day") return addDays(anchor, step);
  if (period === "week") return addDays(anchor, 7 * step);
  return step === 1 ? addDays(monthEnd(anchor), 1) : monthStart(addDays(monthStart(anchor), -1));
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
