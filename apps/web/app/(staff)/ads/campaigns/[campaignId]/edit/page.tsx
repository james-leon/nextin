import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { campaignEditable, previousStep, stepNumber } from "@nextin/shared/ads";
import { ORG_TYPES } from "@nextin/shared/schemas";
import { AdminPage } from "@/components/admin/admin-page";
import { CampaignWizard } from "@/components/ads/campaign-wizard";
import { getAdvertiserContext } from "@/lib/ads/context";
import { wizardData } from "@/lib/ads/wizard-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("edit") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Campagne en cours de création ou à corriger (brouillon, refusée) : parcours en cinq étapes, à l'étape demandée
 * (`?step=n`) ou à la première étape incomplète. Retour : l'étape précédente (libellé de l'étape), sinon la campagne.
 */
export default async function EditCampaignPage({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<{ step?: string }> }) {
  const { campaignId } = await params;
  const { step: requested } = await searchParams;
  if (!UUID.test(campaignId)) notFound();
  const { advertiser, role } = await getAdvertiserContext(`/ads/campaigns/${campaignId}/edit`);
  if (!advertiser || role === "cashier") redirect("/ads");
  const data = await wizardData(advertiser, campaignId, requested);
  if (!data) notFound();
  if (!campaignEditable(data.status)) redirect(`/ads/campaigns/${campaignId}`);
  const t = await getTranslations("ads");
  const { step } = data.props;
  const prev = previousStep(step);
  return (
    <AdminPage
      title={t(`wizard.titles.${step}`)}
      eyebrow={data.campaignName ?? t("wizard.newTitle")}
      back={
        prev
          ? { href: `/ads/campaigns/${campaignId}/edit?step=${stepNumber(prev)}`, label: t(`wizard.steps.${prev}`) }
          : { href: `/ads/campaigns/${campaignId}`, label: data.campaignName ?? t("nav.campaigns") }
      }
    >
      <CampaignWizard key={step} {...data.props} orgTypes={ORG_TYPES} />
    </AdminPage>
  );
}
