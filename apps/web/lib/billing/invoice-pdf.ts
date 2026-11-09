import "server-only";
import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { InvoiceDocument } from "@/lib/pdf/invoice";
import { invoiceContent } from "./invoice-content";
import type { InvoiceDocumentData } from "./types";

/** Réponse PDF d'une facture (abonnement ou campagne), rendue depuis son instantané immuable. */
export async function invoicePdfResponse(invoice: InvoiceDocumentData): Promise<Response> {
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const t = await getTranslations({ locale, namespace: "invoicePdf" });
  const tc = await getTranslations({ locale, namespace: "channels" });
  const element = createElement(
    InvoiceDocument,
    invoiceContent(
      invoice,
      locale,
      (k, v) => t(k as Parameters<typeof t>[0], v),
      (k) => tc(k as Parameters<typeof tc>[0]),
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
