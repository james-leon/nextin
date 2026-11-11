import { getTranslations } from "next-intl/server";
import { DeskSkeleton } from "@/components/ui/page-skeletons";

/** Squelette pendant le chargement (U1). */
export default async function Loading() {
  const t = await getTranslations("common");
  return <DeskSkeleton label={t("loading")} />;
}
