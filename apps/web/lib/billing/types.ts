import type { BillingPeriod, PaymentChannel, PlanFeature, SubscriptionStatus } from "@nextin/shared/billing";

/** Devis renvoyé par `subscription_price` (FCFA hors taxe). */
export type PriceQuote = { monthly: number; months: number; extra_branches: number; subtotal: number; discount: number; total: number };

export type PlanOffer = {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  base_price_xaf: number;
  included_branches: number;
  extra_branch_price_xaf: number | null;
  max_counters_per_branch: number | null;
  max_displays_per_branch: number | null;
  features: Partial<Record<PlanFeature, boolean>>;
  whatsapp_quota_per_branch: number;
  annual_free_months: number;
  monthly: PriceQuote;
  annual: PriceQuote;
  fits: boolean;
};

export type Entitlements = {
  pilot: boolean;
  plan_code: string;
  subscribed_plan_code: string | null;
  status: SubscriptionStatus;
  can_issue: boolean;
  included_branches: number;
  extra_branch_price_xaf: number | null;
  max_counters_per_branch: number | null;
  max_displays_per_branch: number | null;
  whatsapp_quota: number;
  features: Partial<Record<PlanFeature, boolean>>;
};

export type InvoiceSummary = {
  id: string;
  number: string;
  status: "open" | "paid" | "void";
  total_xaf: number;
  issued_at: string;
  paid_at: string | null;
  period_start: string;
  period_end: string;
  billing_period: BillingPeriod;
  kind: "renewal" | "upgrade";
  paid_channel: PaymentChannel | null;
  plan_id: string | null;
};

/** Réponse de `billing_overview` (page Abonnement). */
export type BillingOverview = {
  subscription: {
    id: string;
    plan_id: string;
    billing_period: BillingPeriod;
    status: SubscriptionStatus;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    grace_ends_at: string | null;
    read_only_since: string | null;
    deletion_due_at: string | null;
    pending_status: SubscriptionStatus | null;
    pending_status_after: string | null;
    next_plan_id: string | null;
    billing_phone_masked: string | null;
    billing_email: string | null;
  } | null;
  entitlements: Entitlements;
  usage: { branches: number; counters_max: number | null; displays_max: number | null; whatsapp_sent: number };
  discount: { kind: "percent" | "fixed_xaf"; value: number; remaining: number; reason: string | null } | null;
  plans: PlanOffer[];
  invoices: InvoiceSummary[];
  settings: { trial_days: number; grace_days: number; vat_rate: number };
};

export type InvoiceLineData = {
  kind: "plan" | "extra_branches" | "annual_note" | "discount" | "credit" | "campaign";
  label: string;
  label_en: string;
  quantity?: number;
  unit_xaf?: number;
  amount_xaf: number;
};

/** Réponse de `invoice_document` : facture figée (identités de l'émetteur et du client comprises). */
export type InvoiceDocumentData = {
  id: string;
  number: string;
  /** M10b : facture d'une campagne publicitaire (annonceur), sinon abonnement. */
  kind?: string;
  organization_id: string | null;
  advertiser_id?: string | null;
  status: "open" | "paid" | "void";
  billing_period: BillingPeriod;
  period_start: string;
  period_end: string;
  lines: InvoiceLineData[];
  subtotal_xaf: number;
  discount_xaf: number;
  vat_rate: number;
  tax_xaf: number;
  total_xaf: number;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  paid_channel: PaymentChannel | null;
  buyer_snapshot: { name: string; phone: string | null; email: string | null; city: string | null };
  seller_snapshot: { legal_name: string; rc: string; niu: string; address: string; phone: string; email: string; footer: string };
};
