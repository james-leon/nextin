"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { PLAN_FEATURES, type PlanFeature } from "@nextin/shared/billing";
import { updatePlan } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { TextField } from "@/components/ui/text-field";

export type PlanFormValues = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  base_price_xaf: number;
  included_branches: number;
  extra_branch_price_xaf: number | null;
  max_counters_per_branch: number | null;
  max_displays_per_branch: number | null;
  whatsapp_quota_per_branch: number;
  annual_free_months: number;
  features: Partial<Record<PlanFeature, boolean>>;
  active: boolean;
};

const FEATURE_FIELDS: Record<PlanFeature, string> = {
  voice_announcements: "voiceAnnouncements",
  appointments: "appointments",
  remote_tickets: "remoteTickets",
  advanced_stats: "advancedStats",
  export: "export",
  dedicated_support: "dedicatedSupport",
};

/** Édition d'une formule (prix HT en FCFA, limites, quota, fonctions) ; aucun prix n'est écrit dans le code. */
export function PlanForm({ plan }: { plan: PlanFormValues }) {
  const t = useTranslations("platform");
  const tb = useTranslations("billing");
  const ta = useTranslations("admin");
  const [state, action, pending] = useActionState(updatePlan, null);
  const { field, top } = useFormErrors(state);
  const [features, setFeatures] = useState(plan.features);
  const [active, setActive] = useState(plan.active);

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <input type="hidden" name="planId" value={plan.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="name" label={t("planFields.name")} defaultValue={plan.name} required error={field("name")} />
        <TextField name="nameEn" label={t("planFields.nameEn")} defaultValue={plan.name_en ?? ""} error={field("nameEn")} />
      </div>
      <TextField name="description" label={t("planFields.description")} defaultValue={plan.description ?? ""} maxLength={240} error={field("description")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Num name="basePriceXaf" label={t("planFields.basePrice")} value={plan.base_price_xaf} error={field("basePriceXaf")} />
        <Num name="includedBranches" label={t("planFields.includedBranches")} value={plan.included_branches} error={field("includedBranches")} />
        <Num name="extraBranchPriceXaf" label={t("planFields.extraBranchPrice")} value={plan.extra_branch_price_xaf} error={field("extraBranchPriceXaf")} />
        <Num name="maxCountersPerBranch" label={t("planFields.maxCounters")} value={plan.max_counters_per_branch} error={field("maxCountersPerBranch")} />
        <Num name="maxDisplaysPerBranch" label={t("planFields.maxDisplays")} value={plan.max_displays_per_branch} error={field("maxDisplaysPerBranch")} />
        <Num name="whatsappQuotaPerBranch" label={t("planFields.whatsappQuota")} value={plan.whatsapp_quota_per_branch} error={field("whatsappQuotaPerBranch")} />
        <Num name="annualFreeMonths" label={t("planFields.annualFreeMonths")} value={plan.annual_free_months} error={field("annualFreeMonths")} />
      </div>
      <ListSection header={t("planFields.features")}>
        {PLAN_FEATURES.map((k) => (
          <ListSwitchRow key={k} title={tb(`features.${k}`)} checked={!!features[k]} onCheckedChange={(v) => setFeatures((cur) => ({ ...cur, [k]: v }))} />
        ))}
      </ListSection>
      {PLAN_FEATURES.map((k) => (
        <input key={k} type="hidden" name={FEATURE_FIELDS[k]} value={features[k] ? "true" : "false"} />
      ))}
      <ListSection footer={t("planNote")}>
        <ListSwitchRow title={t("planFields.active")} checked={active} onCheckedChange={setActive} />
      </ListSection>
      <input type="hidden" name="active" value={active ? "true" : "false"} />
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      </BottomBar>
    </form>
  );
}

function Num({ name, label, value, error }: { name: string; label: string; value: number | null; error?: string }) {
  return <TextField name={name} type="number" inputMode="numeric" min={0} label={label} defaultValue={value ?? ""} error={error} />;
}
