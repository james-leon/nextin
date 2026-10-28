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
  // M9 — visibilité publique, ticket à distance, demandes de rendez-vous.
  publicListing: boolean;
  maxDistanceKm: number | null;
  confirmThreshold: number;
  penaltyPlaces: number;
  maxDelays: number;
  travelKmh: number;
  leaveMargin: number;
  requests: boolean;
  requestDays: number;
  requestMaxPending: number;
};

/** Distances maximales proposées (km) ; null = sans limite. */
const DISTANCES: (number | null)[] = [null, 1, 2, 5, 10, 20, 50, 100];

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
        <ListSwitchRow
          title={t("publicListing")}
          subtitle={t("publicListingHint")}
          checked={v.publicListing}
          onCheckedChange={(publicListing) => setV({ ...v, publicListing })}
          disabled={disabled}
        />
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
      <ListSection header={t("remoteHeader")} footer={v.remote ? t("remoteFooter") : undefined}>
        <ListSwitchRow title={t("remote")} subtitle={t("remoteHint")} checked={v.remote} onCheckedChange={(remote) => setV({ ...v, remote })} disabled={disabled} />
        {v.remote ? (
          <>
            <StepperRow
              label={t("maxDistance")}
              value={v.maxDistanceKm == null ? t("maxDistanceNone") : t("maxDistanceValue", { km: v.maxDistanceKm })}
              min={DISTANCES.indexOf(v.maxDistanceKm) <= 0}
              max={DISTANCES.indexOf(v.maxDistanceKm) >= DISTANCES.length - 1}
              onChange={(d) => setV({ ...v, maxDistanceKm: DISTANCES[Math.max(0, Math.min(DISTANCES.length - 1, DISTANCES.indexOf(v.maxDistanceKm) + d))] ?? null })}
              disabled={disabled}
            />
            <StepperRow
              label={t("confirmThreshold")}
              value={t("confirmThresholdValue", { count: v.confirmThreshold })}
              min={v.confirmThreshold <= 1}
              max={v.confirmThreshold >= 10}
              onChange={(d) => setV({ ...v, confirmThreshold: v.confirmThreshold + d })}
              disabled={disabled}
            />
            <StepperRow
              label={t("penaltyPlaces")}
              value={t("penaltyPlacesValue", { count: v.penaltyPlaces })}
              min={v.penaltyPlaces <= 1}
              max={v.penaltyPlaces >= 20}
              onChange={(d) => setV({ ...v, penaltyPlaces: v.penaltyPlaces + d })}
              disabled={disabled}
            />
            <StepperRow
              label={t("maxDelays")}
              value={t("maxDelaysValue", { count: v.maxDelays })}
              min={v.maxDelays <= 1}
              max={v.maxDelays >= 5}
              onChange={(d) => setV({ ...v, maxDelays: v.maxDelays + d })}
              disabled={disabled}
            />
            <StepperRow
              label={t("travelKmh")}
              value={t("travelKmhValue", { count: v.travelKmh })}
              step={5}
              min={v.travelKmh <= 5}
              max={v.travelKmh >= 80}
              onChange={(d) => setV({ ...v, travelKmh: v.travelKmh + d })}
              disabled={disabled}
            />
            <StepperRow
              label={t("leaveMargin")}
              value={t("leaveMarginValue", { minutes: v.leaveMargin })}
              step={5}
              min={v.leaveMargin <= 0}
              max={v.leaveMargin >= 60}
              onChange={(d) => setV({ ...v, leaveMargin: v.leaveMargin + d })}
              disabled={disabled}
            />
          </>
        ) : null}
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
      <ListSection header={t("requestsHeader")}>
        <ListSwitchRow title={t("requests")} subtitle={t("requestsHint")} checked={v.requests} onCheckedChange={(requests) => setV({ ...v, requests })} disabled={disabled} />
        {v.requests ? (
          <StepperRow
            label={t("requestDays")}
            value={t("requestDaysValue", { count: v.requestDays })}
            step={7}
            min={v.requestDays <= 7}
            max={v.requestDays >= 56}
            onChange={(d) => setV({ ...v, requestDays: Math.max(1, Math.min(60, v.requestDays + d)) })}
            disabled={disabled}
          />
        ) : null}
        {v.requests ? (
          <StepperRow
            label={t("requestMaxPending")}
            value={t("requestMaxPendingValue", { count: v.requestMaxPending })}
            min={v.requestMaxPending <= 1}
            max={v.requestMaxPending >= 10}
            onChange={(d) => setV({ ...v, requestMaxPending: v.requestMaxPending + d })}
            disabled={disabled}
          />
        ) : null}
      </ListSection>
      <input type="hidden" name="publicListingEnabled" value={String(v.publicListing)} />
      <input type="hidden" name="remoteMaxDistanceKm" value={v.maxDistanceKm ?? ""} />
      <input type="hidden" name="remoteConfirmThreshold" value={v.confirmThreshold} />
      <input type="hidden" name="remotePenaltyPlaces" value={v.penaltyPlaces} />
      <input type="hidden" name="remoteMaxDelays" value={v.maxDelays} />
      <input type="hidden" name="remoteTravelKmh" value={v.travelKmh} />
      <input type="hidden" name="remoteLeaveMarginMinutes" value={v.leaveMargin} />
      <input type="hidden" name="appointmentRequestsEnabled" value={String(v.requests)} />
      <input type="hidden" name="appointmentRequestDays" value={v.requestDays} />
      <input type="hidden" name="appointmentRequestMaxPending" value={v.requestMaxPending} />
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
