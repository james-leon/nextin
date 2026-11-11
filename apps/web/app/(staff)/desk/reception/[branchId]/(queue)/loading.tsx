import { getTranslations } from "next-intl/server";
import { ReceptionSkeleton } from "@/components/ui/page-skeletons";

/** Squelette pendant le chargement (U1). */
export default async function Loading() {
  const t = await getTranslations("common");
  return <ReceptionSkeleton label={t("loading")} />;
}
