"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { COUNTER_KINDS, type CounterKind } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { ServiceTile } from "@/components/ui/service-tile";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
import { useFormErrors } from "./use-form-errors";

export type CounterInitial = {
  kind: CounterKind;
  number: number;
  label: string | null;
  defaultPractitionerId: string | null;
  serviceIds: string[];
  active: boolean;
};

/**
 * Guichet ou cabinet (maquette v2 17) : type en segments, numéro et nom affiché groupés, praticien attitré et état
 * « en service » ; à droite sur ordinateur, les services traités cochés dans une liste. Le type et le numéro forment
 * ce qui est annoncé et affiché sur la TV. Modification : enregistrement automatique ; création : « Créer le poste ».
 */
export function CounterForm({
  action,
  initial,
  nextNumbers,
  services,
  practitioners,
  disabled,
}: {
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  initial?: CounterInitial;
  /** Prochain numéro libre par type (création). */
  nextNumbers: Record<CounterKind, number>;
  services: { id: string; name: string; prefix: string; color: string }[];
  practitioners: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const t = useTranslations("counters");
  const tk = useTranslations("counterKinds");
  const ta = useTranslations("admin");
  const editing = !!initial;
  const [createState, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, editing && !disabled);
  const { field, top } = useFormErrors(editing ? saveState.result : createState);
  const [kind, setKind] = useState<CounterKind>(initial?.kind ?? "guichet");
  const [number, setNumber] = useState<number>(initial?.number ?? nextNumbers.guichet);
  const [selected, setSelected] = useState<string[]>(initial?.serviceIds ?? (services.length === 1 ? [services[0]!.id] : []));
  const [active, setActive] = useState(initial?.active ?? true);

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
      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="px-4 pb-1.5 text-footnote uppercase text-label-secondary">{t("kind")}</legend>
        <SegmentedControl<CounterKind>
          label={t("kind")}
          value={kind}
          onValueChange={(k) => {
            setKind(k);
            if (!initial) setNumber(nextNumbers[k]);
          }}
          options={COUNTER_KINDS.map((k) => ({ value: k, label: tk(k) }))}
          className="[&_button]:px-1 [&_button]:text-footnote sm:[&_button]:text-subheadline"
        />
        <input type="hidden" name="kind" value={kind} />
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <FormGroup>
          <TextField
            grouped
            name="number"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            label={t("number")}
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
            error={field("number")}
            disabled={disabled}
          />
          <TextField grouped name="label" label={t("label")} placeholder={t("labelPlaceholder")} defaultValue={initial?.label ?? ""} disabled={disabled} />
        </FormGroup>
        <p className="px-4 text-footnote text-label-secondary">{t("numberHint", { example: `${tk(kind)} ${number || 1}` })}</p>
      </div>
      {practitioners.length ? (
        <SelectField
          name="defaultPractitionerId"
          label={t("practitioner")}
          defaultValue={initial?.defaultPractitionerId ?? ""}
          options={[{ value: "", label: ta("none") }, ...practitioners.map((p) => ({ value: p.id, label: p.name }))]}
          disabled={disabled}
        />
      ) : null}
      <ListSection>
        <ListSwitchRow title={t("active")} checked={active} onCheckedChange={setActive} disabled={disabled} />
      </ListSection>
      <input type="hidden" name="active" value={String(active)} />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
      <ListSection header={t("services")} footer={services.length ? t("servicesHint") : t("noServices")} checkboxGroupLabel={t("services")}>
        {services.map((s) => {
          const checked = selected.includes(s.id);
          return (
            <ListRow
              key={s.id}
              role="checkbox"
              selected={checked}
              onClick={() => !disabled && setSelected((all) => (checked ? all.filter((x) => x !== s.id) : [...all, s.id]))}
              icon={<ServiceTile letter={s.prefix} color={s.color} />}
              title={s.name}
              accessory="check"
            />
          );
        })}
      </ListSection>
      {selected.map((id) => (
        <input key={id} type="hidden" name="serviceIds" value={id} />
      ))}
      </div>
      </div>

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
