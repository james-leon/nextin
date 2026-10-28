import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nextin/shared/database";
import type { BranchBoard, PriorityReason } from "@nextin/shared/queue/live";
import { practitionerName } from "./counter-name";
import { serviceDay } from "./snapshot";

type Db = SupabaseClient<Database>;

export type ReceptionService = { id: string; name: string; prefix: string; color: string; allowPriority: boolean };
export type ReceptionTicket = {
  id: string;
  code: string;
  serviceId: string;
  priorityReason: PriorityReason | null;
  createdAt: string;
  preferredCounterId: string | null;
  source: "qr" | "short_code" | "remote" | "reception";
  /** Ticket à distance (M9) : présence confirmée, « en route », nombre de reculs. */
  remote: { confirmed: boolean; onMyWay: boolean; delays: number } | null;
};
export type ReceptionPractitioner = {
  id: string;
  name: string;
  counterIds: string[];
  serviceIds: string[];
  absence: { id: string; kind: "absent" | "late"; until: string | null } | null;
};
export type ReceptionCounter = { id: string; kind: string; number: number; label: string | null; status: string; practitionerId: string | null };
export type ReceptionData = {
  branch: { id: string; name: string; organizationName: string; timeZone: string; prioritiesEnabled: boolean };
  services: ReceptionService[];
  board: BranchBoard | null;
  waiting: ReceptionTicket[];
  practitioners: ReceptionPractitioner[];
  counters: ReceptionCounter[];
  /** Rendez-vous du jour encore attendus (confirmés, heure à venir ou en cours de tolérance). */
  upcomingAppointments: number;
  /** Demandes de rendez-vous en attente de réponse (M9). */
  pendingRequests: number;
};

/** Données du poste d'accueil d'une agence (sous RLS) ; null si l'agence n'est pas accessible. */
export async function loadReception(supabase: Db, branchId: string): Promise<ReceptionData | null> {
  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, timezone, organization:organizations(name), branch_settings(priorities_enabled)")
    .eq("id", branchId)
    .maybeSingle();
  if (!branch) return null;
  const now = new Date().toISOString();
  const [services, board, waiting, practitioners, counters, absences] = await Promise.all([
    supabase.from("services").select("id, name, prefix, color, allow_priority").eq("branch_id", branchId).eq("active", true).order("sort_order"),
    supabase.rpc("get_branch_board", { p_branch: branchId }),
    supabase
      .from("tickets")
      .select(
        "id, display_code, service_id, priority_reason, priority_level, sort_key, number, created_at, preferred_counter_id, source, is_remote, presence_confirmed_at, on_my_way_at, delay_count",
      )
      .eq("branch_id", branchId)
      .eq("status", "waiting")
      .eq("service_day", serviceDay(branch.timezone))
      .order("priority_level", { ascending: false })
      .order("sort_key")
      .order("number"),
    supabase.from("practitioners").select("id, title, display_name").eq("branch_id", branchId).eq("active", true).order("display_name"),
    supabase
      .from("counters")
      .select("id, kind, number, label, status, default_practitioner_id, counter_services(service_id)")
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("kind")
      .order("number"),
    supabase.from("practitioner_absences").select("id, practitioner_id, kind, until, created_at").eq("branch_id", branchId).is("ended_at", null),
  ]);
  const today = serviceDay(branch.timezone);
  const { count: upcoming } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("status", "confirmed")
    .gte("starts_at", new Date(Date.now() - 60 * 60_000).toISOString())
    .lt("starts_at", `${today}T23:59:59${offsetOf(branch.timezone)}`);
  const { count: requests } = await supabase
    .from("appointment_requests")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("status", "pending");
  const error = services.error ?? board.error ?? waiting.error ?? practitioners.error ?? counters.error ?? absences.error;
  if (error) throw new Error(error.message);

  const active = (absences.data ?? [])
    .filter((a) => !a.until || a.until > now)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const settings = branch.branch_settings as { priorities_enabled: boolean } | { priorities_enabled: boolean }[] | null;
  const prioritiesEnabled = Array.isArray(settings) ? (settings[0]?.priorities_enabled ?? true) : (settings?.priorities_enabled ?? true);

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      organizationName: (branch.organization as { name: string } | null)?.name ?? "",
      timeZone: branch.timezone,
      prioritiesEnabled,
    },
    services: (services.data ?? []).map((s) => ({ id: s.id, name: s.name, prefix: s.prefix, color: s.color, allowPriority: s.allow_priority })),
    board: (board.data as BranchBoard | null) ?? null,
    waiting: (waiting.data ?? []).map((t) => ({
      id: t.id,
      code: t.display_code,
      serviceId: t.service_id,
      priorityReason: t.priority_reason,
      createdAt: t.created_at,
      preferredCounterId: t.preferred_counter_id,
      source: t.source,
      remote: t.is_remote ? { confirmed: !!t.presence_confirmed_at, onMyWay: !!t.on_my_way_at, delays: t.delay_count } : null,
    })),
    practitioners: (practitioners.data ?? []).map((p) => {
      const own = (counters.data ?? []).filter((c) => c.default_practitioner_id === p.id);
      const absence = active.find((a) => a.practitioner_id === p.id);
      return {
        id: p.id,
        name: practitionerName(p),
        counterIds: own.map((c) => c.id),
        serviceIds: [...new Set(own.flatMap((c) => (c.counter_services ?? []).map((cs) => cs.service_id)))],
        absence: absence ? { id: absence.id, kind: absence.kind, until: absence.until } : null,
      };
    }),
    counters: (counters.data ?? []).map((c) => ({
      id: c.id,
      kind: c.kind,
      number: c.number,
      label: c.label,
      status: c.status,
      practitionerId: c.default_practitioner_id,
    })),
    upcomingAppointments: upcoming ?? 0,
    pendingRequests: requests ?? 0,
  };
}

/** Décalage horaire courant d'un fuseau, « +01:00 » (Douala : pas d'heure d'été). */
function offsetOf(timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1]! : "+00:00";
}
