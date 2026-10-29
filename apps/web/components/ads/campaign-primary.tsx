"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { checkoutCampaign, submitCampaign } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";

/** Action principale d'une campagne : soumettre (ou publier une annonce Maison), ou payer après validation. */
export function CampaignPrimary({ campaignId, kind, label }: { campaignId: string; kind: "submit" | "pay"; label: string }) {
  const t = useTranslations("ads");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(() => (kind === "submit" ? submitCampaign : checkoutCampaign)(campaignId), null);
  return (
    <form action={action}>
      <BottomBar>
        <FormError message={state && !state.ok ? te(state.error) : null} />
        <Button type="submit" block loading={pending} loadingLabel={t("submitting")}>
          {label}
        </Button>
      </BottomBar>
    </form>
  );
}
