import type { BranchBoard } from "@nextin/shared/queue/live";
import { boardTopic, REALTIME_EVENTS } from "@nextin/shared/queue/realtime";
import { subscribeBroadcast } from "./realtime";
import { callRpc } from "./supabase-public";

/**
 * Tableau d'agence alimenté par deux sources : diffusions temps réel et relectures (à chaque (re)connexion).
 * Une relecture partie avant un appel peut revenir après sa diffusion : elle est ignorée si une diffusion
 * est arrivée entre-temps (tout changement validé ensuite produit sa propre diffusion, rien n'est perdu).
 * Les horodatages ne suffisent pas : `generated_at` est l'heure de début de transaction, pas de validation.
 */
export function createBoardFeed<T>(apply: (board: T) => void, fetchBoard: () => Promise<T | null>) {
  let received = 0;
  return {
    push(board: T) {
      received++;
      apply(board);
    },
    async refresh() {
      const before = received;
      const board = await fetchBoard();
      if (board && received === before) apply(board);
    },
  };
}

/** Tableau d'une agence en direct (canal public) ; relu à chaque (re)connexion. Renvoie le désabonnement. */
export function subscribeBoard(branchId: string, onBoard: (board: BranchBoard) => void): () => void {
  const feed = createBoardFeed(onBoard, () =>
    callRpc<BranchBoard | null>("get_branch_board", { p_branch: branchId }).then(({ data }) => data),
  );
  return subscribeBroadcast(boardTopic(branchId), REALTIME_EVENTS.board, (p) => feed.push(p as BranchBoard), () => void feed.refresh());
}
