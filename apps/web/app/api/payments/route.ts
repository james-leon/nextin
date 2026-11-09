import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/security/ip";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { startPayment } from "@/lib/payments/service";

/**
 * POST /api/payments — paiement d'une facture depuis `/pay/<jeton>` (sans compte : le payeur peut être le comptable).
 * Corps JSON { token, channel, msisdn, captchaToken } → { ok, externalId, redirectUrl } ou { ok: false, error }.
 */
export async function POST(request: NextRequest) {
  // JSON uniquement (anti-CSRF : un formulaire d'un autre site ne peut pas l'envoyer sans requête préalable).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 415 });
  }
  const body = (await request.json().catch(() => null)) as { captchaToken?: string } | null;
  const captcha = await verifyCaptchaToken(body?.captchaToken, {
    remoteIp: clientIp(request.headers) ?? undefined,
    expectedAction: "pay_invoice",
  });
  if (!captcha.ok) return NextResponse.json({ ok: false, error: "captcha_failed" }, { status: 403 });
  const result = await startPayment(body);
  const headers = { "Cache-Control": "no-store" };
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers });
  return NextResponse.json(result, { status: 201, headers });
}
