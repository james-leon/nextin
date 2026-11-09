import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/notifications/dispatcher";
import { json } from "@/lib/tv/http";

export const maxDuration = 10;

/**
 * POST /api/notifications/dispatch — envoie les messages dus. Appelée par la base (pg_net, à chaque mise en file
 * et chaque minute via pg_cron), avec `Authorization: Bearer <NOTIFY_DISPATCH_SECRET>`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_DISPATCH_SECRET;
  if (!secret || secret.length < 32) return json({ ok: false, error: "not_configured" }, 503);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return json({ ok: false, error: "not_allowed" }, 401);
  const processed = await dispatchNotifications({ budgetMs: 8_000 });
  return json({ ok: true, processed });
}
