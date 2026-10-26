import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function listSpecialties(orgId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("specialties").select("id, name, name_en, active").eq("organization_id", orgId).order("name");
  return data ?? [];
}
