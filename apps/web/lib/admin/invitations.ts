import "server-only";
import { z } from "zod";
import type { InvitationRole } from "@nextin/shared/notifications";
import type { ActionResult } from "@/lib/auth/errors";
import { sendInvitationEmail } from "@/lib/notifications/invitation";
import type { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "./db-errors";

export type ResendResult = ActionResult<{ mailSent: boolean; email: string; link: string | null }>;

/**
 * Renvoi d'une invitation en attente (P2) : la base émet un nouveau jeton (droits, limite, journal), l'e-mail part
 * aussitôt. Le lien n'est renvoyé à l'écran que si l'envoi échoue (l'ancien ne fonctionne plus).
 */
export async function resendInvitationWith(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  invitationId: string,
  byWintek = false,
): Promise<ResendResult> {
  if (!z.uuid().safeParse(invitationId).success) return { ok: false, error: "not_found" };
  const { data, error } = await supabase.rpc("reissue_invitation", { p_invitation: invitationId });
  if (error || !data) return { ok: false, error: mapDbError(error) };
  const r = data as { token: string; email: string; role: InvitationRole; organization: string; locale: string };
  const { mailSent, link } = await sendInvitationEmail({ to: r.email, token: r.token, organization: r.organization, role: r.role, locale: r.locale, byWintek });
  return { ok: true, mailSent, email: r.email, link: mailSent ? null : link };
}
