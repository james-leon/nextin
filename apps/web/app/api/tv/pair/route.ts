import type { NextRequest } from "next/server";
import { json, requestIpHash } from "@/lib/tv/http";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** POST /api/tv/pair — un écran non appairé demande un code à 6 chiffres (valable 10 min). */
export async function POST(request: NextRequest) {
  const { data, error } = await getSupabaseAdminClient().rpc("tv_create_pairing", { p_ip_hash: requestIpHash(request) as string });
  if (error) return json({ ok: false, error: error.message === "rate_limited" ? "rate_limited" : "generic" }, error.message === "rate_limited" ? 429 : 500);
  const r = data as { display_id: string; code: string; poll_secret: string; expires_at: string };
  return json({ ok: true, displayId: r.display_id, code: r.code, pollSecret: r.poll_secret, expiresAt: r.expires_at }, 201);
}
