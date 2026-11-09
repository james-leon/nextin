import type { Locale } from "@nextin/shared/i18n";
import type { InvoiceContent } from "@/lib/pdf/invoice";
import { formatDay, formatXafPlain } from "./format";
import type { InvoiceDocumentData } from "./types";

type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * Contenu du PDF d'une facture, construit uniquement à partir de l'instantané figé en base (mentions de Wintek et
 * identité du client au moment de l'émission) : la facture rendue reste identique même si les réglages changent.
 */
export function invoiceContent(inv: InvoiceDocumentData, locale: Locale, t: T, tc: T): InvoiceContent {
  const xaf = (n: number) => formatXafPlain(n, locale);
  const seller = inv.seller_snapshot;
  const buyer = inv.buyer_snapshot;
  const vat = Number(inv.vat_rate);
  const lines = inv.lines.map((l) => ({
    label: locale === "en" ? l.label_en : l.label,
    quantity: l.quantity,
    unit: l.unit_xaf != null ? xaf(l.unit_xaf) : undefined,
    // Ligne d'information (mois offerts) : pas de montant.
    amount: l.kind === "annual_note" ? "" : xaf(l.amount_xaf),
  }));
  const totals: InvoiceContent["totals"] = [{ label: t("subtotal"), value: xaf(inv.subtotal_xaf) }];
  if (inv.discount_xaf > 0) totals.push({ label: t("discount"), value: xaf(-inv.discount_xaf) });
  totals.push(vat > 0 ? { label: t("tax", { rate: vat }), value: xaf(inv.tax_xaf) } : { label: t("noTax"), value: xaf(0) });
  totals.push({ label: t("total"), value: xaf(inv.total_xaf), strong: true });

  return {
    number: inv.number,
    title: t("title"),
    issued: t("issued", { date: formatDay(inv.issued_at, locale) }),
    due: t("due", { date: formatDay(inv.due_at, locale) }),
    period: t("period", { from: formatDay(inv.period_start, locale), to: formatDay(inv.period_end, locale) }),
    periodKind: inv.kind === "campaign" ? t("campaign") : t(inv.billing_period),
    seller: {
      heading: t("seller"),
      lines: [
        seller.legal_name || "Wintek",
        seller.address,
        seller.rc ? t("rc", { value: seller.rc }) : "",
        seller.niu ? t("niu", { value: seller.niu }) : "",
        [seller.phone, seller.email].filter(Boolean).join(" · "),
      ].filter(Boolean),
    },
    buyer: {
      heading: t("buyer"),
      lines: [buyer.name, buyer.city ?? "", [buyer.phone, buyer.email].filter(Boolean).join(" · ")].filter(Boolean),
    },
    columns: { description: t("description"), quantity: t("quantity"), unit: t("unit"), amount: t("amount") },
    lines,
    totals,
    stamp:
      inv.status === "paid" && inv.paid_at
        ? { text: t("paid", { date: formatDay(inv.paid_at, locale), channel: inv.paid_channel ? tc(inv.paid_channel) : "Mobile Money" }), tone: "paid" }
        : inv.status === "void"
          ? { text: t("voided"), tone: "void" }
          : null,
    footer: seller.footer,
  };
}
