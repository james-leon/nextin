"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { Button, IconButton } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useFormErrors } from "./use-form-errors";

export type ScheduleRange = { id: string; weekday: number; startsAt: string; endsAt: string; slotMinutes: number; serviceName: string };
export type Leave = { id: string; startsOn: string; endsOn: string; reason: string | null };

type FormAction = (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

/** Supprime une ligne (action serveur liée) ; l'erreur éventuelle s'affiche en notification. */
function DeleteButton({ label, action }: { label: string; action: () => Promise<ActionResult> }) {
  const te = useTranslations("errors");
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <IconButton
      label={label}
      icon={<Trash2 />}
      variant="plain"
      className="text-red-text"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (r && !r.ok) toast(te(r.error));
        })
      }
    />
  );
}

/**
 * Horaires de consultation (plages hebdomadaires découpées en créneaux) et congés d'un praticien.
 * Sur grand écran : semaine à gauche, congés à droite ; sur téléphone, à la suite.
 */
export function ScheduleEditor({
  ranges,
  leaves,
  services,
  disabled,
  addRange,
  deleteRange,
  addLeave,
  deleteLeave,
  locale,
}: {
  ranges: ScheduleRange[];
  leaves: Leave[];
  services: { id: string; name: string }[];
  disabled: boolean;
  addRange: FormAction;
  deleteRange: (id: string) => Promise<ActionResult>;
  addLeave: FormAction;
  deleteLeave: (id: string) => Promise<ActionResult>;
  locale: string;
}) {
  const t = useTranslations("schedule");
  const tw = useTranslations("weekdays");
  const [rangeState, rangeAction, rangePending] = useActionState(addRange, null);
  const [leaveState, leaveAction, leavePending] = useActionState(addLeave, null);
  const rangeErrors = useFormErrors(rangeState);
  const leaveErrors = useFormErrors(leaveState);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex flex-col gap-7">
        <ListSection header={t("week")} footer={t("weekFooter")}>
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const dayRanges = ranges.filter((r) => r.weekday === weekday);
            return (
              <li key={weekday} className="group/row pl-4">
                <div className="list-separator flex min-h-11 items-start gap-4 py-2.5 pr-2">
                  <span className="w-24 shrink-0 pt-0.5 text-body sm:w-28">{tw(String(weekday) as "1")}</span>
                  {dayRanges.length ? (
                    <ul role="list" className="flex min-w-0 flex-1 flex-col gap-1">
                      {dayRanges.map((r) => {
                        const range = t("range", { from: r.startsAt, to: r.endsAt });
                        return (
                          <li key={r.id} className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 flex-col">
                              <span className="text-body font-semibold tabular">{range}</span>
                              <span className="truncate text-subheadline text-label-secondary">
                                {t("rangeDetail", { minutes: r.slotMinutes, service: r.serviceName })}
                              </span>
                            </span>
                            {disabled ? null : (
                              <DeleteButton label={t("removeRange", { range: `${tw(String(weekday) as "1")} ${range}` })} action={() => deleteRange(r.id)} />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="pt-0.5 text-body text-label-secondary">{t("noRanges")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ListSection>

        {disabled ? null : services.length ? (
          <form action={rangeAction} noValidate className="flex flex-col gap-4">
            <h2 className="px-4 text-footnote uppercase text-label-secondary">{t("addRange")}</h2>
            <FormError message={rangeErrors.top} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="weekday"
                label={t("weekday")}
                defaultValue="1"
                options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: tw(String(d) as "1") }))}
              />
              <SelectField name="serviceId" label={t("service")} options={services.map((s) => ({ value: s.id, label: s.name }))} />
              <TextField name="startsAt" type="time" label={t("from")} defaultValue="08:00" required error={rangeErrors.field("startsAt")} className="tabular" />
              <TextField name="endsAt" type="time" label={t("to")} defaultValue="12:00" required error={rangeErrors.field("endsAt")} className="tabular" />
              <SelectField
                name="slotMinutes"
                label={t("slot")}
                defaultValue="30"
                options={SLOT_OPTIONS.map((m) => ({ value: String(m), label: String(m) }))}
              />
            </div>
            <Button type="submit" variant="tinted" leadingIcon={<Plus />} loading={rangePending} className="self-start">
              {t("addRange")}
            </Button>
          </form>
        ) : (
          <p className="px-4 text-subheadline text-label-secondary">{t("noService")}</p>
        )}
      </div>

      <div className="flex flex-col gap-7">
        <ListSection header={t("leaves")} footer={t("leavesFooter")}>
          {leaves.length ? (
            leaves.map((l) => {
              const leave = t("leave", { from: day(l.startsOn), to: day(l.endsOn) });
              return (
                <li key={l.id} className="group/row pl-4">
                  <div className="list-separator flex min-h-11 items-center gap-3 py-2 pr-2">
                    <CalendarOff aria-hidden className="size-5 shrink-0 stroke-[1.75] text-orange" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body">{leave}</span>
                      {l.reason ? <span className="truncate text-subheadline text-label-secondary">{l.reason}</span> : null}
                    </span>
                    {disabled ? null : <DeleteButton label={t("removeLeave", { leave })} action={() => deleteLeave(l.id)} />}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-3 text-body text-label-secondary">{t("noLeaves")}</li>
          )}
        </ListSection>

        {disabled ? null : (
          <form action={leaveAction} noValidate className="flex flex-col gap-4">
            <h2 className="px-4 text-footnote uppercase text-label-secondary">{t("addLeave")}</h2>
            <FormError message={leaveErrors.top} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <TextField name="startsOn" type="date" label={t("leaveFrom")} required error={leaveErrors.field("startsOn")} />
              <TextField name="endsOn" type="date" label={t("leaveTo")} required error={leaveErrors.field("endsOn")} />
            </div>
            <TextField name="reason" label={t("leaveReason")} maxLength={120} />
            <Button type="submit" variant="tinted" leadingIcon={<Plus />} loading={leavePending} className="self-start">
              {t("addLeave")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
