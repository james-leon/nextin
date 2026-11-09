import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, hashIp } from "@/lib/security/ip";

export const noStore = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

/** Empreinte de l'IP (limitation des demandes de code), si le sel est configuré. */
export function requestIpHash(request: NextRequest): string | null {
  const ip = clientIp(request.headers);
  const salt = process.env.IP_HASH_SALT;
  return ip && salt ? hashIp(ip, salt) : null;
}

export function bearer(request: NextRequest): string | null {
  return request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9]{20,100})$/)?.[1] ?? null;
}
