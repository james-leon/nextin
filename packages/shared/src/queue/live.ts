import { estimateWaitSeconds, type CounterLoad } from "./estimate";

/** États d'un ticket (enum SQL `ticket_status`). Appel en deux temps : `called` (alerté) puis `serving` (admis). */
export const TICKET_STATUSES = ["waiting", "called", "serving", "served", "no_show", "cancelled", "transferred"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ACTIVE_TICKET_STATUSES: readonly TicketStatus[] = ["waiting", "called", "serving"];

export const PRIORITY_REASONS = ["appointment", "pregnancy", "elderly", "disability", "other"] as const;
export type PriorityReason = (typeof PRIORITY_REASONS)[number];

/**
 * Lecture du tableau d'agence côté client, sans Zod (pages client légères).
 * Types du tableau diffusé en temps réel (topic public `branch:<id>:board`) et lu par `get_branch_board`.
 */
export type BoardCounterLoad = { counter_id: string | null; duration_seconds: number; busy_remaining_seconds: number };
export type BoardService = {
  id: string;
  prefix: string;
  name: string;
  name_en: string | null;
  color: string;
  /** Au moins un poste ouvert sert ce service. */
  open: boolean;
  /** Codes des tickets en attente, dans l'ordre de passage (aucun nom). */
  waiting: string[];
  counters: BoardCounterLoad[];
  /** Attente estimée pour un nouveau ticket. */
  wait_seconds: number;
};
export type BoardCall = {
  code: string;
  service_id: string;
  status: "called" | "serving";
  counter_kind: "cabinet" | "guichet" | "caisse" | "laboratoire" | "accueil";
  counter_number: number;
  counter_label: string | null;
  called_at: string;
  recall_count: number;
};
export type BranchBoard = { branch_id: string; generated_at: string; services: BoardService[]; calls: BoardCall[] };

/** Charge des postes d'un service, ramenée à l'instant `now` (le temps écoulé depuis la diffusion est déduit). */
export function boardCounterLoads(board: BranchBoard, serviceId: string, now: Date = new Date()): CounterLoad[] {
  const service = board.services.find((s) => s.id === serviceId);
  if (!service) return [];
  const elapsed = Math.max(0, (now.getTime() - new Date(board.generated_at).getTime()) / 1000);
  return service.counters.map((c) => ({
    durationSeconds: c.duration_seconds,
    busyRemainingSeconds: Math.max(0, c.busy_remaining_seconds - elapsed),
  }));
}

/**
 * Position (1 = prochain) et attente estimée d'un ticket à partir du tableau diffusé.
 * Calcul fait côté client : un seul message temps réel suffit à mettre à jour tous les clients.
 */
export function ticketProgressFromBoard(
  board: BranchBoard,
  serviceId: string,
  code: string,
  now: Date = new Date(),
): { position: number; ahead: number; waitSeconds: number } | null {
  const service = board.services.find((s) => s.id === serviceId);
  if (!service) return null;
  const index = service.waiting.indexOf(code);
  if (index < 0) return null;
  return {
    position: index + 1,
    ahead: index,
    waitSeconds: estimateWaitSeconds(index, boardCounterLoads(board, serviceId, now)),
  };
}

/** Appel en cours pour un code (écran TV, client appelé). */
export function callForCode(board: BranchBoard, code: string) {
  return board.calls.find((c) => c.code === code) ?? null;
}
