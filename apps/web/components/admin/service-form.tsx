"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { SERVICE_COLORS, formatTicketCode, suggestPrefix } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SelectField } from "@/components/ui/select-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
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

/** Durées proposées en segments (maquette v2 17) ; toute autre valeur passe par « Autre ». */
const QUICK_MINUTES = [5, 10, 15, 20, 30] as const;

/**
 * Service d'une agence (maquette v2 17) : nom, nom anglais et lettre groupés, couleur en pastilles, description ;
 * à droite sur ordinateur, durée moyenne en segments, spécialité, limite par jour et options en interrupteurs.
 * Modification : enregistrement automatique. Création : un seul bouton, « Créer le service ».
 */
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
  const editing = !!initial;
  const [createState, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, editing && !disabled);
  const { field, top } = useFormErrors(editing ? saveState.result : createState);
  const [name, setName] = useState(initial?.name ?? "");
  const [prefix, setPrefix] = useState(initial?.prefix ?? "");
  const [prefixTouched, setPrefixTouched] = useState(!!initial);
  const [color, setColor] = useState(initial?.color ?? SERVICE_COLORS.blue);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 10);
  const [otherMinutes, setOtherMinutes] = useState(!QUICK_MINUTES.includes((initial?.minutes ?? 10) as (typeof QUICK_MINUTES)[number]));
  const [flags, setFlags] = useState({
    allowPriority: initial?.allowPriority ?? true,
    allowRemote: initial?.allowRemote ?? true,
    active: initial?.active ?? true,
  });

  const effectivePrefix = prefixTouched ? prefix : name.trim() ? suggestPrefix(name, takenPrefixes) : "";
  const example = /^[A-Z]{1,2}$/.test(effectivePrefix) ? formatTicketCode(effectivePrefix, 1) : "C-001";
  const durationValue = otherMinutes ? "other" : String(minutes);

  return (
    <form
      ref={formRef}
      action={editing ? undefined : formAction}
      onSubmit={editing ? (e) => e.preventDefault() : undefined}
      noValidate
      className="flex flex-col gap-6"
    >
      {editing ? (
        <>
          <input type="hidden" name="autosave" value="1" />
          {disabled ? null : <AutoSaveStatus state={saveState} className="-mb-3" />}
        </>
      ) : (
        <FormError message={top} />
      )}
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-2 @2xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <FormGroup>
              <TextField grouped name="name" label={t("name")} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required error={field("name")} disabled={disabled} />
              <TextField grouped name="nameEn" label={t("nameEn")} placeholder={t("nameEnPlaceholder")} defaultValue={initial?.nameEn ?? ""} lang="en" error={field("nameEn")} disabled={disabled} />
              <TextField
                grouped
                name="prefix"
                label={t("prefix")}
                value={effectivePrefix}
                onChange={(e) => {
                  setPrefixTouched(true);
                  setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2));
                }}
                maxLength={2}
                autoCapitalize="characters"
                error={field("prefix")}
                disabled={disabled}
                className="[&_input]:font-semibold [&_input]:tracking-widest"
              />
            </FormGroup>
            <p className="px-4 text-footnote text-label-secondary">{t("prefixHint", { example })}</p>
          </div>

          <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
            <legend className="px-4 pb-1.5 text-footnote uppercase text-label-secondary">{t("color")}</legend>
            <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-grouped-secondary p-2">
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

          <div className="flex flex-col gap-1.5">
            <span className="px-4 text-footnote uppercase text-label-secondary">{t("description")}</span>
            <FormGroup>
              <TextField grouped name="description" label={t("description")} placeholder={t("descriptionPlaceholder")} defaultValue={initial?.description ?? ""} disabled={disabled} />
            </FormGroup>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span id="service-duration" className="px-4 text-footnote uppercase text-label-secondary">
              {t("duration")}
            </span>
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-grouped-secondary p-2">
              <SegmentedControl
                label={t("duration")}
                value={durationValue}
                onValueChange={(v) => {
                  if (v === "other") return setOtherMinutes(true);
                  setOtherMinutes(false);
                  setMinutes(Number(v));
                }}
                options={[...QUICK_MINUTES.map((m) => ({ value: String(m), label: t("minutes", { count: m }) })), { value: "other", label: t("other") }]}
              />
              {otherMinutes ? (
                <TextField
                  name="defaultMinutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  label={t("otherDuration")}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  error={field("defaultMinutes")}
                  disabled={disabled}
                />
              ) : (
                <input type="hidden" name="defaultMinutes" value={minutes} />
              )}
            </div>
            <p className="px-4 text-footnote text-label-secondary">{t("durationHint")}</p>
          </div>

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
            placeholder={t("noLimit")}
            defaultValue={initial?.maxDailyTickets ?? ""}
            hint={t("quotaHint")}
            error={field("maxDailyTickets")}
            disabled={disabled}
          />

          <ListSection>
            <ListSwitchRow title={t("allowPriority")} subtitle={t("allowPriorityHint")} checked={flags.allowPriority} onCheckedChange={(v) => setFlags({ ...flags, allowPriority: v })} disabled={disabled} />
            <ListSwitchRow title={t("allowRemote")} subtitle={t("allowRemoteHint")} checked={flags.allowRemote} onCheckedChange={(v) => setFlags({ ...flags, allowRemote: v })} disabled={disabled} />
            <ListSwitchRow title={t("active")} checked={flags.active} onCheckedChange={(v) => setFlags({ ...flags, active: v })} disabled={disabled} />
          </ListSection>
        </div>
      </div>
      <input type="hidden" name="allowPriority" value={String(flags.allowPriority)} />
      <input type="hidden" name="allowRemote" value={String(flags.allowRemote)} />
      <input type="hidden" name="active" value={String(flags.active)} />
      <input type="hidden" name="sortOrder" value={sortOrder ?? 0} />

      {disabled || editing ? null : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
            {t("create")}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}
