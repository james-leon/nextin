"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mapDbError } from "@/lib/admin/db-errors";
import type { ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Poste de test temporaire (M4, remplacé par le poste de l'agent au M5) : appelle les RPC du moteur
 * de file sous l'identité du membre connecté. Les droits sont vérifiés par les RPC (personnel de l'agence).
 */
const commandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.enum(["open", "close", "next"]), counterId: z.uuid() }),
  z.object({ command: z.enum(["admit", "finish", "recall", "no_show"]), ticketId: z.uuid() }),
]);

const RPC = {
  open: "open_counter",
  close: "close_counter",
  next: "call_next",
  admit: "admit_ticket",
  finish: "finish_ticket",
  recall: "recall_ticket",
  no_show: "mark_no_show",
} as const;

export async function testDeskCommand(path: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  if (!/^\/app\/o\/[0-9a-f-]{36}\/branches\/[0-9a-f-]{36}\/test-desk$/.test(path)) return { ok: false, error: "not_allowed" };
  await requireStaffSession(path);
  const parsed = commandSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { ok: false, error: "generic" };
  const v = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { error } =
    "counterId" in v
      ? await supabase.rpc(RPC[v.command], { p_counter: v.counterId })
      : await supabase.rpc(RPC[v.command], { p_ticket: v.ticketId });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(path);
  return { ok: true };
}
