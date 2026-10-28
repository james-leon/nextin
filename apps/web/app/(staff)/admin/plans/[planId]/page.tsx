import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { PlanForm, type PlanFormValues } from "@/components/platform/plan-form";
import { CalloutCard } from "@/components/ui/callout-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("planEdit") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlanEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { planId } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(planId)) notFound();
  const t = await getTranslations("platform");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data: plan } = await supabase
    .from("plans")
    .select(
      "id, name, name_en, description, base_price_xaf, included_branches, extra_branch_price_xaf, max_counters_per_branch, max_displays_per_branch, whatsapp_quota_per_branch, annual_free_months, features, active",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!plan) notFound();
  return (
    <AdminPage title={plan.name} eyebrow={t("planEdit")} back={{ href: "/admin/plans", label: t("plansTitle") }}>
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {ta("saved")}
        </CalloutCard>
      ) : null}
      <PlanForm plan={plan as unknown as PlanFormValues} />
    </AdminPage>
  );
}
