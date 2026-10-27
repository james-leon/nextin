import type { NextRequest } from "next/server";
import { qrEntryUrl } from "@nextin/shared";
import { bearer, json } from "@/lib/tv/http";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/tv/session — configuration de l'écran appairé (jeton d'appareil en Bearer).
 * Appelée au démarrage puis chaque minute : un écran révoqué reçoit 401 et revient à l'appairage.
 */
export async function GET(request: NextRequest) {
  const token = bearer(request);
  if (!token) return json({ ok: false, error: "not_allowed" }, 401);
  const { data, error } = await getSupabaseAdminClient().rpc("tv_session", {
    p_device_token: token,
    p_app_version: request.headers.get("x-app-version")?.slice(0, 40) ?? (null as unknown as string),
  });
  if (error) return json({ ok: false, error: "generic" }, 500);
  if (!data) return json({ ok: false, error: "not_allowed" }, 401);
  const session = data as { entry: { token: string; short_code: string } | null };
  return json({ ok: true, session: { ...session, entry_url: session.entry ? qrEntryUrl(session.entry.token) : null } });
}
