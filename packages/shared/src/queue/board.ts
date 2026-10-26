import { z } from "zod";
import { TICKET_STATUSES, type BranchBoard } from "./live";

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
}) satisfies z.ZodType<BranchBoard>;

