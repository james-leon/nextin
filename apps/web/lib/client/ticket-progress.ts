import { waitMinutes } from "@nextin/shared/queue/estimate";
import { ticketProgressFromBoard, type BranchBoard } from "@nextin/shared/queue/live";
import type { TicketView } from "./types";

/**
 * État d'attente affiché : position et attente recalculées depuis le dernier tableau diffusé
 * (un seul message temps réel met à jour tous les clients), sinon valeurs du ticket.
 * `maxAhead` : plus grand nombre de personnes devant vu depuis la prise du ticket (barre de progression).
 */
export function waitingProgress(view: TicketView, board: BranchBoard | null, maxAhead: number, now: Date = new Date()) {
  const live = board ? ticketProgressFromBoard(board, view.service.id, view.display_code, now) : null;
  const ahead = live?.ahead ?? Math.max(0, (view.position ?? 1) - 1);
  const waitSeconds = live?.waitSeconds ?? view.wait_seconds ?? 0;
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
