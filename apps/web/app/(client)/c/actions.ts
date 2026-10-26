"use server";

import { redirect } from "next/navigation";
import { normalizeShortCode } from "@/lib/client/entry-code";

/** Code court saisi → page de choix du service (la validité est vérifiée par /q/<code>). */
export async function goToEntryCode(_prev: { invalid: boolean } | null, data: FormData): Promise<{ invalid: boolean }> {
  const code = normalizeShortCode(String(data.get("code") ?? ""));
  if (!code) return { invalid: true };
  redirect(`/q/${code}`);
}
