"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Plus } from "lucide-react";
import { SERVICE_COLORS, SERVICE_TEMPLATES, type ServiceTemplateOrgType } from "@nextin/shared";
import { ORG_TYPES, adminCreateOrganizationSchema } from "@nextin/shared/schemas";
import { createOrganizationForClient } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import type { ErrorCode } from "@/lib/auth/errors";
import { CopyButton } from "@/components/admin/copy-button";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { ServiceTile } from "@/components/ui/service-tile";
import { TextField } from "@/components/ui/text-field";

export type PlanOption = { id: string; name: string };

/**
 * P1 — console Wintek : établissement créé pour un client. Une action principale (« Créer et inviter ») ;
 * les services du modèle du secteur sont cochés d'office et suivent le secteur choisi.
 */
export function NewOrganizationForm({ plans, defaultPlanId, defaultTrialDays }: { plans: PlanOption[]; defaultPlanId: string; defaultTrialDays: number }) {
  const t = useTranslations("platform.newOrg");
  const to = useTranslations("orgTypes");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createOrganizationForClient, null);
  const { field: serverField, top } = useFormErrors(state);
  const te = useTranslations("errors");
  // Validation dans le navigateur (même schéma que le serveur) : la saisie reste en place en cas d'erreur.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const field = (name: string) => {
    const code = clientErrors[name];
    if (!code) return serverField(name);
    return te.has(code as ErrorCode) ? te(code as ErrorCode) : te("generic");
  };
  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(e.currentTarget);
    const parsed = adminCreateOrganizationSchema.safeParse({ ...Object.fromEntries(data), services: data.getAll("services") });
    if (parsed.success) {
      setClientErrors({});
      return;
    }
    e.preventDefault();
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    setClientErrors(errors);
  };
  const [type, setType] = useState<ServiceTemplateOrgType>("clinic");
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const templates = SERVICE_TEMPLATES[type];
  const selected = picked[type] ?? templates.map((s) => s.key);
  const toggle = (key: string) =>
    setPicked((all) => ({ ...all, [type]: selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key] }));

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <section className="squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
          <span className="squircle flex size-12 items-center justify-center rounded-[14px] bg-green-tint text-green-text">
            <CheckCircle2 aria-hidden className="size-6 stroke-[1.75]" />
          </span>
          <h2 className="text-title3 font-bold [text-wrap:balance]">{t("createdTitle", { name: state.name })}</h2>
          {state.mailSent ? (
            <p className="text-body text-label-secondary">{t("createdSent", { email: state.email })}</p>
          ) : (
            <>
              <p className="text-body text-label-secondary">{t("createdNotSent")}</p>
              {state.link ? (
                <>
                  <p className="truncate rounded-[10px] bg-fill-tertiary px-3 py-2.5 text-subheadline" title={state.link}>
                    {state.link}
                  </p>
                  <CopyButton value={state.link} label={t("copy")} copiedLabel={t("copied")} size="lg" block />
                </>
              ) : null}
            </>
          )}
        </section>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild variant="tinted" block>
            <Link href="/admin">{t("openSubscription")}</Link>
          </Button>
          <Button asChild variant="plain" block>
            <a href="/admin/organizations/new">{t("another")}</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <section aria-labelledby="new-org-identity" className="flex flex-col gap-4">
        <h2 id="new-org-identity" className="px-4 text-title3 font-bold">
          {t("organization")}
        </h2>
        <TextField name="name" label={t("name")} autoComplete="organization" maxLength={120} required error={field("name")} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            name="type"
            label={t("type")}
            value={type}
            onChange={(e) => setType(e.target.value as ServiceTemplateOrgType)}
            options={ORG_TYPES.map((o) => ({ value: o, label: to(o) }))}
            error={field("type")}
          />
          <SelectField
            name="locale"
            label={t("locale")}
            defaultValue="fr"
            options={[
              { value: "fr", label: t("localeFr") },
              { value: "en", label: t("localeEn") },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="new-org-subscription" className="flex flex-col gap-4">
        <h2 id="new-org-subscription" className="px-4 text-title3 font-bold">
          {t("subscription")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField name="planId" label={t("plan")} defaultValue={defaultPlanId} options={plans.map((p) => ({ value: p.id, label: p.name }))} error={field("planId")} />
          <TextField
            name="trialDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            label={t("trialDays")}
            defaultValue={defaultTrialDays}
            hint={t("trialHint")}
            required
            error={field("trialDays")}
          />
        </div>
      </section>

      <section aria-labelledby="new-org-owner" className="flex flex-col gap-4">
        <h2 id="new-org-owner" className="px-4 text-title3 font-bold">
          {t("owner")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            name="ownerEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            label={t("ownerEmail")}
            hint={t("ownerHint")}
            required
            error={field("ownerEmail")}
          />
          <TextField name="ownerPhone" type="tel" inputMode="tel" autoComplete="off" label={t("ownerPhone")} placeholder="6XX XX XX XX" error={field("ownerPhone")} />
        </div>
      </section>

      <section aria-labelledby="new-org-branch" className="flex flex-col gap-4">
        <h2 id="new-org-branch" className="px-4 text-title3 font-bold">
          {t("branch")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField name="branchName" label={t("branchName")} maxLength={80} required error={field("branchName")} />
          <TextField name="branchCity" label={t("branchCity")} maxLength={80} autoComplete="address-level2" error={field("branchCity")} />
        </div>
      </section>

      <ListSection header={t("services")} footer={t("servicesFooter")} checkboxGroupLabel={t("services")}>
        {templates.map((s) => (
          <ListRow
            key={s.key}
            role="checkbox"
            selected={selected.includes(s.key)}
            onClick={() => toggle(s.key)}
            icon={<ServiceTile letter={s.prefix} color={SERVICE_COLORS[s.color]} />}
            title={locale === "en" ? s.name.en : s.name.fr}
            detail={<span className="tabular">{t("minutes", { count: s.minutes })}</span>}
            accessory="check"
          />
        ))}
      </ListSection>
      {selected.map((key) => (
        <input key={key} type="hidden" name="services" value={key} />
      ))}

      <TextField name="reason" label={t("reason")} placeholder={t("reasonPlaceholder")} maxLength={300} required error={field("reason")} />

      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={t("submitting")} leadingIcon={<Plus aria-hidden className="size-5" />}>
          {t("submit")}
        </Button>
      </BottomBar>
    </form>
  );
}
