import { waitMinutes } from "@nextin/shared/queue/estimate";
import { ticketProgressFromBoard, type BranchBoard } from "@nextin/shared/queue/live";
import type { TicketView } from "./types";

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
    progress: (top - ahead + 1) / (top + 2),
  };
}
