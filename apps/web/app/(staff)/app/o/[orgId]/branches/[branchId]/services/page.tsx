import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Stethoscope } from "lucide-react";
import { SplitPlaceholder } from "@/components/admin/split-pane";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("title") };
}

/** Panneau de détail sans service choisi (tablette et ordinateur). La liste est dans le gabarit. */
export default async function ServicesPage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  await getBranch(orgId, branchId);
  const t = await getTranslations("services");
  const supabase = await getSupabaseServerClient();
  const { data: services } = await supabase.from("services").select("active, default_service_seconds").eq("branch_id", branchId);
  const all = services ?? [];
  const minutes = all.length ? Math.round(all.reduce((sum, s) => sum + s.default_service_seconds, 0) / all.length / 60) : 0;
  return (
    <SplitPlaceholder
      icon={<Stethoscope />}
      title={t("pickTitle")}
      text={t("pickText")}
      stats={[
        { label: t("statTotal"), value: all.length },
        { label: t("statActive"), value: all.filter((s) => s.active).length },
        { label: t("statMinutes"), value: t("minutesShort", { count: minutes }) },
      ]}
    />
  );
}
