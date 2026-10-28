/**
 * Jours du calendrier des rendez-vous, en heure locale de l'agence (`YYYY-MM-DD`), sans dépendance :
 * semaine du lundi au dimanche, navigation jour / semaine.
 */
export type IsoDate = string;

/** Jour local (`YYYY-MM-DD`) d'un instant dans un fuseau donné. */
export function localDate(at: Date | string, timeZone: string): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Jour ISO de la semaine : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: IsoDate): number {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** Lundi de la semaine du jour donné. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Les sept jours (lundi → dimanche) de la semaine du jour donné. */
export function weekDays(date: IsoDate): IsoDate[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Prochains jours à proposer pour un rendez-vous (aujourd'hui compris). */
export function nextDays(from: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
