"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { billingCheckoutSchema } from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import type { ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Payer, renouveler ou changer de formule (administrateur de l'établissement, droits vérifiés par la base) :
 * facture de la formule et de la période choisies, puis page de paiement `/pay/<jeton>`. Une descente de formule
 * pendant une période payée est programmée pour l'échéance, sans facture.
 */
export async function checkout(orgId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  if (!z.uuid().safeParse(orgId).success) redirect("/app");
  await requireStaffSession(`/app/o/${orgId}/billing`);
  const parsed = billingCheckoutSchema.safeParse({ planId: data.get("planId"), period: data.get("period") });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await getSupabaseServerClient();
  const { data: result, error } = await supabase.rpc("billing_checkout", {
    p_org: orgId,
    p_plan: parsed.data.planId,
    p_period: parsed.data.period,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/app/o/${orgId}/billing`);
  const r = result as { scheduled?: boolean; pay_token?: string };
  if (r.scheduled) redirect(`/app/o/${orgId}/billing?scheduled=1`);
  redirect(`/pay/${r.pay_token}`);
}
