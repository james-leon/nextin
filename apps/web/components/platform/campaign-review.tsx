"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { reviewCampaign, setCampaignPaused } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import type { CampaignStatus } from "@/lib/ads/types";

/**
 * Décision du super admin : valider (action principale) ou refuser avec motif une campagne en validation ; mettre en
 * pause ou reprendre une campagne diffusée, motif obligatoire. Tout est journalisé par la base.
 */
export function CampaignReview({ campaignId, status, canApprove }: { campaignId: string; status: CampaignStatus; canApprove: boolean }) {
  const t = useTranslations("adsAdmin");
  const [approveState, approveAction, approving] = useActionState(reviewCampaign, null);
  const approveErrors = useFormErrors(approveState);

  if (status === "pending_review") {
    return (
      <>
        <ReasonSheet campaignId={campaignId} action={reviewCampaign} approve={false} trigger={t("reject")} title={t("rejectTitle")} label={t("note")} submit={t("reject")} destructive />
        <form action={approveAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="approve" value="true" />
          <BottomBar>
            <FormError message={approveErrors.top} />
            <Button type="submit" block loading={approving} loadingLabel={t("approving")} disabled={!canApprove}>
              {t("approve")}
            </Button>
          </BottomBar>
        </form>
      </>
    );
  }
  if (status === "active" || status === "paused") {
    const pausing = status === "active";
    return (
      <ReasonSheet
        campaignId={campaignId}
        action={setCampaignPaused}
        approve={pausing}
        trigger={pausing ? t("pause") : t("resume")}
        title={pausing ? t("pause") : t("resume")}
        label={t("reason")}
        submit={pausing ? t("pause") : t("resume")}
        destructive={pausing}
      />
    );
  }
  return null;
}

function ReasonSheet({
  campaignId,
  action,
  approve,
  trigger,
  title,
  label,
  submit,
  destructive,
}: {
  campaignId: string;
  action: typeof reviewCampaign;
  approve: boolean;
  trigger: string;
  title: string;
  label: string;
  submit: string;
  destructive?: boolean;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const formId = `reason-${approve ? "on" : "off"}`;
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant={destructive ? "destructive-plain" : "gray"} className="self-start">
          {trigger}
        </Button>
      }
      title={title}
      closeLabel={tc("close")}
      footer={
        <Button type="submit" form={formId} block variant={destructive ? "destructive" : "filled"} loading={pending}>
          {submit}
        </Button>
      }
    >
      <form id={formId} action={formAction} noValidate className="flex flex-col gap-4 pt-2">
        <FormError message={top} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="approve" value={String(approve)} />
        <TextField name="note" label={label} maxLength={500} required minLength={3} error={field("note")} />
      </form>
    </Sheet>
  );
}
