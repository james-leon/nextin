"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ENTITLEMENT_LIMITS, type EntitlementLimit } from "@nextin/shared/billing";
import { setLimits } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

const LABELS: Record<EntitlementLimit, string> = {
  included_branches: "includedBranches",
  max_services: "maxServices",
  max_counters: "maxCounters",
  max_displays: "maxDisplays",
  max_users: "maxUsers",
  tickets_per_month: "ticketsPerMonth",
  whatsapp_quota: "whatsappQuota",
  history_months: "historyMonths",
};

/**
 * Limites sur mesure d'un client (formule sur devis) : chaque champ vide reprend la valeur de la formule, « illimité »
 * lève la limite. Motif obligatoire, journalisé par la base.
 */
export function LimitsForm({
  subscriptionId,
  overrides,
  plan,
}: {
  subscriptionId: string;
  overrides: Partial<Record<EntitlementLimit, number | null>>;
  plan: Partial<Record<EntitlementLimit, number | null>>;
}) {
  const t = useTranslations("platform");
  const tb = useTranslations("billing");
  const ta = useTranslations("admin");
  const [state, action, pending] = useActionState(setLimits, null);
  const { field, top } = useFormErrors(state);
  const shown = (v: number | null | undefined) => (v === null ? tb("unlimited").toLowerCase() : v === undefined ? "" : String(v));
  return (
    <form action={action} noValidate aria-labelledby="limits-title" className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <h2 id="limits-title" className="text-headline">
        {t("limitsTitle")}
      </h2>
      <p className="-mt-2 text-footnote text-label-secondary">{t("limitsFooter")}</p>
      <FormError message={top} />
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 md:grid-cols-2">
        {ENTITLEMENT_LIMITS.map((k) => (
          <TextField
            key={k}
            name={k}
            label={t(`planFields.${LABELS[k]}` as Parameters<typeof t>[0])}
            defaultValue={k in overrides ? shown(overrides[k]) : ""}
            placeholder={t("limitsPlaceholder", { value: shown(plan[k]) || tb("unlimited").toLowerCase() })}
            error={field(k)}
          />
        ))}
      </div>
      <TextField name="reason" label={t("reason")} hint={t("reasonHint")} maxLength={200} required error={field("reason")} />
      <Button type="submit" variant="tinted" loading={pending} loadingLabel={ta("saving")} className="self-start">
        {t("limitsSave")}
      </Button>
    </form>
  );
}
