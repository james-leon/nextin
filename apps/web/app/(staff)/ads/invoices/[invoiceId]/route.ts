import { z } from "zod";
import { invoicePdfResponse } from "@/lib/billing/invoice-pdf";
import type { InvoiceDocumentData } from "@/lib/billing/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Facture PDF d'une campagne (M10b) : membres de l'annonceur ou super admin (vérifié par `invoice_document`). */
export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (!z.uuid().safeParse(invoiceId).success) return new Response("Bad request", { status: 400 });

  const supabase = await getSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims || claims.claims.is_anonymous) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase.rpc("invoice_document", { p_invoice: invoiceId });
  if (error || !data) return new Response("Not found", { status: error?.code === "42501" ? 403 : 404 });
  const invoice = data as unknown as InvoiceDocumentData;
  if (!invoice.advertiser_id) return new Response("Not found", { status: 404 });
  return invoicePdfResponse(invoice);
}
