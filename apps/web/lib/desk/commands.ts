import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeskOp } from "@nextin/shared/desk";
import type { Database } from "@nextin/shared/database";

type Db = SupabaseClient<Database>;
export type CommandOutcome =
  | { ok: true; result: Record<string, unknown> | null }
  | { ok: false; offline: true }
  | { ok: false; offline: false; code: string };

/** Erreur réseau (requête jamais arrivée) plutôt qu'un refus du serveur. */
export function isNetworkError(error: { code?: string; message?: string } | null): boolean {
  return !!error && !error.code && /fetch|network|load failed|timeout/i.test(error.message ?? "");
}

/**
 * Exécute une commande du poste. Un appel hors ligne vise le ticket choisi localement
 * (`call_ticket`), le serveur appelant le suivant disponible en cas de conflit.
 */
export async function runDeskOp(supabase: Db, counterId: string, op: DeskOp, finishCurrent = false): Promise<CommandOutcome> {
  const common = { p_client_op_id: op.id };
  const call = () => {
    switch (op.kind) {
      case "call":
        return op.ticketId
          ? supabase.rpc("call_ticket", { p_counter: counterId, p_ticket: op.ticketId, p_finish_current: finishCurrent, ...common })
          : supabase.rpc("call_next", { p_counter: counterId, p_finish_current: finishCurrent, ...common });
      case "admit":
        return supabase.rpc("admit_ticket", { p_ticket: op.ticketId!, ...common });
      case "finish":
        return supabase.rpc("finish_ticket", { p_ticket: op.ticketId!, ...common });
      case "recall":
        return supabase.rpc("recall_ticket", { p_ticket: op.ticketId!, ...common });
      case "no_show":
        return supabase.rpc("mark_no_show", { p_ticket: op.ticketId!, ...common });
      case "transfer":
        return supabase.rpc("transfer_ticket", { p_ticket: op.ticketId!, p_target_service: op.targetServiceId!, ...common });
    }
  };
  let res: { data: unknown; error: { code?: string; message?: string } | null };
  try {
    res = await call();
  } catch {
    return { ok: false, offline: true };
  }
  if (res.error) {
    if (isNetworkError(res.error)) return { ok: false, offline: true };
    return { ok: false, offline: false, code: res.error.message ?? "generic" };
  }
  return { ok: true, result: (res.data as Record<string, unknown> | null) ?? null };
}
