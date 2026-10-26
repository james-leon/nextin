import { absoluteUrl } from "./app-url";

export const COUNTER_KINDS = ["cabinet", "guichet", "caisse", "laboratoire", "accueil"] as const;
export type CounterKind = (typeof COUNTER_KINDS)[number];

/** Jours ISO : 1 = lundi … 7 = dimanche. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Durées de service proposées (minutes) ; le directeur peut saisir une autre valeur. */
export const SERVICE_DURATION_PRESETS = [3, 5, 10, 15, 20, 30, 45, 60] as const;

function letters(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("");
}

/**
 * Préfixe de ticket proposé pour un service : initiale du nom, sinon une autre lettre du nom,
 * sinon deux lettres, en évitant les préfixes déjà pris dans l'agence.
 * « Consultation » → « C » ; si « C » est pris → « O »… ; « Caisse » avec C et A pris → « I ».
 */
export function suggestPrefix(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((p) => p.toUpperCase()));
  const chars = letters(name);
  for (const c of chars) if (!used.has(c)) return c;
  const first = chars[0] ?? "S";
  for (const c of [...chars.slice(1), ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]) {
    const two = `${first}${c}`;
    if (!used.has(two)) return two;
  }
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(c)) return c;
  return "ZZ";
}

/** Prochain numéro libre pour un type de guichet dans une agence. */
export function nextCounterNumber(existing: readonly { kind: string; number: number }[], kind: CounterKind): number {
  const used = new Set(existing.filter((c) => c.kind === kind).map((c) => c.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/** Chemin public du QR code d'une agence (page client, M4). */
export function qrEntryPath(token: string): string {
  return `/q/${token}`;
}

/** URL absolue encodée dans le QR code imprimé — toujours construite depuis APP_URL. */
export function qrEntryUrl(token: string, env?: Record<string, string | undefined>): string {
  return absoluteUrl(qrEntryPath(token), env);
}

/** « 07:30:00 » → « 07:30 » ; « 7:30 » → « 07:30 ». */
export function formatTime(value: string): string {
  const [h = "0", m = "0"] = value.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/** Durée en minutes ↔ secondes, bornée aux limites de la base (1 à 120 minutes). */
export function minutesToSeconds(minutes: number): number {
  return Math.round(Math.min(120, Math.max(1, minutes)) * 60);
}

/**
 * Résumé compact des horaires : jours consécutifs aux mêmes heures regroupés.
 * [{1,07:30,17:00}…{5,…},{6,08:00,12:00}] → « Lun–Ven 07:30–17:00 · Sam 08:00–12:00 ».
 */
export function summarizeOpeningHours(
  rows: readonly { weekday: number; opens_at: string; closes_at: string }[],
  shortDay: (weekday: number) => string,
  closedLabel: string,
): string {
  const byDay = new Map(rows.map((r) => [r.weekday, `${formatTime(r.opens_at)}–${formatTime(r.closes_at)}`]));
  if (byDay.size === 0) return closedLabel;
  const parts: string[] = [];
  let start = 0;
  for (let d = 1; d <= 8; d++) {
    const current = byDay.get(d);
    const previous = byDay.get(d - 1);
    if (d <= 7 && current && current === previous && start) continue;
    if (start && previous) {
      const end = d - 1;
      parts.push(`${start === end ? shortDay(start) : `${shortDay(start)}–${shortDay(end)}`} ${previous}`);
    }
    start = current ? d : 0;
  }
  return parts.join(" · ");
}
