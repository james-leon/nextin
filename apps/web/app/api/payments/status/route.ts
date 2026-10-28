import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { callRpc } from "@/lib/client/supabase-public";
import { refreshPayment } from "@/lib/payments/service";
import type { PayInvoiceView } from "@/lib/payments/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const body = z.object({ token: z.string().regex(/^[A-Za-z0-9]{32}$/) });

/**
 * POST /api/payments/status — état de la facture d'un lien de paiement (interrogé par la page pendant la validation
 * sur le téléphone). Un paiement en attente est revérifié auprès du fournisseur avant de répondre.
 */
export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const view = await callRpc<PayInvoiceView | null>("pay_invoice_view", { p_token: parsed.data.token });
  if (view.error || !view.data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (view.data.payment?.status === "pending") {
    const admin = getSupabaseAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("external_id, provider_ref")
      .eq("external_id", view.data.payment.external_id)
      .maybeSingle();
    if (payment) {
      await refreshPayment(payment.external_id, payment.provider_ref, admin).catch((e: unknown) =>
        console.error("[payments] refresh failed", e instanceof Error ? e.message : e),
      );
      const fresh = await callRpc<PayInvoiceView | null>("pay_invoice_view", { p_token: parsed.data.token });
      if (fresh.data) return NextResponse.json({ ok: true, view: fresh.data }, { headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json({ ok: true, view: view.data }, { headers: { "Cache-Control": "no-store" } });
}
