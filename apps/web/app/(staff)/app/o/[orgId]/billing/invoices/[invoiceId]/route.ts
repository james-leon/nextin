import { z } from "zod";
import { invoicePdfResponse } from "@/lib/billing/invoice-pdf";
import type { InvoiceDocumentData } from "@/lib/billing/types";
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
  const invoice = data as unknown as InvoiceDocumentData;
  if (invoice.organization_id !== orgId) return new Response("Not found", { status: 404 });
  return invoicePdfResponse(invoice);
}
