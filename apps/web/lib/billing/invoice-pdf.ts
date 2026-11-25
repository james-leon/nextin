import "server-only";
import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { absoluteUrl } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { InvoiceDocument } from "@/lib/pdf/invoice";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { invoiceContent } from "./invoice-content";
import type { InvoiceDocumentData } from "./types";

/**
 * Réponse PDF d'une facture (abonnement, extension ou campagne), rendue depuis son instantané immuable.
 * `payer` : identifiant de l'utilisateur qui peut payer cette facture (administrateur de l'établissement, propriétaire
 * ou éditeur de l'annonceur), vérifié par la route. Facture ouverte : un nouveau lien `/pay/<jeton>` est créé pour le
 * QR code (le jeton n'est stocké qu'en empreinte, `create_pay_link`), 10 par heure et par utilisateur au plus. Facture
 * payée : référence du paiement confirmé.
 */
export async function invoicePdfResponse(invoice: InvoiceDocumentData, payer?: string | null): Promise<Response> {
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const t = await getTranslations({ locale, namespace: "invoicePdf" });
  const tc = await getTranslations({ locale, namespace: "channels" });
  const admin = getSupabaseAdminClient();
  let payUrl: string | null = null;
  let paymentRef: string | null = null;
  if (invoice.status === "open" && payer) {
    const { data: allowed } = await admin.rpc("check_rate_limit", { p_key: `invoice_pay_link:${payer}`, p_max: 10, p_window: "1 hour" });
    if (allowed === true) {
      const { data: token } = await admin.rpc("create_pay_link", { p_invoice: invoice.id });
      if (typeof token === "string") payUrl = absoluteUrl(`/pay/${token}`);
    }
  } else if (invoice.status === "paid") {
    const { data: payment } = await admin
      .from("payments")
      .select("provider_ref, external_id")
      .eq("invoice_id", invoice.id)
      .eq("status", "succeeded")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    paymentRef = payment?.provider_ref ?? payment?.external_id ?? null;
  }
  const element = createElement(
    InvoiceDocument,
    invoiceContent(
      invoice,
      locale,
      (k, v) => t(k as Parameters<typeof t>[0], v),
      (k) => tc(k as Parameters<typeof tc>[0]),
      { payUrl, paymentRef },
    ),
  ) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nextin-${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
