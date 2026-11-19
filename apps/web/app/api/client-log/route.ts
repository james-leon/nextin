import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_LOG_MAX_BYTES, clientLogLine, clientLogSchema, createClientLogLimiter, deviceFamily } from "@/lib/diagnostics/client-log";

const allow = createClientLogLimiter();

/** Empreinte de l'adresse IP (jamais l'adresse elle-même), le temps de la fenêtre de la limite. */
function ipKey(request: NextRequest): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("base64url").slice(0, 16);
}

/**
 * POST /api/client-log — erreur du navigateur (JavaScript, promesse rejetée) ou navigation en échec du service worker
 * (LOT 5a E, diagnostic de l'écran blanc sur iPhone). Une ligne `[client-log]` dans les journaux du serveur (Vercel →
 * Logs), sans donnée personnelle (`lib/diagnostics/client-log.ts`) ; rien en base. Corps de 2 Ko au plus, dix messages
 * par minute et par adresse. Toujours 204 (le navigateur n'attend rien).
 */
export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > CLIENT_LOG_MAX_BYTES) return new NextResponse(null, { status: 204 });
  const text = await request.text().catch(() => "");
  if (!text || text.length > CLIENT_LOG_MAX_BYTES || !allow(ipKey(request))) return new NextResponse(null, { status: 204 });
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = clientLogSchema.safeParse(payload);
  if (parsed.success) {
    console.warn("[client-log]", JSON.stringify(clientLogLine(parsed.data, deviceFamily(request.headers.get("user-agent")))));
  }
  return new NextResponse(null, { status: 204 });
}
