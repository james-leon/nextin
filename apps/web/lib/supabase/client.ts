"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@nextin/shared/database";
import { publicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const env = publicEnv();
    browserClient = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return browserClient;
}
