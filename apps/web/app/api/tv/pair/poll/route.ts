import type { NextRequest } from "next/server";
import { z } from "zod";
import { json } from "@/lib/tv/http";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ displayId: z.uuid(), pollSecret: z.string().regex(/^[A-Za-z0-9]{32}$/) });

/** POST /api/tv/pair/poll — l'écran en attente vérifie s'il a été appairé ; reçoit alors son jeton (une fois). */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "generic" }, 400);
  const { data, error } = await getSupabaseAdminClient().rpc("tv_poll_pairing", {
    p_display: parsed.data.displayId,
    p_poll_secret: parsed.data.pollSecret,
  });
  if (error) return json({ ok: false, error: "generic" }, 500);
  const r = data as { status: "pending" | "expired" | "active" | "unknown"; device_token?: string };
  return json({ ok: true, status: r.status, deviceToken: r.device_token ?? null });
}
