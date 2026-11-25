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
  revalidatePath(`/app/o/${orgId}/ads`, "layout");
  // Enregistrement automatique (maquette v2 24, comme les autres réglages) : pas de redirection.
  if (data.get("autosave") === "1") return { ok: true };
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

const houseFields = z.object({
  title: z.string().trim().min(2, "name_too_short").max(80),
  offer: z.string().trim().max(140).optional().transform((v) => v || null),
});

/** Secteur d'une annonce Maison : le premier secteur actif que l'établissement n'a pas refusé (sinon le premier). */
async function houseSector(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>, orgId: string): Promise<string | null> {
  const [{ data: sectors }, { data: prefs }] = await Promise.all([
    supabase.from("ad_sectors").select("code").eq("active", true).order("sort_order"),
    supabase.from("organization_ad_preferences").select("blocked_sectors").eq("organization_id", orgId).maybeSingle(),
  ]);
  const blocked = new Set(prefs?.blocked_sectors ?? []);
  return (sectors ?? []).find((s) => !blocked.has(s.code))?.code ?? sectors?.[0]?.code ?? null;
}

/**
 * Annonce Maison (maquette v2 24, P11), étape 1 : brouillon créé au choix du visuel (le fichier est rangé sous
 * `org-<établissement>/<annonce>/`, comme l'exige `save_creative`). Mêmes règles qu'avant : formule Maison, aujourd'hui.
 */
export async function createHouseDraft(orgId: string, title: string): Promise<ActionResult<{ campaignId: string }>> {
  if (!z.uuid().safeParse(orgId).success) return { ok: false, error: "not_found" };
  await requireStaffSession(`/app/o/${orgId}/ads/new`);
  const name = title.trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: "name_too_short", fieldErrors: { title: "name_too_short" } };
  const supabase = await getSupabaseServerClient();
  const sector = await houseSector(supabase, orgId);
  const { data: pkg } = await supabase.from("ad_packages").select("code, surfaces").eq("house", true).eq("active", true).order("sort_order").limit(1).maybeSingle();
  if (!sector || !pkg) return { ok: false, error: "generic" };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());
  const { data: campaignId, error } = await supabase.rpc("save_campaign", {
    p_campaign: null as unknown as string,
    p_advertiser: null as unknown as string,
    p_organization: orgId,
    p_fields: {
      name,
      package_code: pkg.code,
      sector,
      starts_on: today,
      surfaces: pkg.surfaces,
      target_cities: [],
      target_org_types: [],
      schedules: [],
      health_visa_number: "",
      health_visa_document_path: "",
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  return { ok: true, campaignId: campaignId as string };
}

/**
 * Annonce Maison, étape 2 : titre, offre et visuel (obligatoire, schéma inchangé), puis publication directe
 * (`submit_campaign` : diffusée tout de suite, sans validation Wintek).
 */
export async function publishHouseAd(orgId: string, campaignId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(campaignId).success) return { ok: false, error: "not_found" };
  await requireStaffSession(`/app/o/${orgId}/ads/new`);
  const parsed = houseFields.safeParse({ title: data.get("title") ?? "", offer: data.get("offer") ?? "" });
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: { title: "name_too_short" } };
  const path = String(data.get("storagePath") ?? "");
  if (!path) return { ok: false, error: "creative_required" };
  const supabase = await getSupabaseServerClient();
  const { data: c } = await supabase.from("ad_campaigns").select("*").eq("id", campaignId).eq("organization_id", orgId).maybeSingle();
  if (!c) return { ok: false, error: "not_found" };
  const { error: nameError } = await supabase.rpc("save_campaign", {
    p_campaign: c.id,
    p_advertiser: null as unknown as string,
    p_organization: null as unknown as string,
    p_fields: {
      name: parsed.data.title,
      package_code: c.package_code,
      sector: c.sector,
      starts_on: c.starts_on,
      surfaces: c.surfaces,
      target_cities: c.target_cities,
      target_org_types: c.target_org_types,
      schedules: [],
      health_visa_number: "",
      health_visa_document_path: "",
    },
  });
  if (nameError) return { ok: false, error: mapDbError(nameError) };
  const { data: existing } = await supabase.from("ad_creatives").select("id").eq("campaign_id", c.id).order("sort_order").limit(1).maybeSingle();
  const { error: creativeError } = await supabase.rpc("save_creative", {
    p_campaign: c.id,
    p_creative: (existing?.id ?? null) as string,
    p_fields: { storage_path: path, kind: "image", headline: parsed.data.title, offer_text: parsed.data.offer ?? "", cta_url: "", duration_seconds: 10 },
  });
  if (creativeError) return { ok: false, error: mapDbError(creativeError) };
  const { error } = await supabase.rpc("submit_campaign", { p_campaign: c.id });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/app/o/${orgId}/ads`, "layout");
  redirect(`/app/o/${orgId}/ads/house?saved=1`);
}
