import { after, type NextRequest } from "next/server";
import { whatsappWebhookSchema } from "@nextin/shared/schemas";
import { REPLIES, parseInbound, type NotifLocale } from "@nextin/shared/notifications";
import { dispatchNotifications } from "@/lib/notifications/dispatcher";
import { getProviders } from "@/lib/notifications/providers";
import { verifyMetaSignature } from "@/lib/notifications/signature";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { json } from "@/lib/tv/http";

/**
 * Webhook WhatsApp Cloud API (§5.5).
 * GET : vérification de l'abonnement par Meta (WHATSAPP_VERIFY_TOKEN).
 * POST : messages entrants (opt-in « NEXTIN C-047 7K3Q », STOP, START) et statuts de remise ; signature
 * X-Hub-Signature-256 vérifiée avec WHATSAPP_APP_SECRET, chaque événement traité une seule fois.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return json({ ok: false, error: "not_configured" }, 503);
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return json({ ok: false, error: "invalid_signature" }, 401);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  const parsed = whatsappWebhookSchema.safeParse(body);
  // Autres objets ou champs (modèles, qualité du numéro…) : accusés de réception sans traitement.
  if (!parsed.success) return json({ ok: true, ignored: true });

  const admin = getSupabaseAdminClient();
  const providers = getProviders();
  const firstTime = async (eventId: string, payload: unknown) => {
    const { data, error } = await admin.rpc("record_webhook_event", { p_provider: "whatsapp", p_event_id: eventId, p_payload: payload as never });
    if (error) throw new Error(error.message);
    return data === true;
  };
  const reply = (waId: string, text: string) =>
    providers.whatsapp.sendText(`+${waId}`, text).catch(() => ({ ok: false as const, retryable: false, error: "reply_failed" }));

  for (const change of parsed.data.entry.flatMap((e) => e.changes)) {
    if (change.field !== "messages") continue;
    for (const message of change.value.messages ?? []) {
      if (!(await firstTime(`message:${message.id}`, message))) continue;
      const waId = message.from;
      await admin.rpc("whatsapp_touch", { p_wa_id: waId });
      const inbound = parseInbound(message.text?.body ?? message.button?.text ?? "");
      if (inbound.kind === "opt_in") {
        const { data } = await admin.rpc("whatsapp_opt_in", {
          p_wa_id: waId,
          p_code: inbound.code,
          p_suffix: inbound.suffix,
          p_locale: inbound.locale,
        });
        // Lié : la confirmation part par la file d'envoi (déclencheur du contact).
        if ((data as { status?: string } | null)?.status === "not_found") await reply(waId, REPLIES[inbound.locale].notFound);
      } else if (inbound.kind === "stop" || inbound.kind === "start") {
        await admin.rpc("whatsapp_set_opt_out", { p_wa_id: waId, p_opted_out: inbound.kind === "stop" });
        await reply(waId, REPLIES.fr[inbound.kind === "stop" ? "stopped" : "restarted"]);
      } else if (await firstTime(`help:${waId}:${new Date().toISOString().slice(0, 10)}`, { wa_id: waId })) {
        // Autre message : aide, une fois par jour et par numéro au plus.
        const locale: NotifLocale = /\b(hello|hi|please|thanks)\b/i.test(message.text?.body ?? "") ? "en" : "fr";
        await reply(waId, REPLIES[locale].help);
      }
    }
    for (const status of change.value.statuses ?? []) {
      if (!(await firstTime(`status:${status.id}:${status.status}`, status))) continue;
      const error = status.errors?.[0];
      await admin.rpc("whatsapp_message_status", {
        p_message_id: status.id,
        p_status: status.status,
        p_error: (error ? `${error.code ?? ""} ${error.title ?? ""}`.trim() : null) as string,
      });
    }
  }
  // Confirmation d'opt-in et SMS de secours : envoyés juste après la réponse à Meta.
  after(() => dispatchNotifications({ budgetMs: 5_000 }).catch(() => undefined));
  return json({ ok: true });
}
