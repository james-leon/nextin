import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@nextin/shared/database";
import { publicEnv } from "@/lib/env";

/**
 * Client Supabase du proxy : rafraîchit la session et reporte les cookies mis à jour sur la réponse.
 * `response()` renvoie toujours la dernière réponse (les cookies peuvent changer après un signOut).
 */
export function proxyClient(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  return { supabase, response: () => response };
}

/** Copie les cookies de session (mis à jour ou effacés) sur une redirection. */
export function withCookies(target: NextResponse, from: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) target.cookies.set(cookie);
  return target;
}
