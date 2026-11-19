"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";
import { Switch } from "@/components/ui/switch";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
import { useFormErrors } from "./use-form-errors";

type Day = { weekday: number; open: boolean; opensAt: string; closesAt: string };

/**
 * Horaires d'ouverture (maquette v2 17) : une ligne par jour, heures d'ouverture et de fermeture en pastilles, un
 * interrupteur pour ouvrir ou fermer le jour. Enregistrement automatique.
 */
export function HoursForm({ action, initial, disabled }: { action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>; initial: Day[]; disabled?: boolean }) {
  const t = useTranslations("hours");
  const tw = useTranslations("weekdays");
  const [days, setDays] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, !disabled);
  const { field } = useFormErrors(saveState.result);
  const set = (weekday: number, patch: Partial<Day>) => setDays((all) => all.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="autosave" value="1" />
      <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
        {days.map((d) => {
          const name = tw(String(d.weekday) as "1");
          const error = field(`day-${d.weekday}`);
          return (
            <li key={d.weekday} className="group/row pl-4">
              <div className="list-separator flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pr-4">
                <span id={`day-${d.weekday}`} className="min-w-20 flex-1 text-body">
                  {name}
                </span>
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
                      className="h-11 rounded-[8px] bg-fill-tertiary px-2 text-callout tabular"
                    />
                    <input
                      type="time"
                      name={`closes-${d.weekday}`}
                      value={d.closesAt}
                      onChange={(e) => set(d.weekday, { closesAt: e.target.value })}
                      aria-label={`${name} — ${t("closes")}`}
                      aria-invalid={error ? true : undefined}
                      disabled={disabled}
                      className="h-11 rounded-[8px] bg-fill-tertiary px-2 text-callout tabular"
                    />
                  </span>
                ) : (
                  <span className="text-body text-label-secondary">{t("closed")}</span>
                )}
                <Switch
                  name={`open-${d.weekday}`}
                  value="on"
                  checked={d.open}
                  onCheckedChange={(open) => set(d.weekday, { open })}
                  aria-label={t("openDay", { day: name })}
                  disabled={disabled}
                />
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
      {disabled ? null : <AutoSaveStatus state={saveState} className="justify-center" />}
    </form>
  );
}
