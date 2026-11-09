import type { IdentityRules } from "@nextin/shared/identity";
import { callRpc } from "./supabase-public";

/** Règles d'identité d'une agence (nom non demandé, facultatif ou obligatoire) ; « non demandé » si illisibles. */
export async function fetchIdentityRules(branchId: string): Promise<IdentityRules> {
  const { data } = await callRpc<IdentityRules | null>("customer_identity_rules", { p_branch: branchId });
  return data ?? { mode: "off", extra: "none" };
}
