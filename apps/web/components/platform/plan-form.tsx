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
  max_services: number | null;
  max_counters: number | null;
  max_displays: number | null;
  max_users: number | null;
  tickets_per_month: number | null;
  whatsapp_quota: number | null;
  history_months: number | null;
  annual_free_months: number;
  features: Partial<Record<PlanFeature, boolean>>;
  quote_only: boolean;
  trial_eligible: boolean;
  active: boolean;
};

const FEATURE_FIELDS: Record<PlanFeature, string> = {
  voice_announcements: "voiceAnnouncements",
  appointments: "appointments",
  remote_tickets: "remoteTickets",
  advanced_stats: "advancedStats",
  export: "export",
  multisite: "multisite",
  priority_support: "prioritySupport",
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
  const [quoteOnly, setQuoteOnly] = useState(plan.quote_only);
  const [trialEligible, setTrialEligible] = useState(plan.trial_eligible);

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <input type="hidden" name="planId" value={plan.id} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField name="name" label={t("planFields.name")} defaultValue={plan.name} required error={field("name")} />
        <TextField name="nameEn" label={t("planFields.nameEn")} defaultValue={plan.name_en ?? ""} error={field("nameEn")} />
      </div>
      <TextField name="description" label={t("planFields.description")} defaultValue={plan.description ?? ""} maxLength={240} error={field("description")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Num name="basePriceXaf" label={t("planFields.basePrice")} value={plan.base_price_xaf} error={field("basePriceXaf")} />
        <Num name="includedBranches" label={t("planFields.includedBranches")} value={plan.included_branches} error={field("includedBranches")} />
        <Num name="extraBranchPriceXaf" label={t("planFields.extraBranchPrice")} value={plan.extra_branch_price_xaf} error={field("extraBranchPriceXaf")} />
        <Num name="annualFreeMonths" label={t("planFields.annualFreeMonths")} value={plan.annual_free_months} error={field("annualFreeMonths")} />
      </div>
      <h2 className="px-4 text-footnote text-label-secondary uppercase">{t("planFields.limits")}</h2>
      <div className="-mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Num name="maxServices" label={t("planFields.maxServices")} value={plan.max_services} error={field("maxServices")} />
        <Num name="maxCounters" label={t("planFields.maxCounters")} value={plan.max_counters} error={field("maxCounters")} />
        <Num name="maxDisplays" label={t("planFields.maxDisplays")} value={plan.max_displays} error={field("maxDisplays")} />
        <Num name="maxUsers" label={t("planFields.maxUsers")} value={plan.max_users} error={field("maxUsers")} />
        <Num name="ticketsPerMonth" label={t("planFields.ticketsPerMonth")} value={plan.tickets_per_month} error={field("ticketsPerMonth")} />
        <Num name="whatsappQuota" label={t("planFields.whatsappQuota")} value={plan.whatsapp_quota} error={field("whatsappQuota")} />
        <Num name="historyMonths" label={t("planFields.historyMonths")} value={plan.history_months} error={field("historyMonths")} />
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
        <ListSwitchRow title={t("planFields.quoteOnly")} checked={quoteOnly} onCheckedChange={setQuoteOnly} />
        <ListSwitchRow title={t("planFields.trialEligible")} checked={trialEligible} onCheckedChange={setTrialEligible} />
        <ListSwitchRow title={t("planFields.active")} checked={active} onCheckedChange={setActive} />
      </ListSection>
      <input type="hidden" name="quoteOnly" value={quoteOnly ? "true" : "false"} />
      <input type="hidden" name="trialEligible" value={trialEligible ? "true" : "false"} />
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
