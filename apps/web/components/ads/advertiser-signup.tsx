"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { createAdvertiser } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import type { SectorRow } from "@/lib/ads/types";

/** Ouverture d'un espace annonceur : entreprise, secteur, téléphone, ville. */
export function AdvertiserSignup({ sectors }: { sectors: SectorRow[] }) {
  const t = useTranslations("ads");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createAdvertiser, null);
  const { field, top } = useFormErrors(state);
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-8 text-center shadow-card">
        <span className="squircle flex size-14 items-center justify-center rounded-[16px] bg-accent-tint text-accent-on-tint">
          <Megaphone aria-hidden className="size-7 stroke-[1.5]" />
        </span>
        <h2 className="text-title2 font-bold">{t("onboardingTitle")}</h2>
        <p className="text-body text-label-secondary">{t("onboardingBody")}</p>
      </section>
      <FormError message={top} />
      <TextField name="name" label={t("advertiserName")} autoComplete="organization" required maxLength={120} error={field("name")} />
      <SelectField name="sector" label={t("sector")} options={sectors.map((s) => ({ value: s.code, label: locale === "en" ? s.name_en : s.name }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="phone" type="tel" inputMode="tel" autoComplete="tel-national" label={t("phone")} error={field("phone")} />
        <TextField name="city" label={t("city")} autoComplete="address-level2" maxLength={80} />
      </div>
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={t("creating")}>
          {t("createAccount")}
        </Button>
      </BottomBar>
    </form>
  );
}
