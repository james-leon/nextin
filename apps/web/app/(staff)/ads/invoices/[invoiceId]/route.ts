import { z } from "zod";
import { invoicePdfResponse } from "@/lib/billing/invoice-pdf";
import type { InvoiceDocumentData } from "@/lib/billing/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Facture PDF d'une campagne (M10b) : membres de l'annonceur ou super admin (vérifié par `invoice_document`). */
export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (!z.uuid().safeParse(invoiceId).success) return new Response("Bad request", { status: 400 });

  const supabase = await getSupabaseServerClient();
  // Session vérifiée auprès de Supabase (une session révoquée est refusée), comme partout ailleurs.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase.rpc("invoice_document", { p_invoice: invoiceId });
  if (error || !data) return new Response("Not found", { status: error?.code === "42501" ? 403 : 404 });
  const invoice = data as unknown as InvoiceDocumentData;
  if (!invoice.advertiser_id) return new Response("Not found", { status: 404 });
  // Lien de paiement dans le PDF : propriétaire ou éditeur de l'annonceur (jamais un caissier ni la console).
  const { data: member } = await supabase.from("advertiser_members").select("role").eq("user_id", user.id).eq("advertiser_id", invoice.advertiser_id).in("role", ["owner", "editor"]).limit(1).maybeSingle();
  return invoicePdfResponse(invoice, member ? user.id : null);
}
