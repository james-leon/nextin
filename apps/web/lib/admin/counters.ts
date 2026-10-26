import "server-only";
import { COUNTER_KINDS, nextCounterNumber, type CounterKind } from "@nextin/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Données nécessaires au formulaire de guichet : services, praticiens de l'agence et numéros libres. */
export async function counterFormData(branchId: string, excludeCounterId?: string) {
  const supabase = await getSupabaseServerClient();
  const [{ data: services }, { data: practitioners }, { data: counters }] = await Promise.all([
    supabase.from("services").select("id, name, prefix, color").eq("branch_id", branchId).order("sort_order").order("prefix"),
    supabase.from("practitioners").select("id, title, display_name").eq("branch_id", branchId).eq("active", true).order("display_name"),
    supabase.from("counters").select("id, kind, number").eq("branch_id", branchId),
  ]);
  const others = (counters ?? []).filter((c) => c.id !== excludeCounterId);
  const nextNumbers = Object.fromEntries(COUNTER_KINDS.map((k) => [k, nextCounterNumber(others, k)])) as Record<CounterKind, number>;
  return {
    services: services ?? [],
    practitioners: (practitioners ?? []).map((p) => ({ id: p.id, name: [p.title, p.display_name].filter(Boolean).join(" ") })),
    nextNumbers,
  };
}
