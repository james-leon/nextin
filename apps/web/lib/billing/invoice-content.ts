import { amountInWords } from "@nextin/shared/billing";
import type { Locale } from "@nextin/shared/i18n";
import type { InvoiceContent } from "@/lib/pdf/invoice";
import { formatDay, formatXafPlain } from "./format";
import type { InvoiceDocumentData } from "./types";

type T = (key: string, values?: Record<string, string | number>) => string;

/** Lien de paiement d'une facture ouverte (créé au téléchargement, seulement pour qui peut payer) et référence payée. */
export type InvoiceExtras = { payUrl?: string | null; paymentRef?: string | null };

/** Nombre sans devise, espaces ordinaires et vrai signe moins (« −5 990 ») pour le tableau. */
function plain(n: number, locale: Locale): string {
  const s = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(Math.abs(n)).replace(/[\u00a0\u202f]/g, " ");
  return n < 0 ? `−${s}` : s;
}

function shortDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "Africa/Douala" }).format(new Date(iso));
}

function shortDayYear(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Douala" }).format(new Date(iso));
}

/**
 * Contenu du PDF d'une facture (maquette v2 15), construit uniquement à partir de l'instantané figé en base (mentions
 * de Wintek et identité du client au moment de l'émission) : la facture rendue reste identique même si les réglages
 * changent. Les mentions vides (NIU non renseigné…) sont masquées.
 */
export function invoiceContent(inv: InvoiceDocumentData, locale: Locale, t: T, tc: T, extras: InvoiceExtras = {}): InvoiceContent {
  const xaf = (n: number) => formatXafPlain(n, locale);
  const seller = inv.seller_snapshot;
  const buyer = inv.buyer_snapshot;
  const vat = Number(inv.vat_rate);
  const lines = inv.lines.map((l) => ({
    label: locale === "en" ? l.label_en : l.label,
    quantity: l.quantity,
    unit: l.unit_xaf != null ? plain(l.unit_xaf, locale) : undefined,
    // Ligne d'information (mois offerts) : pas de montant.
    amount: l.kind === "annual_note" ? "" : plain(l.amount_xaf, locale),
  }));
  const totals: InvoiceContent["totals"] = [{ label: t("subtotal"), value: xaf(inv.subtotal_xaf) }];
  if (inv.discount_xaf > 0) totals.push({ label: t("discount"), value: `−${xaf(inv.discount_xaf)}` });
  totals.push({ label: t("tax", { rate: vat }), value: xaf(inv.tax_xaf) });
  totals.push({ label: t("total"), value: xaf(inv.total_xaf), strong: true });
  const kind = inv.kind === "campaign" ? "campaign" : inv.kind === "extension" ? "extension" : "subscription";
  const channel = inv.manual_method ? tc(inv.manual_method) : inv.paid_channel ? tc(inv.paid_channel) : "Mobile Money";
  const display = extras.payUrl ? extras.payUrl.replace(/^https?:\/\//, "").replace(/\/pay\/.*$/, "/pay/…") : null;

  return {
    number: inv.number,
    title: t("title"),
    brandLine: t("byWintek", { name: seller.legal_name || "Wintek" }),
    state:
      inv.status === "paid"
        ? { text: t("statePaid"), tone: "paid" }
        : inv.status === "void"
          ? { text: t("stateVoid"), tone: "void" }
          : { text: t("stateOpen"), tone: "open" },
    seller: {
      heading: t("issuedBy"),
      name: seller.legal_name || "Wintek",
      lines: [seller.address, seller.rc ? t("rc", { value: seller.rc }) : "", seller.niu ? t("niu", { value: seller.niu }) : ""].filter(Boolean),
    },
    buyer: {
      heading: t("billedTo"),
      name: buyer.name,
      lines: [buyer.city ?? "", buyer.phone ?? "", buyer.email ?? ""].filter(Boolean),
    },
    dates: {
      heading: t("dates"),
      rows: [
        [t("issuedOn"), shortDayYear(inv.issued_at, locale)],
        [t("dueOn"), shortDayYear(inv.due_at, locale)],
        [t("periodLabel"), t("periodRange", { from: shortDay(inv.period_start, locale), to: shortDay(inv.period_end, locale) })],
      ],
    },
    columns: { description: t("description"), quantity: t("quantity"), unit: t("unit"), amount: t("amount") },
    lines,
    totals,
    words: t("words", { amount: amountInWords(inv.total_xaf, locale) }),
    pay:
      inv.status === "open"
        ? {
            title: t("payTitle"),
            scan: extras.payUrl ? t("payScan") : null,
            url: extras.payUrl ?? null,
            display,
            body: extras.payUrl ? t(`payBody.${kind}`) : `${t("payNoLink")} ${t(`payBody.${kind}`)}`,
          }
        : null,
    settled:
      inv.status === "paid" && inv.paid_at
        ? [t("paidLine", { date: formatDay(inv.paid_at, locale), channel }), extras.paymentRef ? t("paidRef", { ref: extras.paymentRef }) : null].filter(Boolean).join(" · ")
        : inv.status === "void"
          ? t("voidLine")
          : null,
    footerLeft: ["Wintek", seller.email, seller.phone].filter(Boolean).join(" · "),
    footerRight: seller.footer,
  };
}
