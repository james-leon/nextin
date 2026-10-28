import { NextResponse, type NextRequest } from "next/server";
import { captchaConfig, verifyCaptchaToken } from "@/lib/security/captcha";
import { clientIp, hashIp } from "@/lib/security/ip";
import { handleCreateRequest } from "@/lib/requests/create";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/appointment-requests — demande de rendez-vous d'un patient (session anonyme créée par la page).
 * Réponses : 201 { ok, token } ; erreur { ok: false, error }.
 */
export async function POST(request: NextRequest) {
  // JSON uniquement (anti-CSRF : un formulaire d'un autre site ne peut pas l'envoyer sans requête préalable).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 415 });
  }
  const payload: unknown = await request.json().catch(() => null);
  const salt = process.env.IP_HASH_SALT;
  if (!salt && captchaConfig().enabled) throw new Error("IP_HASH_SALT is required in production");
  const ip = clientIp(request.headers);
  const ipHash = ip && salt ? hashIp(ip, salt) : null;

  const admin = getSupabaseAdminClient();
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const {
    data: { user },
  } = bearer ? await admin.auth.getUser(bearer) : await (await getSupabaseServerClient()).auth.getUser();

  const result = await handleCreateRequest(payload, {
    userId: user?.id ?? null,
    ipHash,
    verifyCaptcha: (token) => verifyCaptchaToken(token, { remoteIp: ip ?? undefined, expectedAction: "appointment_request" }),
    throttle: async (userId, hash) => {
      const { data, error } = await admin.rpc("throttle_appointment_request", { p_customer: userId, p_ip_hash: hash as string });
      return !error && data === true;
    },
    create: (userId, input) =>
      admin.rpc("create_appointment_request", {
        p_branch: input.branchId,
        p_service: input.serviceId,
        p_practitioner: (input.practitionerId ?? null) as string,
        p_starts_at: (input.startsAt ?? null) as string,
        p_day: (input.day ?? null) as string,
        p_period: (input.period ?? null) as string,
        p_phone_e164: input.phone,
        p_label: (input.label ?? null) as string,
        p_locale: input.locale,
        p_customer: userId,
      }),
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
