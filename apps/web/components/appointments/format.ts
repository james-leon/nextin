/** Formats d'affichage des rendez-vous, toujours dans le fuseau de l'agence. */
export function timeOf(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** « jeudi 5 novembre » (jour local `YYYY-MM-DD`). */
export function longDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** « jeu. 5 » pour les jours compacts. */
export function shortDay(date: string, locale: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(d),
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(d),
  };
}
