"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messages } from "@nextin/shared/i18n";
import {
  adminChangePlanSchema,
  adminDiscountSchema,
  adminGrantDaysSchema,
  adminLimitsSchema,
  adminPlanFormSchema,
  adminQuotaPackSchema,
  adminSuspensionSchema,
  adPackageFormSchema,
  adSectorFormSchema,
  campaignReviewSchema,
  platformSettingsFormSchema,
  mfaResetSchema,
  adminCreateOrganizationSchema,
  manualPaymentCancelSchema,
  manualPaymentSchema,
} from "@nextin/shared/schemas";
import { slugify, templateServices } from "@nextin/shared";
import type { Json } from "@nextin/shared/database";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/notifications/invitation";
import { resendInvitationWith, type ResendResult } from "@/lib/admin/invitations";

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
    max_services: v.maxServices,
    max_counters: v.maxCounters,
    max_displays: v.maxDisplays,
    max_users: v.maxUsers,
    tickets_per_month: v.ticketsPerMonth,
    whatsapp_quota: v.whatsappQuota,
    history_months: v.historyMonths,
    annual_free_months: v.annualFreeMonths,
    quote_only: v.quoteOnly,
    trial_eligible: v.trialEligible,
    active: v.active,
    features: {
      voice_announcements: v.voiceAnnouncements,
      appointments: v.appointments,
      remote_tickets: v.remoteTickets,
      advanced_stats: v.advancedStats,
      export: v.export,
      multisite: v.multisite,
      priority_support: v.prioritySupport,
      dedicated_support: v.dedicatedSupport,
    },
  };
  const { error } = await supabase.rpc("admin_update_plan", { p_plan: v.planId, p_fields: fields as unknown as Json });
  if (error) return { ok: false, error: mapDbError(error) };
  done(`/admin/plans/${v.planId}`);
}

/** Limites sur mesure d'un client (formule sur devis) : vide = valeur de la formule, « illimité » = sans limite. */
export async function setLimits(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminLimitsSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { subscriptionId, reason, ...limits } = parsed.data;
  const overrides = Object.fromEntries(Object.entries(limits).filter(([, v]) => v !== undefined));
  const { error } = await supabase.rpc("admin_set_limits", {
    p_subscription: subscriptionId,
    p_limits: overrides as unknown as Json,
    p_reason: reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  done(sub(subscriptionId));
}

/** Extension de quota vendue à l'unité (création ou édition). */
export async function saveQuotaPack(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = adminQuotaPackSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  if (!v.packId && (!v.code || !v.kind)) return { ok: false, error: "generic", fieldErrors: { code: "pack_code_invalid" } };
  const { error } = await supabase.rpc("admin_save_quota_pack", {
    p_pack: (v.packId ?? null) as string,
    p_fields: { code: v.code, kind: v.kind, quantity: v.quantity, price_xaf: v.priceXaf, name: v.name, name_en: v.nameEn, active: v.active } as unknown as Json,
  });
  if (error) return { ok: false, error: mapDbError(error, "pack_code_invalid") };
  done("/admin/plans");
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
      request_channels: v.requestChannels,
      signup_code_channel: v.signupCodeChannel,
      mfa_required: v.mfaRequired,
    },
  });
  if (error) return { ok: false, error: mapDbError(error) };
  const alerts = await supabase.rpc("admin_set_security_alert_email", { p_email: v.securityAlertEmail ?? "" });
  if (alerts.error) return { ok: false, error: mapDbError(alerts.error) };
  done("/admin/settings");
}

/** Réinitialisation de la double authentification d'un compte (téléphone perdu), motif obligatoire, journalisée. */
export async function resetAccountMfa(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = mfaResetSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("admin_reset_mfa", { p_email: parsed.data.email, p_reason: parsed.data.reason });
  if (error) {
    const code = mapDbError(error);
    return { ok: false, error: code, fieldErrors: error.message === "not_found" ? { email: "not_found" } : undefined };
  }
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

export type CreatedOrganization = {
  organizationId: string;
  name: string;
  email: string;
  mailSent: boolean;
  /** Lien d'invitation, montré seulement si l'e-mail n'est pas parti (à transmettre au responsable). */
  link: string | null;
};

/**
 * P1 — établissement créé pour un client : formule, essai, première agence, services du modèle, invitation du
 * responsable. L'e-mail part aussitôt (jeton jamais stocké en clair) ; s'il échoue, le lien est affiché une fois.
 */
export async function createOrganizationForClient(
  _prev: ActionResult<CreatedOrganization> | null,
  data: FormData,
): Promise<ActionResult<CreatedOrganization>> {
  const supabase = await platform();
  const parsed = adminCreateOrganizationSchema.safeParse(formObject(data, ["services"]));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { data: created, error } = await supabase.rpc("admin_create_organization", {
    p_fields: {
      name: v.name,
      type: v.type,
      locale: v.locale,
      slug: slugify(v.name),
      plan_id: v.planId,
      trial_days: v.trialDays,
      owner_email: v.ownerEmail,
      owner_phone: v.ownerPhone ?? null,
      branch_name: v.branchName,
      branch_city: v.branchCity,
      services: templateServices(v.type, v.services),
      reason: v.reason,
    } as Json,
  });
  if (error || !created) return { ok: false, error: mapDbError(error) };
  const result = created as { organization_id: string; token: string };
  const { mailSent, link } = await sendInvitationEmail({
    to: v.ownerEmail,
    token: result.token,
    organization: v.name,
    role: "org_admin",
    locale: v.locale,
    byWintek: true,
  });
  revalidatePath("/admin", "layout");
  return { ok: true, organizationId: result.organization_id, name: v.name, email: v.ownerEmail, mailSent, link: mailSent ? null : link };
}

/** P2 — console : renvoi de l'invitation d'un responsable (nouveau lien, 7 jours). */
export async function resendOwnerInvitation(invitationId: string): Promise<ResendResult> {
  const supabase = await platform();
  const result = await resendInvitationWith(supabase, invitationId, true);
  revalidatePath("/admin", "layout");
  return result;
}

/** C1 — paiement reçu hors ligne : même effet qu'un paiement en ligne (base : `admin_record_manual_payment`). */
export async function recordManualPayment(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = manualPaymentSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const { error } = await supabase.rpc("admin_record_manual_payment", {
    p_invoice: v.invoiceId,
    p_fields: { method: v.method, amount_xaf: v.amountXaf, paid_on: v.paidOn, reference: v.reference, note: v.note } as Json,
  });
  if (error) {
    const code = mapDbError(error);
    const fieldOf: Partial<Record<string, string>> = { amount_mismatch: "amountXaf", reference_required: "reference", invalid_date: "paidOn" };
    const fieldName = fieldOf[code];
    return fieldName ? { ok: false, error: code, fieldErrors: { [fieldName]: code } } : { ok: false, error: code };
  }
  done(`/admin/invoices/${v.invoiceId}/payment`);
}

/** C1 — annulation d'un paiement manuel, motif obligatoire ; code de double authentification récent si exigé. */
export async function cancelManualPayment(manualPaymentId: string, reason: string, invoiceId: string): Promise<ActionResult> {
  const supabase = await platform();
  const parsed = manualPaymentCancelSchema.safeParse({ manualPaymentId, reason });
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { error } = await supabase.rpc("admin_cancel_manual_payment", { p_manual: parsed.data.manualPaymentId, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/invoices/${invoiceId}/payment`);
  return { ok: true };
}
