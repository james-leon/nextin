import type { SupabaseClient } from "@supabase/supabase-js";
import { orderWaiting, type DeskSnapshot, type DeskTicket } from "@nextin/shared/desk";
import type { Database } from "@nextin/shared/database";

type Db = SupabaseClient<Database>;

const TICKET_COLUMNS =
  "id, display_code, status, service_id, priority_level, priority_reason, sort_key, number, preferred_counter_id, source, created_at, called_at, serving_started_at, recall_count";

type Row = {
  id: string;
  display_code: string;
  status: DeskTicket["status"];
  service_id: string;
  priority_level: number;
  priority_reason: DeskTicket["priorityReason"];
  sort_key: number;
  number: number;
  preferred_counter_id: string | null;
  source: DeskTicket["source"];
  created_at: string;
  called_at: string | null;
  serving_started_at: string | null;
  recall_count: number;
};

const toTicket = (r: Row): DeskTicket => ({
  id: r.id,
  code: r.display_code,
  status: r.status,
  serviceId: r.service_id,
  priorityLevel: r.priority_level,
  priorityReason: r.priority_reason,
  sortKey: Number(r.sort_key),
  number: r.number,
  preferredCounterId: r.preferred_counter_id,
  source: r.source,
  createdAt: r.created_at,
  calledAt: r.called_at,
  servingStartedAt: r.serving_started_at,
  recallCount: r.recall_count,
});

/** Jour de service local de l'agence (AAAA-MM-JJ). */
export function serviceDay(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * Copie de la file d'un poste (sous RLS) : ticket en cours, file des services du poste dans l'ordre
 * de passage (mêmes règles que `pick_next_ticket`), statistiques du jour. Utilisable côté serveur et navigateur.
 */
export async function loadDeskSnapshot(
  supabase: Db,
  counter: { id: string; branchId: string; serviceIds: readonly string[]; timeZone: string },
): Promise<DeskSnapshot> {
  const day = serviceDay(counter.timeZone);
  const [status, current, waiting, counters, late, served] = await Promise.all([
    supabase.from("counters").select("status").eq("id", counter.id).single(),
    supabase.from("tickets").select(TICKET_COLUMNS).eq("counter_id", counter.id).in("status", ["called", "serving"]).maybeSingle(),
    counter.serviceIds.length
      ? supabase
          .from("tickets")
          .select(TICKET_COLUMNS)
          .eq("branch_id", counter.branchId)
          .eq("status", "waiting")
          .eq("service_day", day)
          .in("service_id", [...counter.serviceIds])
      : Promise.resolve({ data: [] as Row[], error: null }),
    supabase.from("counters").select("id, status, default_practitioner_id").eq("branch_id", counter.branchId),
    supabase
      .from("practitioner_absences")
      .select("practitioner_id, until")
      .eq("branch_id", counter.branchId)
      .eq("kind", "late")
      .is("ended_at", null)
      .gt("until", new Date().toISOString()),
    supabase
      .from("tickets")
      .select("serving_started_at, finished_at")
      .eq("counter_id", counter.id)
      .eq("status", "served")
      .eq("service_day", day),
  ]);
  const error = status.error ?? current.error ?? waiting.error ?? counters.error ?? late.error ?? served.error;
  if (error) throw new Error(error.message);

  const lateIds = new Set((late.data ?? []).map((a) => a.practitioner_id));
  const byId = new Map((counters.data ?? []).map((c) => [c.id, c]));
  const visible = ((waiting.data ?? []) as Row[]).filter((t) => {
    if (!t.preferred_counter_id || t.preferred_counter_id === counter.id) return true;
    const pc = byId.get(t.preferred_counter_id);
    return !!pc && pc.status !== "open" && !(pc.default_practitioner_id && lateIds.has(pc.default_practitioner_id));
  });
  const servedRows = served.data ?? [];
  const servedSeconds = servedRows.reduce((sum, r) => {
    if (!r.serving_started_at || !r.finished_at) return sum;
    return sum + Math.max(0, (new Date(r.finished_at).getTime() - new Date(r.serving_started_at).getTime()) / 1000);
  }, 0);

  return {
    counterId: counter.id,
    counterStatus: status.data!.status,
    current: current.data ? toTicket(current.data as Row) : null,
    waiting: orderWaiting(visible.map(toTicket), counter.id),
    servedToday: servedRows.length,
    servedSeconds,
    syncedAt: new Date().toISOString(),
  };
}
