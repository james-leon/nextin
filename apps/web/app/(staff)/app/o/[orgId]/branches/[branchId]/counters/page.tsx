import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DoorOpen } from "lucide-react";
import { SplitPlaceholder } from "@/components/admin/split-pane";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("counters");
  return { title: t("title") };
}

/** Panneau de détail sans poste choisi (tablette et ordinateur). La liste est dans le gabarit. */
export default async function CountersPage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  await getBranch(orgId, branchId);
  const t = await getTranslations("counters");
  const supabase = await getSupabaseServerClient();
  const { data: counters } = await supabase.from("counters").select("active, practitioner:practitioners(id)").eq("branch_id", branchId);
  const all = counters ?? [];
  return (
    <SplitPlaceholder
      icon={<DoorOpen />}
      title={t("pickTitle")}
      text={t("pickText")}
      stats={[
        { label: t("statTotal"), value: all.length },
        { label: t("statActive"), value: all.filter((c) => c.active).length },
        { label: t("statWithPractitioner"), value: all.filter((c) => c.practitioner).length },
      ]}
    />
  );
}
