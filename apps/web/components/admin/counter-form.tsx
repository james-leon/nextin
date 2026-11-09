"use client";

import { useActionState, useState } from "react";
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
import { TextField } from "@/components/ui/text-field";
import { useFormErrors } from "./use-form-errors";

export type CounterInitial = {
  kind: CounterKind;
  number: number;
  label: string | null;
  defaultPractitionerId: string | null;
  serviceIds: string[];
  active: boolean;
};

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
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const [kind, setKind] = useState<CounterKind>(initial?.kind ?? "guichet");
  const [number, setNumber] = useState<number>(initial?.number ?? nextNumbers.guichet);
  const [selected, setSelected] = useState<string[]>(initial?.serviceIds ?? (services.length === 1 ? [services[0]!.id] : []));
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
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
      <TextField
        name="number"
        type="number"
        inputMode="numeric"
        min={1}
        max={999}
        label={t("number")}
        value={number}
        onChange={(e) => setNumber(Number(e.target.value))}
        hint={t("numberHint", { example: `${tk(kind)} ${number || 1}` })}
        error={field("number")}
        disabled={disabled}
      />
      <TextField name="label" label={t("label")} placeholder={t("labelPlaceholder")} defaultValue={initial?.label ?? ""} disabled={disabled} />
      {practitioners.length ? (
        <SelectField
          name="defaultPractitionerId"
          label={t("practitioner")}
          defaultValue={initial?.defaultPractitionerId ?? ""}
          options={[{ value: "", label: ta("none") }, ...practitioners.map((p) => ({ value: p.id, label: p.name }))]}
          disabled={disabled}
        />
      ) : null}

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

      <ListSection>
        <ListSwitchRow title={t("active")} checked={active} onCheckedChange={setActive} disabled={disabled} />
      </ListSection>
      <input type="hidden" name="active" value={String(active)} />

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
