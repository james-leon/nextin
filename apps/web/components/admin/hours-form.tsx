"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useFormErrors } from "./use-form-errors";

type Day = { weekday: number; open: boolean; opensAt: string; closesAt: string };

export function HoursForm({ action, initial, disabled }: { action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>; initial: Day[]; disabled?: boolean }) {
  const t = useTranslations("hours");
  const tw = useTranslations("weekdays");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const [days, setDays] = useState(initial);
  const set = (weekday: number, patch: Partial<Day>) => setDays((all) => all.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FormError message={top} />
      <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
        {days.map((d) => {
          const name = tw(String(d.weekday) as "1");
          const error = field(`day-${d.weekday}`);
          return (
            <li key={d.weekday} className="group/row pl-4">
              <div className="list-separator flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 pr-4">
                <span id={`day-${d.weekday}`} className="w-24 text-body">
                  {name}
                </span>
                <Switch
                  name={`open-${d.weekday}`}
                  value="on"
                  checked={d.open}
                  onCheckedChange={(open) => set(d.weekday, { open })}
                  aria-label={t("openDay", { day: name })}
                  disabled={disabled}
                />
                {d.open ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      name={`opens-${d.weekday}`}
                      value={d.opensAt}
                      onChange={(e) => set(d.weekday, { opensAt: e.target.value })}
                      aria-label={`${name} — ${t("opens")}`}
                      aria-invalid={error ? true : undefined}
                      disabled={disabled}
                      className="h-11 rounded-[8px] bg-fill-tertiary px-2 text-body tabular"
                    />
                    <span aria-hidden className="text-label-secondary">–</span>
                    <input
                      type="time"
                      name={`closes-${d.weekday}`}
                      value={d.closesAt}
                      onChange={(e) => set(d.weekday, { closesAt: e.target.value })}
                      aria-label={`${name} — ${t("closes")}`}
                      aria-invalid={error ? true : undefined}
                      disabled={disabled}
                      className="h-11 rounded-[8px] bg-fill-tertiary px-2 text-body tabular"
                    />
                  </span>
                ) : (
                  <span className="text-body text-label-secondary">{t("closed")}</span>
                )}
                {error ? (
                  <p role="alert" className="w-full text-footnote text-red-text">
                    {error}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
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
