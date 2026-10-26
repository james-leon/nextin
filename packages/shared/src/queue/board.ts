import { z } from "zod";
import { estimateWaitSeconds, type CounterLoad } from "./estimate";

/** États d'un ticket (enum SQL `ticket_status`). Appel en deux temps : `called` (alerté) puis `serving` (admis). */
export const TICKET_STATUSES = ["waiting", "called", "serving", "served", "no_show", "cancelled", "transferred"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ACTIVE_TICKET_STATUSES: readonly TicketStatus[] = ["waiting", "called", "serving"];

export const PRIORITY_REASONS = ["appointment", "pregnancy", "elderly", "disability", "other"] as const;
export type PriorityReason = (typeof PRIORITY_REASONS)[number];

const counterLoadSchema = z.object({
  counter_id: z.uuid().nullable(),
  duration_seconds: z.number().nonnegative(),
  busy_remaining_seconds: z.number().nonnegative(),
});

const boardServiceSchema = z.object({
  id: z.uuid(),
  prefix: z.string(),
  name: z.string(),
  name_en: z.string().nullable(),
  color: z.string(),
  /** Au moins un poste ouvert sert ce service. */
  open: z.boolean(),
  /** Codes des tickets en attente, dans l'ordre de passage (aucun nom). */
  waiting: z.array(z.string()),
  counters: z.array(counterLoadSchema),
  /** Attente estimée pour un nouveau ticket. */
  wait_seconds: z.number().nonnegative(),
});

const boardCallSchema = z.object({
  code: z.string(),
  service_id: z.uuid(),
  status: z.enum(["called", "serving"]),
  counter_kind: z.enum(["cabinet", "guichet", "caisse", "laboratoire", "accueil"]),
  counter_number: z.number().int(),
  counter_label: z.string().nullable(),
  called_at: z.string(),
  recall_count: z.number().int(),
});

/** Tableau d'une agence diffusé en temps réel (topic public `branch:<id>:board`) et lu par `get_branch_board`. */
export const branchBoardSchema = z.object({
  branch_id: z.uuid(),
  generated_at: z.string(),
  services: z.array(boardServiceSchema),
  calls: z.array(boardCallSchema),
});
export type BranchBoard = z.infer<typeof branchBoardSchema>;
export type BoardService = z.infer<typeof boardServiceSchema>;

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
