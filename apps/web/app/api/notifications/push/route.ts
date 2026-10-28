import { after, type NextRequest } from "next/server";
import { pushSubscribeSchema } from "@nextin/shared/schemas";
import { dispatchNotifications } from "@/lib/notifications/dispatcher";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { json } from "@/lib/tv/http";

/**
 * POST /api/notifications/push — abonnement web push du téléphone au ticket (jeton du lien personnel).
 * La confirmation part aussitôt par la file d'envoi. Limité à 5 abonnements par ticket et par heure.
 */
export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ ok: false, error: "generic" }, 415);
  const parsed = pushSubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "generic" }, 400);
  const { token, subscription, locale } = parsed.data;
  const { error } = await getSupabaseAdminClient().rpc("register_push_contact", {
    p_token: token,
    p_subscription: subscription,
    p_locale: locale,
  });
  if (error) {
    const code = error.message === "not_found" ? 404 : error.message === "rate_limited" ? 429 : 400;
    return json({ ok: false, error: code === 429 ? "rate_limited" : "generic" }, code);
  }
  after(() => dispatchNotifications({ budgetMs: 5_000 }).catch(() => undefined));
  return json({ ok: true }, 201);
}
