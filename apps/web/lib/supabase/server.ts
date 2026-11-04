import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@nextin/shared/database";
import { publicEnv } from "@/lib/env";
import { SESSION_ONLY_COOKIE, sessionOnly } from "@/lib/auth/session-cookies";

/** Client lié à la session de l'utilisateur (cookies) — soumis aux politiques RLS. */
export async function getSupabaseServerClient(options: { sessionOnly?: boolean } = {}) {
  const env = publicEnv();
  const cookieStore = await cookies();
  // Session limitée au navigateur (« Se souvenir de moi » décoché à la connexion).
  const browserSession = options.sessionOnly ?? cookieStore.has(SESSION_ONLY_COOKIE);
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, sessionOnly(options, browserSession));
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}
