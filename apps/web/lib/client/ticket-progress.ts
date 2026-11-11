import { waitMinutes } from "@nextin/shared/queue/estimate";
import { ticketProgressFromBoard, type BranchBoard } from "@nextin/shared/queue/live";
import { branchHoursStatus } from "./branch-hours";
import type { TicketView } from "./types";

/** Barre de progression : jamais vide (le ticket est pris), presque pleine quand le client est le prochain. */
export const PROGRESS_START = 0.08;
export const PROGRESS_NEXT = 0.92;

/**
 * Avancement dans la file, de `PROGRESS_START` (autant de monde devant qu'au plus fort) à `PROGRESS_NEXT`
 * (personne devant), proportionnel aux places gagnées. `top` : plus grand nombre de personnes vu devant.
 */
export function queueProgress(ahead: number, top: number): number {
  if (ahead <= 0) return PROGRESS_NEXT;
  const max = Math.max(top, ahead);
  return PROGRESS_START + ((PROGRESS_NEXT - PROGRESS_START) * (max - ahead)) / max;
}

export type TicketAvailability =
  | { kind: "open" }
  /** Agence ouverte, mais aucun poste du service n'est ouvert. */
  | { kind: "noCounter" }
  /** Agence fermée : prochaine ouverture (dans `inDays` jours, jour ISO `weekday`), ou null si aucune connue. */
  | { kind: "closed"; next: { inDays: number; weekday: number; opensAt: string } | null };

/**
 * Peut-on être appelé maintenant ? Agence fermée (horaires, fermeture exceptionnelle) ou aucun poste ouvert
 * pour le service : l'attente ne doit jamais annoncer « D'un instant à l'autre ». L'état des postes suit le
 * tableau diffusé en direct, sinon la vue du ticket ; une vue sans ces champs (ancienne version) reste « open ».
 */
export function ticketAvailability(view: TicketView, board: BranchBoard | null, now: Date = new Date()): TicketAvailability {
  const { branch } = view;
  if (branch.is_open === false) {
    const status = branchHoursStatus(branch.hours ?? [], branch.timezone ?? "Africa/Douala", false, now);
    return { kind: "closed", next: status.open ? null : status.next };
  }
  const live = board?.services.find((s) => s.id === view.service.id);
  const serviceOpen = live ? live.open : view.service.open;
  return serviceOpen === false ? { kind: "noCounter" } : { kind: "open" };
}

/**
 * État d'attente affiché : position et attente recalculées depuis le dernier tableau diffusé
 * (un seul message temps réel met à jour tous les clients), sinon valeurs du ticket ;
 * jamais avant le retour prévu d'un praticien en retard.
 * `maxAhead` : plus grand nombre de personnes devant vu depuis la prise du ticket (barre de progression).
 */
export function waitingProgress(view: TicketView, board: BranchBoard | null, maxAhead: number, now: Date = new Date()) {
  const live = board ? ticketProgressFromBoard(board, view.service.id, view.display_code, now) : null;
  const ahead = live?.ahead ?? Math.max(0, (view.position ?? 1) - 1);
  // Praticien en retard : jamais avant son retour prévu.
  const lateSeconds = view.practitioner_late_until ? Math.max(0, (new Date(view.practitioner_late_until).getTime() - now.getTime()) / 1000) : 0;
  const waitSeconds = Math.max(live?.waitSeconds ?? view.wait_seconds ?? 0, Math.round(lateSeconds));
  const top = Math.max(maxAhead, ahead);
  return {
    ahead,
    waitSeconds,
    minutes: waitMinutes(waitSeconds),
    imminent: ahead === 0 && waitSeconds < 60,
    maxAhead: top,
    progress: queueProgress(ahead, top),
  };
}
