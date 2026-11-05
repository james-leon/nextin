"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@nextin/shared/database";
import { publicEnv } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/auth/session-cookies";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const env = publicEnv();
    browserClient = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      // Aussi appelé pendant le rendu serveur des écrans du personnel : pas de `window` à ce moment-là.
      cookieOptions: sessionCookieOptions(typeof window !== "undefined" && window.location.protocol === "https:"),
    });
  }
  return browserClient;
}
