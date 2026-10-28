import type { BoardCall, BranchBoard } from "@nextin/shared/queue/live";

/**
 * Appels affichés (services de l'écran uniquement) : le dernier patient alerté en héros, sinon l'appel le plus récent ;
 * puis les trois appels précédents, terminés ou non (le tableau garde les appels terminés depuis moins de 30 minutes).
 */
export function tvCalls(board: BranchBoard, serviceIds: readonly string[]): { hero: BoardCall | null; others: BoardCall[] } {
  const calls = board.calls.filter((c) => serviceIds.length === 0 || serviceIds.includes(c.service_id));
  const hero = calls.find((c) => c.status === "called") ?? calls[0] ?? null;
  return { hero, others: calls.filter((c) => c !== hero).slice(0, 3) };
}

