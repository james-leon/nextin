import type { NextRequest } from "next/server";
import { adEventsSchema } from "@nextin/shared/schemas";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { bearer, json } from "@/lib/tv/http";

/**
 * POST /api/ads/events — lot d'événements publicitaires (affichage, clic, « Passer »), idempotent par identifiant.
 * Page client : `ticketToken` dans le corps ; écran TV : jeton d'appareil en Bearer. L'agence vient du jeton, jamais
 * du client ; limitation de débit et filtrage des visuels par la base.
 */
export async function POST(request: NextRequest) {
  const parsed = adEventsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "generic" }, 400);
  const device = bearer(request);
  if (!device && !parsed.data.ticketToken) return json({ ok: false, error: "not_allowed" }, 401);
  const admin = getSupabaseAdminClient();
  const { data, error } = device
    ? await admin.rpc("record_display_ad_events", { p_device_token: device, p_events: parsed.data.events })
    : await admin.rpc("record_ticket_ad_events", { p_ticket_token: parsed.data.ticketToken!, p_events: parsed.data.events });
  if (error) {
    const status = error.message === "rate_limited" ? 429 : error.message === "not_found" ? 404 : error.code === "42501" ? 401 : 500;
    return json({ ok: false, error: status === 500 ? "generic" : error.message }, status);
  }
  return json({ ok: true, recorded: data });
}
