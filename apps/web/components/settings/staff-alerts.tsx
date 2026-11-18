"use client";

import { useTranslations } from "next-intl";
import { LifeBuoy } from "lucide-react";
import { ListIcon, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { setAlertEnabled, useAlertEnabled } from "@/lib/desk/notification-prefs";

/** Notifications propres à cet appareil (maquette v2 07) : demande d'aide d'un patient, son et vibration à l'accueil. */
export function StaffAlerts() {
  const t = useTranslations("settings");
  const help = useAlertEnabled("help");
  return (
    <ListSection header={t("onThisDevice")} footer={t("notificationsFooter")}>
      <ListSwitchRow
        icon={
          <ListIcon color="var(--orange-fill)">
            <LifeBuoy />
          </ListIcon>
        }
        title={t("helpAlert")}
        subtitle={t("helpAlertHint")}
        checked={help}
        onCheckedChange={(on) => setAlertEnabled("help", on)}
      />
    </ListSection>
  );
}
