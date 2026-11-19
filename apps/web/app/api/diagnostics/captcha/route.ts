import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deviceFamily } from "@/lib/diagnostics/client-log";

const reportSchema = z
  .object({
    action: z.string().regex(/^[a-z_]{1,32}$/),
    code: z.string().regex(/^[A-Za-z0-9_.-]{1,40}$/),
  })
  .strict();

/**
 * POST /api/diagnostics/captcha — échec du captcha Turnstile dans le navigateur (code Cloudflare, ex. 110200 =
 * domaine non autorisé pour la clé du site). Écrit une ligne dans les journaux du serveur, sans donnée personnelle
 * (ni IP, ni jeton, ni User-Agent complet) ; aucune donnée enregistrée en base. Toujours 204.
 */
export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (text.length > 300) return new NextResponse(null, { status: 204 });
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = reportSchema.safeParse(payload);
  if (parsed.success) {
    console.warn(
      "[captcha] échec navigateur",
      JSON.stringify({ ...parsed.data, host: request.headers.get("host"), device: deviceFamily(request.headers.get("user-agent")) }),
    );
  }
  return new NextResponse(null, { status: 204 });
}
