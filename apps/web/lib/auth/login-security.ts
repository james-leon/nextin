import "server-only";
import { cookies, headers } from "next/headers";
import { deviceLabel } from "@nextin/shared/security";
import { serverUsesHttps } from "@/lib/auth/session-cookies";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { getSupabaseServerClient } from "@/lib/supabase/server";

/** Identifiant aléatoire du navigateur (alertes « nouvel appareil », S3) : seule son empreinte est enregistrée. */
const DEVICE_COOKIE = "nextin_device";

function randomId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Connexion réussie : appareil enregistré pour le compte ; un administrateur sur un appareil inconnu déclenche une
 * alerte (base). Jamais bloquant : une erreur ici n'empêche pas la connexion.
 */
export async function recordStaffLogin(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>): Promise<void> {
  try {
    const store = await cookies();
    let device = store.get(DEVICE_COOKIE)?.value;
    if (!device || !/^[A-Za-z0-9_-]{16,64}$/.test(device)) {
      device = randomId();
      store.set(DEVICE_COOKIE, device, { path: "/", httpOnly: true, sameSite: "lax", secure: serverUsesHttps(), maxAge: 400 * 24 * 3600 });
    }
    const label = deviceLabel((await headers()).get("user-agent"));
    await supabase.rpc("record_staff_login", { p_device_id: device, p_label: label });
  } catch (e) {
    console.error("[security] record_staff_login", e instanceof Error ? e.message : e);
  }
}

/** Échec de connexion : compté par adresse (empreinte en base) ; alerte au 10e échec en 15 minutes. */
export async function recordLoginFailure(email: string): Promise<void> {
  try {
    await getSupabaseAdminClient().rpc("record_login_failure", { p_email: email });
  } catch (e) {
    console.error("[security] record_login_failure", e instanceof Error ? e.message : e);
  }
}
