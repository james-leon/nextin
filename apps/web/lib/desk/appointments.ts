import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nextin/shared/database";
import { localDate } from "@nextin/shared/appointments";
import { practitionerName } from "./counter-name";

type Db = SupabaseClient<Database>;

export type AppointmentStatus = "confirmed" | "checked_in" | "completed" | "rescheduled" | "cancelled" | "no_show";
/** Statut affiché : « en attente » = arrivé, praticien absent ou en retard. */
export type AppointmentDisplayStatus = AppointmentStatus | "waiting";

/** Rendez-vous tel que renvoyé par `appointment_json` (personnel de l'agence uniquement). */
export type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  display_status: AppointmentDisplayStatus;
  customer_label: string | null;
  phone_e164: string | null;
  locale: "fr" | "en";
  practitioner: { id: string; name: string };
  service: { id: string; name: string; name_en: string | null; prefix: string; color: string };
  ticket: { id: string; display_code: string; status: string } | null;
  rescheduled_from_id: string | null;
  checked_in_at: string | null;
  cancel_reason: string | null;
  conflict: boolean;
};

export type AppointmentPractitioner = { id: string; name: string; hasSchedule: boolean };

export type AppointmentsContext = {
  branch: { id: string; name: string; organizationName: string; timeZone: string };
  practitioners: AppointmentPractitioner[];
  today: string;
};

/** Agence, praticiens (avec ou sans horaires de consultation) et jour local de l'agence ; null si inaccessible. */
export async function loadAppointmentsContext(supabase: Db, branchId: string): Promise<AppointmentsContext | null> {
  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, timezone, organization:organizations(name)")
    .eq("id", branchId)
    .maybeSingle();
  if (!branch) return null;
  const [{ data: practitioners }, { data: schedules }] = await Promise.all([
    supabase.from("practitioners").select("id, title, display_name").eq("branch_id", branchId).eq("active", true).order("display_name"),
    supabase.from("practitioner_schedules").select("practitioner_id").eq("branch_id", branchId),
  ]);
  const withSchedule = new Set((schedules ?? []).map((s) => s.practitioner_id));
  return {
    branch: { id: branch.id, name: branch.name, organizationName: branch.organization?.name ?? "", timeZone: branch.timezone },
    practitioners: (practitioners ?? []).map((p) => ({ id: p.id, name: practitionerName(p), hasSchedule: withSchedule.has(p.id) })),
    today: localDate(new Date(), branch.timezone),
  };
}

export async function listAppointments(supabase: Db, branchId: string, from: string, to: string, practitionerId?: string | null) {
  const { data, error } = await supabase.rpc("list_appointments", {
    p_branch: branchId,
    p_from: from,
    p_to: to,
    p_practitioner: (practitionerId ?? null) as string,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Appointment[];
}

/** Créneau libre renvoyé par `available_slots`. */
export type Slot = { starts_at: string; ends_at: string; service_id: string };
