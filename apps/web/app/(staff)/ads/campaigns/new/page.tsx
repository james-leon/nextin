import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ORG_TYPES } from "@nextin/shared/schemas";
import { AdminPage } from "@/components/admin/admin-page";
import { CampaignWizard } from "@/components/ads/campaign-wizard";
import { getAdvertiserContext } from "@/lib/ads/context";
import { wizardData } from "@/lib/ads/wizard-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("newCampaign") };
}

/** Nouvelle campagne, étape 1 (formule) : la campagne n'existe qu'à « Continuer » (brouillon). */
export default async function NewCampaignPage() {
  const { advertiser, role } = await getAdvertiserContext("/ads/campaigns/new");
  if (!advertiser || role === "cashier") redirect("/ads");
  const t = await getTranslations("ads");
  const data = await wizardData(advertiser, null, undefined);
  if (!data) redirect("/ads/campaigns");
  return (
    <AdminPage title={t("wizard.titles.package")} eyebrow={t("wizard.newTitle")} back={{ href: "/ads/campaigns", label: t("nav.campaigns") }}>
      <CampaignWizard {...data.props} orgTypes={ORG_TYPES} />
    </AdminPage>
  );
}
