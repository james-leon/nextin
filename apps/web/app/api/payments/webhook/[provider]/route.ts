import { NextResponse, type NextRequest } from "next/server";
import { activeProvider, applyEvent } from "@/lib/payments/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook de l'agrégateur (§11.5) : signature vérifiée sur le corps brut, événement enregistré une seule fois
 * (`record_webhook_event`), puis statut **revérifié auprès du fournisseur** avant toute activation : un webhook seul
 * n'active jamais un abonnement.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  return handle(name, await request.text(), request.headers);
}

/** CamPay (B1) appelle le webhook en GET, paramètres et signature dans l'adresse : la chaîne de requête sert de corps. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  if (name !== "campay") return new NextResponse(null, { status: 405 });
  return handle(name, request.nextUrl.search.replace(/^\?/, ""), request.headers);
}

async function handle(name: string, raw: string, headers: Headers) {
  const provider = activeProvider();
  if (name !== provider.name) return new NextResponse(null, { status: 404 });

  if (!provider.verifyWebhook(raw, headers)) return new NextResponse(null, { status: 401 });
  let event;
  try {
    event = provider.parseEvent(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: fresh, error } = await admin.rpc("record_webhook_event", {
    p_provider: provider.name,
    p_event_id: event.eventId,
    p_payload: { externalId: event.externalId, status: event.status },
  });
  if (error) return new NextResponse(null, { status: 500 });
  // Déjà traité : réponse 200 pour que le fournisseur cesse de renvoyer l'événement.
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  const { data: payment } = await admin.from("payments").select("provider_ref").eq("external_id", event.externalId).maybeSingle();
  if (!payment) return NextResponse.json({ ok: true, unknown: true });
  const verified = await provider.fetchStatus(event.externalId, payment.provider_ref ?? event.providerRef);
  await applyEvent(verified, admin);
  return NextResponse.json({ ok: true, status: verified.status });
}
