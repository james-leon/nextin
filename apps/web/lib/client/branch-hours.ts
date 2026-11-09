/**
 * État d'ouverture d'une agence (page publique, M9) : heure de fermeture si elle est ouverte, sinon prochaine
 * ouverture dans les 7 jours. Jours ISO (1 = lundi), heures locales de l'agence. Les fermetures exceptionnelles
 * sont déjà prises en compte par `is_open` (calculé en base) pour l'instant présent.
 */
export type BranchHours = { weekday: number; opens_at: string; closes_at: string }[];
export type HoursStatus =
  | { open: true; closesAt: string }
  | { open: false; next: { inDays: number; weekday: number; opensAt: string } | null };

function local(now: Date, timeZone: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { weekday, time: `${get("hour")}:${get("minute")}:${get("second")}` };
}

const hhmm = (t: string) => t.slice(0, 5);

export function branchHoursStatus(hours: BranchHours, timeZone: string, isOpen: boolean, now: Date): HoursStatus {
  const { weekday, time } = local(now, timeZone);
  if (isOpen) {
    const slot = hours.find((h) => h.weekday === weekday && h.opens_at <= time && time < h.closes_at);
    if (slot) return { open: true, closesAt: hhmm(slot.closes_at) };
  }
  for (let inDays = 0; inDays <= 7; inDays++) {
    const day = ((weekday - 1 + inDays) % 7) + 1;
    const slot = hours
      .filter((h) => h.weekday === day && (inDays > 0 || h.opens_at > time))
      .sort((a, b) => a.opens_at.localeCompare(b.opens_at))[0];
    if (slot) return { open: false, next: { inDays, weekday: day, opensAt: hhmm(slot.opens_at) } };
  }
  return { open: false, next: null };
}
