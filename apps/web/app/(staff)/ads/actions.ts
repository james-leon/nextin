"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { messages } from "@nextin/shared/i18n";
import {
  advertiserSignupSchema,
  campaignFormSchema,
  couponCodeSchema,
  creativeFormSchema,
  gameSkinFormSchema,
  quizFormSchema,
} from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { campaignFields, type CampaignRow } from "@/lib/ads/types";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Espace annonceur (M10b) : Zod → RPC (droits vérifiés par la base : membres de l'annonceur, ou administrateurs de
 * l'établissement pour une annonce Maison) → revalidation → redirection.
 */
const KNOWN = Object.keys(messages.fr.errors);
const id = z.uuid();

async function client(next = "/ads") {
  await requireStaffSession(next);
  return getSupabaseServerClient();
}

/** Page de la campagne : espace annonceur, ou back-office de l'établissement pour une annonce Maison. */
function campaignPath(c: Pick<CampaignRow, "id" | "organization_id">) {
  return c.organization_id ? `/app/o/${c.organization_id}/ads/${c.id}` : `/ads/campaigns/${c.id}`;
}

async function loadCampaign(campaignId: string) {
  if (!id.safeParse(campaignId).success) redirect("/ads");
  const supabase = await client();
  const { data: c } = await supabase.from("ad_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!c) redirect("/ads");
  return { supabase, c };
}

function done(path: string): never {
  revalidatePath("/ads", "layout");
  revalidatePath(path);
  redirect(`${path}${path.includes("?") ? "&" : "?"}saved=1`);
}

/* ─── Compte annonceur ────────────────────────────────────────────────────── */

export async function createAdvertiser(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await client();
  const parsed = advertiserSignupSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("create_advertiser", {
    p_name: parsed.data.name,
    p_sector: parsed.data.sector,
    p_phone: (parsed.data.phone ?? null) as string,
    p_city: (parsed.data.city ?? null) as string,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath("/ads", "layout");
  redirect("/ads");
}

/* ─── Campagne ────────────────────────────────────────────────────────────── */

/**
 * Création ou modification d'une campagne. `owner` : { advertiserId } ou { organizationId } (annonce Maison, créée
 * et publiée en une fois depuis le back-office). Champs multiples dans `payload` (JSON).
 */
export async function saveCampaign(
  owner: { advertiserId?: string; organizationId?: string; campaignId?: string },
  _prev: ActionResult | null,
  data: FormData,
): Promise<ActionResult> {
  const supabase = await client();
  let raw: unknown;
  try {
    raw = JSON.parse(String(data.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "generic" };
  }
  const parsed = campaignFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  let visa = { number: v.healthVisaNumber, path: v.healthVisaDocumentPath };
  if (owner.campaignId) {
    const { data: current } = await supabase.from("ad_campaigns").select("health_visa_number, health_visa_document_path").eq("id", owner.campaignId).maybeSingle();
    visa = { number: v.healthVisaNumber ?? current?.health_visa_number ?? null, path: current?.health_visa_document_path ?? null };
  }
  const { data: campaignId, error } = await supabase.rpc("save_campaign", {
    p_campaign: (owner.campaignId ?? null) as string,
    p_advertiser: (owner.advertiserId ?? null) as string,
    p_organization: (owner.organizationId ?? null) as string,
    p_fields: {
      name: v.name,
      package_code: v.packageCode,
      sector: v.sector,
      starts_on: v.startsOn,
      surfaces: v.surfaces,
      target_cities: v.targetCities,
      target_org_types: v.targetOrgTypes,
      schedules: v.schedules,
      health_visa_number: visa.number ?? "",
      health_visa_document_path: visa.path ?? "",
    },
  });
  if (error) {
    const code = mapDbError(error);
    return { ok: false, error: code, fieldErrors: code === "invalid_state" && error.details === "starts_on" ? { startsOn: "invalid_state" } : undefined };
  }
  done(owner.organizationId ? `/app/o/${owner.organizationId}/ads/${campaignId}` : `/ads/campaigns/${campaignId}`);
}

/** Visa santé : numéro et justificatif (déjà déposé dans `ad-documents`). */
export async function saveVisa(campaignId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const number = String(data.get("number") ?? "").trim().slice(0, 60);
  const path = String(data.get("path") ?? "").trim().slice(0, 300);
  if (number.length < 3) return { ok: false, error: "generic", fieldErrors: { number: "name_too_short" } };
  const { data: schedules } = await supabase.from("ad_schedules").select("weekday, start_time, end_time").eq("campaign_id", c.id);
  const fields = { ...campaignFields(c, schedules ?? []), health_visa_number: number, health_visa_document_path: path || (c.health_visa_document_path ?? "") };
  const { error } = await supabase.rpc("save_campaign", { p_campaign: c.id, p_advertiser: null as unknown as string, p_organization: null as unknown as string, p_fields: fields });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

export async function saveCreative(campaignId: string, creativeId: string | null, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const parsed = creativeFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("save_creative", {
    p_campaign: c.id,
    p_creative: (creativeId ?? null) as string,
    p_fields: { storage_path: v.storagePath, kind: v.kind, headline: v.headline, offer_text: v.offerText ?? "", cta_url: v.ctaUrl ?? "", duration_seconds: v.durationSeconds },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

export async function deleteCreative(campaignId: string, creativeId: string): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  if (!id.safeParse(creativeId).success) return { ok: false, error: "not_found" };
  const { error } = await supabase.rpc("delete_creative", { p_creative: creativeId });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

export async function saveQuiz(campaignId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  let raw: unknown;
  try {
    raw = JSON.parse(String(data.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "generic" };
  }
  const parsed = quizFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "quiz_invalid") ? "quiz_invalid" : "generic" };
  const v = parsed.data;
  const { error } = await supabase.rpc("save_quiz", {
    p_campaign: c.id,
    p_fields: {
      title: v.title,
      reward_text: v.rewardText,
      coupon_validity_days: v.couponValidityDays,
      max_coupons: v.maxCoupons,
      questions: v.questions,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

export async function deleteQuiz(campaignId: string): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const { error } = await supabase.rpc("delete_quiz", { p_campaign: c.id });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

export async function saveSkin(campaignId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const parsed = gameSkinFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("save_game_skin", {
    p_campaign: c.id,
    p_fields: {
      plane_primary: v.planePrimary,
      plane_secondary: v.planeSecondary,
      coin_logo_path: v.coinLogoPath ?? "",
      end_title: v.endTitle,
      reward_text: v.rewardText,
      coupon_validity_days: v.couponValidityDays,
      max_coupons: v.maxCoupons,
      min_levels: v.minLevels,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

export async function deleteSkin(campaignId: string): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const { error } = await supabase.rpc("delete_game_skin", { p_campaign: c.id });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

/** Soumission à la modération (annonce Maison : publication directe). */
export async function submitCampaign(campaignId: string): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const { error } = await supabase.rpc("submit_campaign", { p_campaign: c.id });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

/** Paiement d'une campagne validée : facture puis page de paiement (même agrégateur que les abonnements). */
export async function checkoutCampaign(campaignId: string): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const { data: result, error } = await supabase.rpc("campaign_checkout", { p_campaign: c.id });
  if (error) return { ok: false, error: mapDbError(error) };
  redirect(`/pay/${(result as { pay_token: string }).pay_token}`);
}

/* ─── Bons en caisse ──────────────────────────────────────────────────────── */

export type CouponCheck = { code: string; reward: string; reward_en: string | null; expires_at: string; redeemed_at: string | null; campaign: string; expired: boolean };

/** Vérification (`confirm` absent) puis validation d'un bon, par son code ou le jeton de son QR code. */
export async function redeemCoupon(_prev: ActionResult<{ coupon?: CouponCheck }> | null, data: FormData): Promise<ActionResult<{ coupon?: CouponCheck }>> {
  const supabase = await client("/ads/redeem");
  const parsed = couponCodeSchema.safeParse(data.get("code"));
  if (!parsed.success) return { ok: false, error: "not_found", fieldErrors: { code: "not_found" } };
  const confirm = data.get("confirm") === "1";
  const { data: coupon, error } = await supabase.rpc("redeem_coupon", { p_code: parsed.data, p_confirm: confirm });
  if (error) return { ok: false, error: mapDbError(error) };
  return { ok: true, coupon: coupon as unknown as CouponCheck };
}

/* ─── Agences choisies (formules plafonnées) ──────────────────────────────── */

export async function saveCampaignBranches(campaignId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const { supabase, c } = await loadCampaign(campaignId);
  const ids = data.getAll("branchIds").map(String);
  if (ids.length > 200 || !ids.every((v) => id.safeParse(v).success)) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("set_campaign_branches", { p_campaign: c.id, p_branches: ids });
  if (error) return { ok: false, error: mapDbError(error) };
  done(campaignPath(c));
}

/* ─── Caissiers (propriétaire) ────────────────────────────────────────────── */

export async function addCashier(advertiserId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await client("/ads/cashiers");
  const email = z.email().safeParse(String(data.get("email") ?? "").trim());
  if (!id.safeParse(advertiserId).success || !email.success) return { ok: false, error: "generic", fieldErrors: { email: "email_invalid" } };
  const { error } = await supabase.rpc("add_advertiser_cashier", { p_advertiser: advertiserId, p_email: email.data });
  if (error) {
    const code = mapDbError(error);
    return { ok: false, error: code, fieldErrors: code === "user_not_found" ? { email: "user_not_found" } : undefined };
  }
  done("/ads/cashiers");
}

export async function removeCashier(advertiserId: string, userId: string): Promise<ActionResult> {
  const supabase = await client("/ads/cashiers");
  if (!id.safeParse(advertiserId).success || !id.safeParse(userId).success) return { ok: false, error: "not_found" };
  const { error } = await supabase.rpc("remove_advertiser_cashier", { p_advertiser: advertiserId, p_user: userId });
  if (error) return { ok: false, error: mapDbError(error) };
  // Pas de « Caissier ajouté » après un retrait : simple rechargement de la liste.
  revalidatePath("/ads/cashiers");
  redirect("/ads/cashiers");
}
