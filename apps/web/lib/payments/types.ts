import type { BillingPeriod, PaymentChannel } from "@nextin/shared/billing";

/** Réponse de `pay_invoice_view` (page publique `/pay/<jeton>`), sans donnée personnelle hors nom de l'établissement. */
export type PayInvoiceView = {
  invoice_id: string;
  number: string;
  status: "open" | "paid" | "void";
  total_xaf: number;
  billing_period: BillingPeriod;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  organization: string;
  plan: { name: string; name_en: string | null } | null;
  /** Facture d'une campagne publicitaire (M10b) ; `organization` est alors le nom de l'annonceur. */
  campaign?: { name: string; package: string; package_en: string } | null;
  lines: { kind: string; label: string; label_en: string; amount_xaf: number }[];
  expired: boolean;
  payment: { status: "pending" | "succeeded" | "failed" | "expired"; channel: PaymentChannel; external_id: string; failure_reason: string | null } | null;
};
