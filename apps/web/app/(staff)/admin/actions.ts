"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messages } from "@nextin/shared/i18n";
import {
  adminChangePlanSchema,
  adminDiscountSchema,
  adminGrantDaysSchema,
  adminPlanFormSchema,
  adminSuspensionSchema,
  adPackageFormSchema,
  adSectorFormSchema,
  campaignReviewSchema,
  platformSettingsFormSchema,
} from "@nextin/shared/schemas";
import type { Json } from "@nextin/shared/database";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Console Wintek (§11.9) : actions du super admin. Les droits sont vérifiés par chaque RPC (`assert_platform_admin`)
 * et chaque action est journalisée dans l'audit par la base.
 */
const KNOWN = Object.keys(messages.fr.errors);

async function platform() {
  const session = await requireStaffSession("/admin");
  if (!session.isPlatformAdmin) redirect("/app");
  return getSupabaseServerClient();
}

function done(path: string): never {
  revalidatePath("/admin", "layout");
  redirect(`${path}?saved=1`);
}

const sub = (id: string) => `/admin/subscriptions/${id}`;

export async function grantDays(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminGrantDaysSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("admin_grant_days", {
    p_subscription: parsed.data.subscriptionId,
    p_days: parsed.data.days,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(sub(parsed.data.subscriptionId));
}

export async function applyDiscount(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminDiscountSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("admin_apply_discount", {
    p_org: parsed.data.organizationId,
    p_kind: parsed.data.kind,
    p_value: parsed.data.value,
    p_invoices: parsed.data.invoices,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(sub(String(data.get("subscriptionId"))));
}

export async function changePlan(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminChangePlanSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("admin_change_plan", {
    p_subscription: parsed.data.subscriptionId,
    p_plan: parsed.data.planId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(sub(parsed.data.subscriptionId));
}

export async function setSuspension(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminSuspensionSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("admin_set_suspension", {
    p_org: parsed.data.organizationId,
    p_suspended: parsed.data.suspended,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(sub(String(data.get("subscriptionId"))));
}

export async function updatePlan(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminPlanFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const fields = {
    name: v.name,
    name_en: v.nameEn,
    description: v.description,
    base_price_xaf: v.basePriceXaf,
    included_branches: v.includedBranches,
    extra_branch_price_xaf: v.extraBranchPriceXaf,
    max_counters_per_branch: v.maxCountersPerBranch,
    max_displays_per_branch: v.maxDisplaysPerBranch,
    whatsapp_quota_per_branch: v.whatsappQuotaPerBranch,
    annual_free_months: v.annualFreeMonths,
    active: v.active,
    features: {
      voice_announcements: v.voiceAnnouncements,
      appointments: v.appointments,
      remote_tickets: v.remoteTickets,
      advanced_stats: v.advancedStats,
      export: v.export,
      dedicated_support: v.dedicatedSupport,
    },
  };
  const { error } = await supabase.rpc("admin_update_plan", { p_plan: v.planId, p_fields: fields as unknown as Json });
  if (error) return { ok: false, error: mapDbError(error) };
  done(`/admin/plans/${v.planId}`);
}

export async function updateSettings(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = platformSettingsFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("admin_update_settings", {
    p_fields: {
      company_legal_name: v.companyLegalName,
      company_rc: v.companyRc,
      company_niu: v.companyNiu,
      company_address: v.companyAddress,
      company_phone: v.companyPhone,
      company_email: v.companyEmail,
      invoice_footer: v.invoiceFooter,
      trial_days: v.trialDays,
      grace_days: v.graceDays,
      read_only_days: v.readOnlyDays,
      retention_after_suspension_days: v.retentionAfterSuspensionDays,
      default_closing_time: v.defaultClosingTime,
      vat_rate: v.vatRate,
      invoice_lead_days: v.invoiceLeadDays,
      quota_alert_percent: v.quotaAlertPercent,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done("/admin/settings");
}

/* ─── Publicité (M10b) ────────────────────────────────────────────────────── */

const campaign = (id: string) => `/admin/ads/${id}`;

/** Validation ou refus d'une campagne (motif obligatoire pour un refus, visa santé vérifié par la base). */
export async function reviewCampaign(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = campaignReviewSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("review_campaign", {
    p_campaign: parsed.data.campaignId,
    p_approve: parsed.data.approve,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: mapDbError(error), fieldErrors: error.message === "reason_required" ? { note: "reason_required" } : undefined };
  done(campaign(parsed.data.campaignId));
}

/** Pause ou reprise d'une campagne diffusée (motif obligatoire). */
export async function setCampaignPaused(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = campaignReviewSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic" };
  const { error } = await supabase.rpc("admin_set_campaign_paused", {
    p_campaign: parsed.data.campaignId,
    p_paused: parsed.data.approve,
    p_reason: parsed.data.note,
  });
  if (error) return { ok: false, error: mapDbError(error), fieldErrors: error.message === "reason_required" ? { note: "reason_required" } : undefined };
  done(campaign(parsed.data.campaignId));
}

export async function updateAdPackage(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adPackageFormSchema.safeParse(formObject(data, ["surfaces"]));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("admin_update_ad_package", {
    p_code: v.code,
    p_fields: {
      price_xaf: v.priceXaf,
      duration_days: v.durationDays,
      max_branches: v.maxBranches,
      share_of_voice: v.shareOfVoice,
      surfaces: v.surfaces,
      quiz_allowed: v.quizAllowed,
      game_skin_allowed: v.gameSkinAllowed,
      active: v.active,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done("/admin/ads/packages");
}

export async function upsertAdSector(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adSectorFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("admin_upsert_ad_sector", {
    p_code: v.code,
    p_name: v.name,
    p_name_en: v.nameEn,
    p_requires_visa: v.requiresHealthVisa,
    p_active: v.active,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done("/admin/ads/packages");
}
