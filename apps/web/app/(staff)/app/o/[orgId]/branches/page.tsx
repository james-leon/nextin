import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { SplitPlaceholder } from "@/components/admin/split-pane";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("branches");
  return { title: t("title") };
}

/** Panneau de détail sans agence choisie (tablette et ordinateur) : résumé de l'établissement. La liste est dans le gabarit. */
export default async function BranchesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const t = await getTranslations("branches");
  const supabase = await getSupabaseServerClient();
  const [branches, services, counters] = await Promise.all([
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("counters").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);
  return (
    <SplitPlaceholder
      icon={<Building2 />}
      title={t("pickTitle")}
      text={t("pickText")}
      stats={[
        { label: t("statBranches"), value: branches.count ?? 0 },
        { label: t("statServices"), value: services.count ?? 0 },
        { label: t("statCounters"), value: counters.count ?? 0 },
      ]}
    />
  );
}
