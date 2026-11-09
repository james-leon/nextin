import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { queueErrorCode, queueErrorStatus } from "@nextin/shared/queue";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { clientIp } from "@/lib/security/ip";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9]{22}$/), captchaToken: z.string().max(2048).optional() });

/** POST /api/appointment-requests/resend — nouveau code de vérification (3 au plus par demande, captcha). */
export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 415 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "not_found" }, { status: 400 });
  const ip = clientIp(request.headers);
  const captcha = await verifyCaptchaToken(parsed.data.captchaToken, { remoteIp: ip ?? undefined, expectedAction: "request_code" });
  if (!captcha.ok) return NextResponse.json({ ok: false, error: "captcha_failed" }, { status: 400 });
  const { error } = await getSupabaseAdminClient().rpc("resend_request_code", { p_token: parsed.data.token });
  if (error) {
    const code = queueErrorCode(error);
    return NextResponse.json({ ok: false, error: code ?? "generic" }, { status: code ? queueErrorStatus(code) : 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
