import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CalloutCard } from "@/components/ui/callout-card";

export async function ReadOnlyNotice({ show }: { show: boolean }) {
  if (!show) return null;
  const t = await getTranslations("admin");
  return (
    <CalloutCard tone="accent" icon={<Lock />}>
      {t("readOnly")}
    </CalloutCard>
  );
}
