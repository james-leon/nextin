import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getOrgContext } from "./context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Agence de l'établissement (RLS : accessible au personnel de l'agence), 404 sinon. */
export const getBranch = cache(async (orgId: string, branchId: string) => {
  const ctx = await getOrgContext(orgId);
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) notFound();
  const supabase = await getSupabaseServerClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, address, city, phone_e164, latitude, longitude, active, timezone")
    .eq("id", branchId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!branch) notFound();
  return { ctx, branch, canManage: ctx.canManageBranch(branchId) };
});
