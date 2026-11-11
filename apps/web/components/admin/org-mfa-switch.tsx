"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { useMfaStepUp } from "@/components/security/use-mfa-step-up";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/auth/errors";

/**
 * Réglage de l'établissement (B5) : double authentification pour tout le personnel. Modifiable avec une session
 * aal2 seulement (code demandé si besoin) ; les administrateurs l'utilisent toujours quand la plateforme l'exige.
 */
export function OrgMfaSwitch({ initial, action }: { initial: boolean; action: (enabled: boolean) => Promise<ActionResult> }) {
  const t = useTranslations("mfa");
  const te = useTranslations("errors");
  const toast = useToast();
  const stepUp = useMfaStepUp();
  // Valeur enregistrée, et valeur affichée tout de suite (optimiste) : elle revient d'elle-même en cas de refus.
  const [enabled, setEnabled] = useState(initial);
  const [shown, show] = useOptimistic(enabled);
  const [pending, start] = useTransition();
  const change = (next: boolean) =>
    start(async () => {
      show(next);
      const result = await stepUp.run(() => action(next));
      if (result.ok) {
        setEnabled(next);
        toast(t("saved"));
      } else toast(te(result.error), <AlertCircle aria-hidden />);
    });
  return (
    <>
      {stepUp.dialog}
      <ListSection footer={t("orgAllFooter")}>
        <ListSwitchRow title={t("orgAll")} checked={shown} onCheckedChange={change} disabled={pending} />
      </ListSection>
    </>
  );
}
