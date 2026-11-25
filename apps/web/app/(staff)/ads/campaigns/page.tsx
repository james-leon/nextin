import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Megaphone } from "lucide-react";
import { SplitPlaceholder } from "@/components/admin/split-pane";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("nav.campaigns") };
}

/** Panneau de détail sans campagne choisie (tablette et ordinateur) ; la liste est dans le gabarit. */
export default async function CampaignsPage() {
  const t = await getTranslations("ads");
  return <SplitPlaceholder icon={<Megaphone />} title={t("pickTitle")} text={t("pickText")} />;
}
