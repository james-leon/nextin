import "server-only";
import type { OrgContext } from "./context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Agences que le membre peut gérer (toutes pour l'org_admin). */
export async function manageableBranches(ctx: OrgContext) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("branches").select("id, name").eq("organization_id", ctx.org.id).order("sort_order");
  return (data ?? []).filter((b) => ctx.canManageBranch(b.id));
}
