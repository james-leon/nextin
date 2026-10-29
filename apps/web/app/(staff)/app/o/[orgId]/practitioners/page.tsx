import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Stethoscope } from "lucide-react";
import { SplitPlaceholder } from "@/components/admin/split-pane";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practitioners");
  return { title: t("title") };
}

/** Panneau de détail sans praticien choisi (tablette et ordinateur). La liste et les spécialités sont dans le gabarit. */
export default async function PractitionersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  await getOrgContext(orgId);
  const t = await getTranslations("practitioners");
  const supabase = await getSupabaseServerClient();
  const [specialties, { data: practitioners }] = await Promise.all([
    listSpecialties(orgId),
    supabase.from("practitioners").select("active").eq("organization_id", orgId),
  ]);
  const all = practitioners ?? [];
  return (
    <SplitPlaceholder
      icon={<Stethoscope />}
      title={t("pickTitle")}
      text={t("pickText")}
      stats={[
        { label: t("statTotal"), value: all.length },
        { label: t("statActive"), value: all.filter((p) => p.active).length },
        { label: t("statSpecialties"), value: specialties.length },
      ]}
    />
  );
}
