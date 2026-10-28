/**
 * Règle d'équité entre rendez-vous et patients sans rendez-vous (§12.3), configurable par agence.
 * Fonction pure, miroir exact de `public.fair_pick` (SQL) : mêmes cas de référence (`fairness.fixtures.json`),
 * vérifiés par Vitest et pgTAP.
 *
 * - `ratio` : après un rendez-vous, au moins N patients sans rendez-vous passent (si quelqu'un attend).
 * - `strict` : un rendez-vous passe dès son heure (moins la marge d'avance), avant les patients sans rendez-vous.
 * Un rendez-vous n'est prioritaire qu'à partir de `earlyMinutes` avant son heure ; arrivé en avance, il attend son
 * tour comme les autres, et passe tout de suite si personne d'autre n'attend.
 */
export const FAIRNESS_MODES = ["ratio", "strict"] as const;
export type FairnessMode = (typeof FAIRNESS_MODES)[number];

export type FairnessRules = { mode: FairnessMode; walkinRatio: number; earlyMinutes: number };

/** Ticket en attente, dans l'ordre standard de la file. `appointmentStartsAt` : rendez-vous encore prioritaire. */
export type QueueCandidate = { id: string; appointmentStartsAt: string | null };

/**
 * @param walkinsSinceAppointment patients sans rendez-vous appelés à ce poste depuis le dernier rendez-vous du jour
 *   (null : aucun rendez-vous appelé aujourd'hui).
 */
export function pickNextTicket(
  candidates: readonly QueueCandidate[],
  rules: FairnessRules,
  walkinsSinceAppointment: number | null,
  now: Date,
): string | null {
  if (candidates.length === 0) return null;
  const eligible = candidates
    .map((c, index) => ({ c, index, at: c.appointmentStartsAt ? new Date(c.appointmentStartsAt).getTime() : null }))
    .filter((x): x is { c: QueueCandidate; index: number; at: number } => x.at !== null && x.at - rules.earlyMinutes * 60_000 <= now.getTime())
    .sort((a, b) => a.at - b.at || a.index - b.index);
  const appointment = eligible[0]?.c;
  const walkin = candidates.find((c) => !c.appointmentStartsAt);
  if (rules.mode === "strict") return (appointment ?? walkin ?? candidates[0]!).id;
  const quotaReached = walkinsSinceAppointment === null || walkinsSinceAppointment >= rules.walkinRatio;
  if (appointment && (quotaReached || !walkin)) return appointment.id;
  return (walkin ?? candidates[0]!).id;
}
