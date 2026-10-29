"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateSettings } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export type PlatformSettingsValues = {
  company_legal_name: string;
  company_rc: string;
  company_niu: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  invoice_footer: string;
  trial_days: number;
  grace_days: number;
  read_only_days: number;
  retention_after_suspension_days: number;
  default_closing_time: string;
  vat_rate: number;
  invoice_lead_days: number;
  quota_alert_percent: number;
};

/** Mentions légales des factures et durées du cycle de vie, modifiables sans déploiement. */
export function SettingsForm({ values }: { values: PlatformSettingsValues }) {
  const t = useTranslations("platform");
  const ta = useTranslations("admin");
  const [state, action, pending] = useActionState(updateSettings, null);
  const { field, top } = useFormErrors(state);
  const text = (name: string, key: keyof PlatformSettingsValues, label: string, max: number) => (
    <TextField name={name} label={label} defaultValue={String(values[key] ?? "")} maxLength={max} error={field(name)} />
  );
  const num = (name: string, key: keyof PlatformSettingsValues, label: string, min: number, max: number, step = 1) => (
    <TextField name={name} type="number" inputMode="decimal" min={min} max={max} step={step} label={label} defaultValue={String(values[key])} error={field(name)} />
  );
  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      <FormError message={top} />
      <section aria-labelledby="legal-title" className="flex flex-col gap-4">
        <h2 id="legal-title" className="px-4 text-title3 font-bold">
          {t("legal")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {text("companyLegalName", "company_legal_name", t("settingsFields.companyLegalName"), 160)}
          {text("companyAddress", "company_address", t("settingsFields.companyAddress"), 240)}
          {text("companyRc", "company_rc", t("settingsFields.companyRc"), 60)}
          {text("companyNiu", "company_niu", t("settingsFields.companyNiu"), 60)}
          {text("companyPhone", "company_phone", t("settingsFields.companyPhone"), 40)}
          {text("companyEmail", "company_email", t("settingsFields.companyEmail"), 120)}
        </div>
        {text("invoiceFooter", "invoice_footer", t("settingsFields.invoiceFooter"), 500)}
      </section>
      <section aria-labelledby="durations-title" className="flex flex-col gap-4">
        <h2 id="durations-title" className="px-4 text-title3 font-bold">
          {t("durations")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {num("trialDays", "trial_days", t("settingsFields.trialDays"), 0, 90)}
          {num("graceDays", "grace_days", t("settingsFields.graceDays"), 0, 60)}
          {num("readOnlyDays", "read_only_days", t("settingsFields.readOnlyDays"), 1, 60)}
          {num("retentionAfterSuspensionDays", "retention_after_suspension_days", t("settingsFields.retentionDays"), 7, 365)}
          <TextField name="defaultClosingTime" type="time" label={t("settingsFields.closingTime")} defaultValue={values.default_closing_time.slice(0, 5)} error={field("defaultClosingTime")} />
          {num("vatRate", "vat_rate", t("settingsFields.vatRate"), 0, 50, 0.01)}
          {num("invoiceLeadDays", "invoice_lead_days", t("settingsFields.invoiceLeadDays"), 1, 30)}
          {num("quotaAlertPercent", "quota_alert_percent", t("settingsFields.quotaAlert"), 50, 100)}
        </div>
      </section>
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      </BottomBar>
    </form>
  );
}
