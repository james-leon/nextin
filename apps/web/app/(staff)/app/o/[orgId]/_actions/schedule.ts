"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { messages } from "@nextin/shared/i18n";
import { practitionerLeaveFormSchema, practitionerScheduleFormSchema } from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = Object.keys(messages.fr.errors);
const id = z.uuid();
const page = (orgId: string, practitionerId: string) => `/app/o/${orgId}/practitioners/${practitionerId}/schedule`;

/** Praticien de l'établissement (sous RLS) : agence et établissement, pour les écritures suivantes. */
async function scope(orgId: string, practitionerId: string) {
  if (!id.safeParse(orgId).success || !id.safeParse(practitionerId).success) redirect("/app");
  await requireStaffSession(`/app/o/${orgId}`);
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("practitioners")
    .select("id, branch_id")
    .eq("id", practitionerId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) redirect(`/app/o/${orgId}/practitioners`);
  return { supabase, branchId: data.branch_id };
}

function done(orgId: string, practitionerId: string): never {
  revalidatePath(page(orgId, practitionerId));
  redirect(`${page(orgId, practitionerId)}?saved=1`);
}

export async function addScheduleRange(orgId: string, practitionerId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, branchId } = await scope(orgId, practitionerId);
  const parsed = practitionerScheduleFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { data: rows, error } = await supabase
    .from("practitioner_schedules")
    .insert({
      organization_id: orgId,
      branch_id: branchId,
      practitioner_id: practitionerId,
      service_id: v.serviceId,
      weekday: v.weekday,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      slot_minutes: v.slotMinutes,
    })
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!rows?.length) return { ok: false, error: "not_allowed" };
  done(orgId, practitionerId);
}

export async function deleteScheduleRange(orgId: string, practitionerId: string, rangeId: string): Promise<ActionResult> {
  const { supabase } = await scope(orgId, practitionerId);
  if (!id.safeParse(rangeId).success) return { ok: false, error: "not_found" };
  const { data: rows, error } = await supabase
    .from("practitioner_schedules")
    .delete()
    .eq("id", rangeId)
    .eq("practitioner_id", practitionerId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!rows?.length) return { ok: false, error: "not_allowed" };
  done(orgId, practitionerId);
}

export async function addLeave(orgId: string, practitionerId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, branchId } = await scope(orgId, practitionerId);
  const parsed = practitionerLeaveFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { data: rows, error } = await supabase
    .from("practitioner_leaves")
    .insert({
      organization_id: orgId,
      branch_id: branchId,
      practitioner_id: practitionerId,
      starts_on: v.startsOn,
      ends_on: v.endsOn,
      reason: v.reason ?? null,
    })
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!rows?.length) return { ok: false, error: "not_allowed" };
  done(orgId, practitionerId);
}

export async function deleteLeave(orgId: string, practitionerId: string, leaveId: string): Promise<ActionResult> {
  const { supabase } = await scope(orgId, practitionerId);
  if (!id.safeParse(leaveId).success) return { ok: false, error: "not_found" };
  const { data: rows, error } = await supabase
    .from("practitioner_leaves")
    .delete()
    .eq("id", leaveId)
    .eq("practitioner_id", practitionerId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!rows?.length) return { ok: false, error: "not_allowed" };
  done(orgId, practitionerId);
}
