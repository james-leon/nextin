import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { invoiceContent } from "@/lib/billing/invoice-content";
import type { InvoiceDocumentData } from "@/lib/billing/types";
import { InvoiceDocument } from "@/lib/pdf/invoice";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Facture PDF (§11.6), rendue à la demande depuis l'instantané immuable de la facture. Droits vérifiés par
 * `invoice_document` (administrateur de l'établissement ou super admin).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string; invoiceId: string }> }) {
  const { orgId, invoiceId } = await params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(invoiceId).success) return new Response("Bad request", { status: 400 });

  const supabase = await getSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims || claims.claims.is_anonymous) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase.rpc("invoice_document", { p_invoice: invoiceId });
  if (error || !data) return new Response("Not found", { status: error?.code === "42501" ? 403 : 404 });
  const invoice = data as unknown as InvoiceDocumentData & { organization_id: string | null };
  if (invoice.organization_id !== orgId) return new Response("Not found", { status: 404 });

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
