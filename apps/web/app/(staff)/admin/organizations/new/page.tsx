import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { NewOrganizationForm } from "@/components/platform/new-organization-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.newOrg");
  return { title: t("title") };
}

/** P1 — console Wintek : création d'un établissement pour un client (formule, essai, responsable, services). */
export default async function NewOrganizationPage() {
  const t = await getTranslations("platform");
  const locale = await getLocale();
  const supabase = await getSupabaseServerClient();
  const [{ data: plans }, { data: settings }] = await Promise.all([
    supabase.from("plans").select("id, name, name_en, trial_eligible").eq("active", true).order("sort_order"),
    supabase.from("platform_settings").select("trial_days").maybeSingle(),
  ]);
  if (!plans?.length) notFound();
  const options = plans.map((p) => ({ id: p.id, name: (locale === "en" && p.name_en) || p.name }));
  const defaultPlan = plans.find((p) => p.trial_eligible) ?? plans[0]!;
  return (
    <AdminPage narrow title={t("newOrg.title")} eyebrow={t("newOrg.eyebrow")} back={{ href: "/admin", label: t("nav.subscriptions") }}>
      <p className="px-4 text-body text-label-secondary">{t("newOrg.intro")}</p>
      <NewOrganizationForm plans={options} defaultPlanId={defaultPlan.id} defaultTrialDays={settings?.trial_days ?? 30} />
    </AdminPage>
  );
}
