"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { SERVICE_COLORS, SERVICE_DURATION_PRESETS, formatTicketCode, suggestPrefix } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { cn } from "@/lib/cn";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SelectField } from "@/components/ui/select-field";
import { ServiceTile } from "@/components/ui/service-tile";
import { TextField } from "@/components/ui/text-field";
import { useFormErrors } from "./use-form-errors";

export type ServiceInitial = {
  name: string;
  nameEn: string | null;
  prefix: string;
  color: string;
  minutes: number;
  maxDailyTickets: number | null;
  specialtyId: string | null;
  description: string | null;
  allowPriority: boolean;
  allowRemote: boolean;
  active: boolean;
};

export function ServiceForm({
  action,
  initial,
  takenPrefixes,
  specialties,
  sortOrder,
  disabled,
}: {
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  initial?: ServiceInitial;
  takenPrefixes: string[];
  specialties: { id: string; name: string }[];
  sortOrder?: number;
  disabled?: boolean;
}) {
  const t = useTranslations("services");
  const ta = useTranslations("admin");
  const tc = useTranslations("serviceColors");
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const [name, setName] = useState(initial?.name ?? "");
  const [prefix, setPrefix] = useState(initial?.prefix ?? "");
  const [prefixTouched, setPrefixTouched] = useState(!!initial);
  const [color, setColor] = useState(initial?.color ?? SERVICE_COLORS.blue);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 10);
  const [flags, setFlags] = useState({
    allowPriority: initial?.allowPriority ?? true,
    allowRemote: initial?.allowRemote ?? true,
    active: initial?.active ?? true,
  });

  const effectivePrefix = prefixTouched ? prefix : name.trim() ? suggestPrefix(name, takenPrefixes) : "";
  const example = /^[A-Z]{1,2}$/.test(effectivePrefix) ? formatTicketCode(effectivePrefix, 1) : "C-001";

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <div className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-4">
        <ServiceTile letter={effectivePrefix || "?"} color={color} className="size-14 rounded-[14px] text-title2" />
        <div className="min-w-0">
          <p className="truncate text-headline">{name || t("namePlaceholder")}</p>
          <p className="text-subheadline font-semibold text-ticket-number">{example}</p>
        </div>
      </div>

      <TextField name="name" label={t("name")} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required error={field("name")} disabled={disabled} />
      <TextField name="nameEn" label={t("nameEn")} placeholder={t("nameEnPlaceholder")} defaultValue={initial?.nameEn ?? ""} lang="en" error={field("nameEn")} disabled={disabled} />
      <TextField
        name="prefix"
        label={t("prefix")}
        value={effectivePrefix}
        onChange={(e) => {
          setPrefixTouched(true);
          setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2));
        }}
        hint={t("prefixHint", { example })}
        maxLength={2}
        autoCapitalize="characters"
        error={field("prefix")}
        disabled={disabled}
        className="[&_input]:w-24 [&_input]:text-center [&_input]:font-bold [&_input]:tracking-widest"
      />

      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="px-4 pb-1.5 text-footnote uppercase text-label-secondary">{t("color")}</legend>
        <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-2 rounded-[var(--radius-md)] bg-grouped-secondary p-3">
          {Object.entries(SERVICE_COLORS).map(([key, hex]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={color === hex}
              aria-label={tc(key as "blue")}
              onClick={() => setColor(hex)}
              className="pressable flex size-11 items-center justify-center rounded-full"
            >
              <span
                className="flex size-8 items-center justify-center rounded-full"
                style={{ background: hex, boxShadow: color === hex ? `0 0 0 2px var(--bg-grouped-secondary), 0 0 0 4px ${hex}` : undefined }}
              >
                {color === hex ? <Check aria-hidden className="size-4 stroke-[3] text-white" /> : null}
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="color" value={color} />
      </fieldset>

      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="px-4 pb-1.5 text-footnote uppercase text-label-secondary">{t("duration")}</legend>
        <div role="radiogroup" aria-label={t("duration")} className="flex flex-wrap gap-2">
          {SERVICE_DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={cn(
                "pressable h-11 min-w-16 rounded-full px-4 text-callout font-medium",
                minutes === m ? "bg-accent text-on-accent" : "bg-grouped-secondary text-label",
              )}
            >
              {t("minutes", { count: m })}
            </button>
          ))}
        </div>
        <TextField
          name="defaultMinutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          label={t("otherDuration")}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          hint={t("durationHint")}
          error={field("defaultMinutes")}
        />
      </fieldset>

      <SelectField
        name="specialtyId"
        label={t("specialty")}
        hint={t("specialtyHint")}
        defaultValue={initial?.specialtyId ?? ""}
        options={[{ value: "", label: ta("none") }, ...specialties.map((s) => ({ value: s.id, label: s.name }))]}
        disabled={disabled}
      />
      <TextField
        name="maxDailyTickets"
        type="number"
        inputMode="numeric"
        min={1}
        max={9999}
        label={t("quota")}
        placeholder={ta("optional")}
        defaultValue={initial?.maxDailyTickets ?? ""}
        hint={t("quotaHint")}
        error={field("maxDailyTickets")}
        disabled={disabled}
      />
      <TextField name="description" label={t("description")} placeholder={t("descriptionPlaceholder")} defaultValue={initial?.description ?? ""} disabled={disabled} />

      <ListSection>
        <ListSwitchRow title={t("allowPriority")} subtitle={t("allowPriorityHint")} checked={flags.allowPriority} onCheckedChange={(v) => setFlags({ ...flags, allowPriority: v })} disabled={disabled} />
        <ListSwitchRow title={t("allowRemote")} subtitle={t("allowRemoteHint")} checked={flags.allowRemote} onCheckedChange={(v) => setFlags({ ...flags, allowRemote: v })} disabled={disabled} />
        <ListSwitchRow title={t("active")} checked={flags.active} onCheckedChange={(v) => setFlags({ ...flags, active: v })} disabled={disabled} />
      </ListSection>
      <input type="hidden" name="allowPriority" value={String(flags.allowPriority)} />
      <input type="hidden" name="allowRemote" value={String(flags.allowRemote)} />
      <input type="hidden" name="active" value={String(flags.active)} />
      <input type="hidden" name="sortOrder" value={sortOrder ?? 0} />

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
