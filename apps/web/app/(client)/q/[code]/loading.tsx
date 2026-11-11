import { getTranslations } from "next-intl/server";
import { ListSkeleton } from "@/components/ui/page-skeletons";

/** Squelette pendant le chargement (U1). */
export default async function Loading() {
  const t = await getTranslations("common");
  return <ListSkeleton label={t("loading")} rows={4} />;
}
