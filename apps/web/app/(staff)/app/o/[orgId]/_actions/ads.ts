"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adPreferencesSchema } from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import type { ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Publicité de l'établissement (M10b) : secteurs refusés, jeux, annonces Maison. Administrateurs (vérifié par la base). */
export async function saveAdPreferences(orgId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  if (!z.uuid().safeParse(orgId).success) redirect("/app");
  await requireStaffSession(`/app/o/${orgId}/ads`);
  const parsed = adPreferencesSchema.safeParse({
    blockedSectors: data.getAll("blockedSectors").map(String),
    quizEnabled: data.get("quizEnabled") ?? "",
    skyCatchEnabled: data.get("skyCatchEnabled") ?? "",
    houseAdsEnabled: data.get("houseAdsEnabled") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("set_ad_preferences", {
    p_org: orgId,
    p_blocked: parsed.data.blockedSectors,
    p_quiz: parsed.data.quizEnabled,
    p_sky_catch: parsed.data.skyCatchEnabled,
    p_house: parsed.data.houseAdsEnabled,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/app/o/${orgId}/ads`);
  redirect(`/app/o/${orgId}/ads?saved=1`);
}

/** Arrêt d'une annonce Maison : plus aucune diffusion. */
export async function stopHouseCampaign(orgId: string, campaignId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(campaignId).success) return { ok: false, error: "not_found" };
  await requireStaffSession(`/app/o/${orgId}/ads/${campaignId}`);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("end_house_campaign", { p_campaign: campaignId });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/app/o/${orgId}/ads`, "layout");
  redirect(`/app/o/${orgId}/ads/${campaignId}?saved=1`);
}
