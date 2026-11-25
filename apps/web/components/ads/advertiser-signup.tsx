"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { createAdvertiser } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { FormGroup, TextField } from "@/components/ui/text-field";
import type { SectorRow } from "@/lib/ads/types";
import { SelectRow } from "./select-row";

/**
 * Ouverture d'un espace annonceur (maquette v2 24) : pictogramme orange, accroche, quatre champs groupés (nom,
 * secteur, téléphone, ville) et une seule action. Le secteur décide si un visa santé sera exigé.
 */
export function AdvertiserSignup({ sectors }: { sectors: SectorRow[] }) {
  const t = useTranslations("ads");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createAdvertiser, null);
  const { field, top } = useFormErrors(state);
  return (
    <main className="mx-auto flex w-full max-w-[40rem] flex-col gap-6 px-4 pt-8 pb-36 md:px-8 md:pb-10">
      <span aria-hidden className="squircle flex items-center justify-center bg-orange text-white [&_svg]:size-7 [&_svg]:stroke-[1.75]" style={{ width: "3.25rem", height: "3.25rem", borderRadius: 14 }}>
        <Megaphone />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-title1 font-bold text-balance">{t("onboardingTitle")}</h1>
        <p className="text-body text-label-secondary">{t("onboardingBody")}</p>
      </div>
      <form action={action} noValidate className="flex flex-col gap-6">
        <FormError message={top} />
        <FormGroup>
          <TextField grouped name="name" label={t("advertiserName")} autoComplete="organization" required maxLength={120} error={field("name")} />
          <SelectRow name="sector" label={t("sector")} options={sectors.map((s) => ({ value: s.code, label: locale === "en" ? s.name_en : s.name }))} />
          <TextField grouped name="phone" type="tel" inputMode="tel" autoComplete="tel-national" label={t("phone")} error={field("phone")} />
          <TextField grouped name="city" label={t("city")} autoComplete="address-level2" maxLength={80} />
        </FormGroup>
        <BottomBar dock={false}>
          <Button type="submit" block loading={pending} loadingLabel={t("creating")}>
            {t("createAccount")}
          </Button>
        </BottomBar>
      </form>
    </main>
  );
}
