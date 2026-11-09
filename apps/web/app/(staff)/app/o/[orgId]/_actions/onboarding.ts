"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Fin de l'assistant de démarrage (§11.3) : progression enregistrée sur l'établissement, retour au tableau de bord. */
export async function finishSetup(orgId: string): Promise<void> {
  if (!z.uuid().safeParse(orgId).success) redirect("/app");
  await requireStaffSession(`/app/o/${orgId}/setup`);
  const supabase = await getSupabaseServerClient();
  await supabase.rpc("set_onboarding_step", { p_org: orgId, p_step: 5 });
  revalidatePath(`/app/o/${orgId}`, "layout");
  redirect(`/app/o/${orgId}`);
}
