"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Vérifie un code TOTP (B5) avec le facteur enregistré du compte : la session passe en aal2 et le jeton porte
 * l'heure du code (`amr`), exigée par la base avant une suppression, un changement de rôle ou un export.
 * Les cookies de session sont mis à jour par le client Supabase : les actions serveur suivantes en profitent.
 */
export async function verifyTotpCode(code: string): Promise<"ok" | "invalid" | "no_factor"> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.find((f) => f.status === "verified");
  if (!factor) return "no_factor";
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
  return error ? "invalid" : "ok";
}
