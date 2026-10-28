import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { PlatformNav } from "@/components/platform/platform-sidebar";
import { SettingsForm, type PlatformSettingsValues } from "@/components/platform/settings-form";
import { CalloutCard } from "@/components/ui/callout-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("settingsTitle") };
}

/** Réglages de la plateforme : mentions légales (factures) et durées du cycle de vie des abonnements. */
export default async function PlatformSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { saved } = await searchParams;
  const t = await getTranslations("platform");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("platform_settings").select("*").single();
  const values = data as unknown as PlatformSettingsValues;
  const missing = !values.company_legal_name || !values.company_rc || !values.company_niu;
  return (
    <AdminPage title={t("settingsTitle")} eyebrow={t("title")}>
      <PlatformNav variant="inline" />
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {ta("saved")}
        </CalloutCard>
      ) : null}
      {missing ? (
        <CalloutCard tone="orange" icon={<AlertTriangle />}>
          {t("legalMissing")}
        </CalloutCard>
      ) : null}
      <SettingsForm values={values} />
    </AdminPage>
  );
}
