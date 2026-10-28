"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useFormErrors } from "./use-form-errors";

type Settings = {
  remote: boolean;
  priorities: boolean;
  rating: boolean;
  almostTurn: number;
  appointmentMode: "ratio" | "strict";
  walkinRatio: number;
  early: number;
  grace: number;
  noShow: number;
};

/** Ligne « valeur − + » d'une liste groupée (pas de saisie au clavier sur téléphone). */
function StepperRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  min: boolean;
  max: boolean;
  step?: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
}) {
  const ta = useTranslations("admin");
  return (
    <li className="list-separator flex min-h-11 items-center justify-between gap-3 py-1.5 pr-4 pl-4">
      <span className="flex min-w-0 flex-col">
        <span className="text-body">{label}</span>
        <span className="text-subheadline text-label-secondary tabular" aria-live="polite">
          {value}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <IconButton label={`${ta("decrease")} · ${label}`} icon={<Minus />} onClick={() => onChange(-step)} disabled={disabled || min} />
        <IconButton label={`${ta("increase")} · ${label}`} icon={<Plus />} onClick={() => onChange(step)} disabled={disabled || max} />
      </span>
    </li>
  );
}

export function BranchSettingsForm({
  action,
  initial,
  disabled,
}: {
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  initial: Settings;
  disabled?: boolean;
}) {
  const t = useTranslations("branchSettings");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { top } = useFormErrors(state);
  const [v, setV] = useState(initial);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <ListSection>
        <ListSwitchRow title={t("remote")} subtitle={t("remoteHint")} checked={v.remote} onCheckedChange={(remote) => setV({ ...v, remote })} disabled={disabled} />
        <ListSwitchRow title={t("priorities")} subtitle={t("prioritiesHint")} checked={v.priorities} onCheckedChange={(priorities) => setV({ ...v, priorities })} disabled={disabled} />
        <ListSwitchRow title={t("rating")} checked={v.rating} onCheckedChange={(rating) => setV({ ...v, rating })} disabled={disabled} />
      </ListSection>
      <ListSection header={t("almostTurn")}>
        <li className="flex min-h-11 items-center justify-between gap-3 px-4 py-1.5">
          <span className="text-body" aria-live="polite">
            {t("almostTurnValue", { count: v.almostTurn })}
          </span>
          <span className="flex items-center gap-2">
            <IconButton label={ta("decrease")} icon={<Minus />} onClick={() => setV({ ...v, almostTurn: Math.max(1, v.almostTurn - 1) })} disabled={disabled || v.almostTurn <= 1} />
            <IconButton label={ta("increase")} icon={<Plus />} onClick={() => setV({ ...v, almostTurn: Math.min(10, v.almostTurn + 1) })} disabled={disabled || v.almostTurn >= 10} />
          </span>
        </li>
      </ListSection>
      <ListSection
        header={t("appointmentsHeader")}
        footer={v.appointmentMode === "ratio" ? t("modeRatioFooter", { count: v.walkinRatio }) : t("modeStrictFooter")}
      >
        <li className="px-4 py-3">
          <SegmentedControl
            label={t("modeLabel")}
            value={v.appointmentMode}
            onValueChange={(appointmentMode) => !disabled && setV({ ...v, appointmentMode })}
            options={[
              { value: "ratio", label: t("modeRatio") },
              { value: "strict", label: t("modeStrict") },
            ]}
          />
        </li>
        {v.appointmentMode === "ratio" ? (
          <StepperRow
            label={t("walkinRatio")}
            value={t("walkinRatioValue", { count: v.walkinRatio })}
            min={v.walkinRatio <= 0}
            max={v.walkinRatio >= 10}
            onChange={(d) => setV({ ...v, walkinRatio: v.walkinRatio + d })}
            disabled={disabled}
          />
        ) : null}
        <StepperRow
          label={t("early")}
          value={t("beforeValue", { minutes: v.early })}
          step={5}
          min={v.early <= 0}
          max={v.early >= 120}
          onChange={(d) => setV({ ...v, early: v.early + d })}
          disabled={disabled}
        />
        <StepperRow
          label={t("grace")}
          value={t("afterValue", { minutes: v.grace })}
          step={5}
          min={v.grace <= 0}
          max={v.grace >= 120}
          onChange={(d) => setV({ ...v, grace: v.grace + d })}
          disabled={disabled}
        />
        <StepperRow
          label={t("noShow")}
          value={t("afterValue", { minutes: v.noShow })}
          step={15}
          min={v.noShow <= 15}
          max={v.noShow >= 480}
          onChange={(d) => setV({ ...v, noShow: v.noShow + d })}
          disabled={disabled}
        />
      </ListSection>
      <input type="hidden" name="appointmentMode" value={v.appointmentMode} />
      <input type="hidden" name="appointmentWalkinRatio" value={v.walkinRatio} />
      <input type="hidden" name="appointmentEarlyMinutes" value={v.early} />
      <input type="hidden" name="appointmentLateGraceMinutes" value={v.grace} />
      <input type="hidden" name="appointmentNoShowMinutes" value={v.noShow} />
      <input type="hidden" name="remoteTicketsEnabled" value={String(v.remote)} />
      <input type="hidden" name="prioritiesEnabled" value={String(v.priorities)} />
      <input type="hidden" name="ratingEnabled" value={String(v.rating)} />
      <input type="hidden" name="almostTurnThreshold" value={v.almostTurn} />
      {disabled ? null : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
            {ta("save")}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}
