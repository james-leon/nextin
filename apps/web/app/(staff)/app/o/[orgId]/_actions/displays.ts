"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { messages } from "@nextin/shared/i18n";
import { announcementSettingsFormSchema, displayFormSchema, pairDisplayFormSchema } from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = Object.keys(messages.fr.errors);
const id = z.uuid();
const base = (orgId: string, branchId: string) => `/app/o/${orgId}/branches/${branchId}/displays`;

async function scope(orgId: string, branchId: string) {
  if (!id.safeParse(orgId).success || !id.safeParse(branchId).success) redirect("/app");
  await requireStaffSession(`/app/o/${orgId}`);
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("branches").select("id").eq("id", branchId).eq("organization_id", orgId).maybeSingle();
  if (!data) redirect(`/app/o/${orgId}/branches`);
  return supabase;
}

function done(orgId: string, branchId: string, flag = "saved"): never {
  revalidatePath(`/app/o/${orgId}`, "layout");
  redirect(`${base(orgId, branchId)}?${flag}=1`);
}

/** Appairage d'un écran TV par son code à 6 chiffres. */
export async function pairDisplay(orgId: string, branchId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const parsed = pairDisplayFormSchema.safeParse(formObject(data, ["serviceIds"]));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("pair_display", {
    p_code: v.code,
    p_branch: branchId,
    p_name: v.name,
    p_service_ids: v.serviceIds,
  });
  if (error) {
    if (error.message === "pairing_code_invalid") return { ok: false, error: "generic", fieldErrors: { code: "pairing_code_invalid" } };
    return { ok: false, error: mapDbError(error) };
  }
  done(orgId, branchId, "paired");
}

export async function updateDisplay(orgId: string, branchId: string, displayId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  if (!id.safeParse(displayId).success) return { ok: false, error: "not_found" };
  const parsed = displayFormSchema.safeParse(formObject(data, ["serviceIds"]));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("update_display", {
    p_display: displayId,
    p_name: parsed.data.name,
    p_service_ids: parsed.data.serviceIds,
    p_show_ads: false,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(orgId, branchId);
}

export async function revokeDisplay(orgId: string, branchId: string, displayId: string): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  if (!id.safeParse(displayId).success) return { ok: false, error: "not_found" };
  const { error } = await supabase.rpc("revoke_display", { p_display: displayId });
  if (error) return { ok: false, error: mapDbError(error) };
  done(orgId, branchId, "revoked");
}

/** Réglages des annonces vocales de l'agence (créés au premier enregistrement). */
export async function saveAnnouncementSettings(orgId: string, branchId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await scope(orgId, branchId);
  const parsed = announcementSettingsFormSchema.safeParse(formObject(data, ["languages"]));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { data: affected, error } = await supabase
    .from("announcement_settings")
    .upsert(
      {
        organization_id: orgId,
        branch_id: branchId,
        languages: v.languages,
        volume: v.volume,
        repeat_count: v.repeatCount,
        chime_enabled: v.chimeEnabled,
        quiet_hours: v.quietEnabled ? [{ from: v.quietFrom, to: v.quietTo }] : [],
      },
      { onConflict: "branch_id" },
    )
    .select("branch_id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, branchId);
}
