/**
 * Agenda de la semaine (accueil, ordinateur) : position des rendez-vous sur une grille horaire.
 * Logique pure, testée (`agenda.test.ts`).
 */

/** Minutes depuis minuit dans le fuseau de l'agence. */
export function minutesOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Plage horaire affichée : heures pleines couvrant les rendez-vous, au moins `fallback` (8 h – 18 h par défaut). */
export function hourRange(spans: { start: number; end: number }[], fallback: [number, number] = [8, 18]): [number, number] {
  let from = fallback[0];
  let to = fallback[1];
  for (const s of spans) {
    from = Math.min(from, Math.floor(s.start / 60));
    to = Math.max(to, Math.ceil(s.end / 60));
  }
  return [Math.max(0, from), Math.min(24, Math.max(to, from + 1))];
}

export type Placed<T> = { item: T; start: number; end: number; lane: number; lanes: number };

/**
 * Couloirs côte à côte pour les rendez-vous qui se chevauchent (plusieurs praticiens à la même heure) :
 * chaque groupe de chevauchements partage sa largeur en autant de couloirs que nécessaire.
 */
export function placeDay<T>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];
  const close = () => {
    const lanes = laneEnds.length;
    for (const p of group) p.lanes = lanes;
    out.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const s of sorted) {
    const end = Math.max(s.end, s.start + 1);
    if (group.length && s.start >= groupEnd) close();
    let lane = laneEnds.findIndex((e) => e <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    group.push({ item: s.item, start: s.start, end, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) close();
  return out;
}
