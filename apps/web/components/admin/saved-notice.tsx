import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CalloutCard } from "@/components/ui/callout-card";

/** Bandeau « Modifications enregistrées » après une redirection `?saved=1`. */
export async function SavedNotice({ show, message }: { show: boolean; message?: string }) {
  if (!show) return null;
  const t = await getTranslations("admin");
  return (
    <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
      {message ?? t("saved")}
    </CalloutCard>
  );
}
