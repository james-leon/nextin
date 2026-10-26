import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@nextin/shared/database";
import { captchaConfig, verifyCaptchaToken } from "@/lib/security/captcha";
import { clientIp, hashIp } from "@/lib/security/ip";
import { handleTakeTicket } from "@/lib/queue/take-ticket";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type PriorityReason = Database["public"]["Enums"]["priority_reason"];

/**
 * POST /api/tickets — prise de ticket d'un client (session anonyme créée au préalable par la page).
 * Réponses : 201 { ok, ticket } ; erreur { ok: false, error } (+ ticketUrl si un ticket est déjà actif).
 */
export async function POST(request: NextRequest) {
  // JSON uniquement : un formulaire d'un autre site ne peut pas l'envoyer sans requête CORS préalable (anti-CSRF).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 415 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 400 });
  }

  const salt = process.env.IP_HASH_SALT;
  // Déploiement public (captcha actif) : la limitation par IP est obligatoire.
  if (!salt && captchaConfig().enabled) throw new Error("IP_HASH_SALT is required in production");
  const ip = clientIp(request.headers);
  const ipHash = ip && salt ? hashIp(ip, salt) : null;

  const admin = getSupabaseAdminClient();
  // Session par cookie (PWA) ou jeton Bearer (application native, M11).
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const {
    data: { user },
  } = bearer ? await admin.auth.getUser(bearer) : await (await getSupabaseServerClient()).auth.getUser();

  const result = await handleTakeTicket(payload, {
    userId: user?.id ?? null,
    ipHash,
    verifyCaptcha: (token) => verifyCaptchaToken(token, { remoteIp: ip ?? undefined, expectedAction: "take_ticket" }),
    throttle: async (userId, hash) => {
      const { data, error } = await admin.rpc("throttle_ticket_request", { p_customer: userId, p_ip_hash: hash as string });
      return !error && data === true;
    },
    take: async (userId, input) =>
      admin.rpc("take_ticket", {
        p_service: input.serviceId,
        p_source: input.source,
        p_entry_code: (input.entryCode ?? null) as string,
        p_priority_reason: (input.priorityReason ?? null) as PriorityReason,
        p_customer: userId,
      }),
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
