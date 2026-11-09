"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/auth/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const tokenSchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);

export async function acceptInvitation(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const token = tokenSchema.safeParse(data.get("token"));
  if (!token.success) return { ok: false, error: "invitation_invalid" };
  const supabase = await getSupabaseServerClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error) {
    if (error.code === "42501" && /another address/i.test(error.message)) return { ok: false, error: "invitation_other_email" };
    if (error.code === "42501") redirect(`/login?next=${encodeURIComponent(`/invite/${token.data}`)}`);
    return { ok: false, error: "invitation_invalid" };
  }
  redirect(`/app?joined=${orgId}`);
}
