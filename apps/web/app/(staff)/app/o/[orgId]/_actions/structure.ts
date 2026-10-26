"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { minutesToSeconds } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import {
  branchFormSchema,
  branchSettingsFormSchema,
  counterFormSchema,
  openingHoursSchema,
  serviceFormSchema,
} from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = Object.keys(messages.fr.errors);
const id = z.uuid();

/** Vérifie les identifiants liés à l'action et que l'agence appartient bien à l'établissement (RLS en plus). */
async function scope(orgId: string, branchId?: string) {
  if (!id.safeParse(orgId).success || (branchId !== undefined && !id.safeParse(branchId).success)) redirect("/app");
  await requireStaffSession(`/app/o/${orgId}`);
  const supabase = await getSupabaseServerClient();
  if (branchId) {
    const { data } = await supabase.from("branches").select("id").eq("id", branchId).eq("organization_id", orgId).maybeSingle();
    if (!data) redirect(`/app/o/${orgId}/branches`);
  }
  return supabase;
}

function done(orgId: string, path: string): never {
  revalidatePath(`/app/o/${orgId}`, "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}saved=1`);
}

const base = (orgId: string, branchId: string) => `/app/o/${orgId}/branches/${branchId}`;

/* ─── Agences ─────────────────────────────────────────────────────────────── */

export async function createBranch(orgId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId);
  const parsed = branchFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { data: branchId, error } = await supabase.rpc("create_branch", {
    p_org: orgId,
    p_name: v.name,
    p_address: v.address ?? undefined,
    p_city: v.city ?? undefined,
    p_phone_e164: v.phone ?? undefined,
    p_lat: v.lat,
    p_lng: v.lng,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(orgId, base(orgId, branchId));
}

export async function updateBranch(orgId: string, branchId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const parsed = branchFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { data: affected, error } = await supabase
    .from("branches")
    .update({ name: v.name, address: v.address, city: v.city, phone_e164: v.phone })
    .eq("id", branchId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  const clear = data.get("clearLocation") === "1";
  if (clear || (v.lat !== undefined && v.lng !== undefined)) {
    const { error: locError } = await supabase.rpc("set_branch_location", {
      p_branch: branchId,
      p_lat: clear ? null : v.lat,
      p_lng: clear ? null : v.lng,
    } as never);
    if (locError) return { ok: false, error: mapDbError(locError) };
  }
  done(orgId, base(orgId, branchId));
}

/* ─── Services ────────────────────────────────────────────────────────────── */

function serviceRow(v: z.infer<typeof serviceFormSchema>) {
  return {
    name: v.name,
    name_en: v.nameEn,
    prefix: v.prefix,
    color: v.color.toUpperCase(),
    default_service_seconds: minutesToSeconds(v.defaultMinutes),
    max_daily_tickets: v.maxDailyTickets,
    specialty_id: v.specialtyId,
    description: v.description,
    allow_priority: v.allowPriority,
    allow_remote: v.allowRemote,
    active: v.active,
  };
}

export async function saveService(
  orgId: string,
  branchId: string,
  serviceId: string | null,
  _prev: ActionResult | null,
  data: FormData,
): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const parsed = serviceFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const row = serviceRow(parsed.data);
  const { data: affected, error } = serviceId
    ? await supabase.from("services").update(row).eq("id", serviceId).eq("branch_id", branchId).select("id")
    : await supabase
        .from("services")
        .insert({ ...row, organization_id: orgId, branch_id: branchId, sort_order: Number(data.get("sortOrder") ?? 0) || 0 })
        .select("id");
  if (error) {
    const code = mapDbError(error, "prefix_taken");
    return code === "prefix_taken"
      ? { ok: false, error: code, fieldErrors: { prefix: "prefix_taken" } }
      : { ok: false, error: code };
  }
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `${base(orgId, branchId)}/services`);
}

export async function deleteService(orgId: string, branchId: string, serviceId: string): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const { data: affected, error } = await supabase.from("services").delete().eq("id", serviceId).eq("branch_id", branchId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `${base(orgId, branchId)}/services`);
}

/* ─── Guichets / cabinets ─────────────────────────────────────────────────── */

export async function saveCounter(
  orgId: string,
  branchId: string,
  counterId: string | null,
  _prev: ActionResult | null,
  data: FormData,
): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const parsed = counterFormSchema.safeParse(formObject(data, ["serviceIds"]));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const row = {
    kind: v.kind,
    number: v.number,
    label: v.label,
    default_practitioner_id: v.defaultPractitionerId,
    active: v.active,
  };
  let id = counterId;
  if (counterId) {
    const { data: affected, error } = await supabase
      .from("counters")
      .update(row)
      .eq("id", counterId)
      .eq("branch_id", branchId)
      .select("id");
    if (error) return failCounter(error);
    if (!affected?.length) return { ok: false, error: "not_allowed" };
  } else {
    const { data: created, error } = await supabase
      .from("counters")
      .insert({ ...row, organization_id: orgId, branch_id: branchId })
      .select("id")
      .single();
    if (error) return failCounter(error);
    id = created.id;
  }
  // Services traités : remplacement complet de la liste.
  // 0 ligne supprimée est normal (poste sans service).
  const { error: delError } = await supabase.from("counter_services").delete().eq("counter_id", id!);
  if (delError) return { ok: false, error: mapDbError(delError) };
  if (v.serviceIds.length) {
    const { error: insError } = await supabase
      .from("counter_services")
      .insert(v.serviceIds.map((service_id) => ({ organization_id: orgId, counter_id: id!, service_id })));
    if (insError) return { ok: false, error: mapDbError(insError) };
  }
  done(orgId, `${base(orgId, branchId)}/counters`);
}

function failCounter(error: { code?: string; message?: string }): ActionResult {
  const code = mapDbError(error, "number_taken");
  return code === "number_taken" ? { ok: false, error: code, fieldErrors: { number: "number_taken" } } : { ok: false, error: code };
}

export async function deleteCounter(orgId: string, branchId: string, counterId: string): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const { data: affected, error } = await supabase.from("counters").delete().eq("id", counterId).eq("branch_id", branchId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `${base(orgId, branchId)}/counters`);
}

/* ─── Horaires et réglages ────────────────────────────────────────────────── */

export async function saveOpeningHours(orgId: string, branchId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    open: data.get(`open-${weekday}`) === "on",
    opensAt: String(data.get(`opens-${weekday}`) ?? "08:00"),
    closesAt: String(data.get(`closes-${weekday}`) ?? "17:00"),
  }));
  const parsed = openingHoursSchema.safeParse(days);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<string, "hours_order" | "time_invalid">> = {};
    for (const issue of parsed.error.issues) {
      const day = days[Number(issue.path[0])]?.weekday;
      if (day) fieldErrors[`day-${day}`] = issue.message === "hours_order" ? "hours_order" : "time_invalid";
    }
    return { ok: false, error: "generic", fieldErrors };
  }
  const open = parsed.data.filter((d) => d.open);
  const closed = parsed.data.filter((d) => !d.open).map((d) => d.weekday);
  if (closed.length) {
    const { error } = await supabase.from("opening_hours").delete().eq("branch_id", branchId).in("weekday", closed);
    if (error) return { ok: false, error: mapDbError(error) };
  }
  if (open.length) {
    const { error } = await supabase.from("opening_hours").upsert(
      open.map((d) => ({ organization_id: orgId, branch_id: branchId, weekday: d.weekday, opens_at: d.opensAt, closes_at: d.closesAt })),
      { onConflict: "branch_id,weekday" },
    );
    if (error) return { ok: false, error: mapDbError(error) };
  }
  done(orgId, base(orgId, branchId));
}

export async function saveBranchSettings(orgId: string, branchId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const parsed = branchSettingsFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic" };
  const v = parsed.data;
  const { data: affected, error } = await supabase
    .from("branch_settings")
    .update({
      remote_tickets_enabled: v.remoteTicketsEnabled,
      priorities_enabled: v.prioritiesEnabled,
      rating_enabled: v.ratingEnabled,
      almost_turn_threshold: v.almostTurnThreshold,
    })
    .eq("branch_id", branchId)
    .select("branch_id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, base(orgId, branchId));
}

/* ─── QR codes ────────────────────────────────────────────────────────────── */

export async function regenerateQrCode(orgId: string, branchId: string, serviceId: string | null): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  if (serviceId && !id.safeParse(serviceId).success) return { ok: false, error: "not_found" };
  const { error } = await supabase.rpc("regenerate_qr_code", { p_branch: branchId, p_service: serviceId ?? undefined });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`${base(orgId, branchId)}/qr`);
  redirect(`${base(orgId, branchId)}/qr?regenerated=1`);
}
