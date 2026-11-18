"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SelectField } from "@/components/ui/select-field";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
import { useFormErrors } from "./use-form-errors";

export type PractitionerInitial = { title: string | null; displayName: string; specialtyId: string | null; branchId: string; active: boolean };

/**
 * Fiche d'un praticien (maquette v2 18) : titre et nom groupés, spécialité, agence, « En activité ».
 * Modification : enregistrement automatique ; création : un seul bouton.
 */
export function PractitionerForm({
  action,
  initial,
  specialties,
  branches,
  disabled,
}: {
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  initial?: PractitionerInitial;
  specialties: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const t = useTranslations("practitioners");
  const ta = useTranslations("admin");
  const editing = !!initial;
  const [createState, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, editing && !disabled);
  const { field, top } = useFormErrors(editing ? saveState.result : createState);
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <form
      ref={formRef}
      action={editing ? undefined : formAction}
      onSubmit={editing ? (e) => e.preventDefault() : undefined}
      noValidate
      className="flex flex-col gap-5"
    >
      {editing ? (
        <>
          <input type="hidden" name="autosave" value="1" />
          {disabled ? null : <AutoSaveStatus state={saveState} className="-mb-3" />}
        </>
      ) : (
        <FormError message={top} />
      )}
      <FormGroup>
        <TextField grouped name="title" label={t("titleField")} placeholder={t("titlePlaceholder")} defaultValue={initial?.title ?? ""} disabled={disabled} />
        <TextField grouped name="displayName" label={t("displayName")} placeholder={t("displayNamePlaceholder")} defaultValue={initial?.displayName} required error={field("displayName")} disabled={disabled} />
      </FormGroup>
      <SelectField
        name="specialtyId"
        label={t("specialty")}
        defaultValue={initial?.specialtyId ?? ""}
        options={[{ value: "", label: ta("none") }, ...specialties.map((s) => ({ value: s.id, label: s.name }))]}
        disabled={disabled}
      />
      <SelectField
        name="branchId"
        label={t("branch")}
        defaultValue={initial?.branchId ?? branches[0]?.id}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
        error={field("branchId")}
        disabled={disabled}
      />
      <ListSection>
        <ListSwitchRow title={t("active")} checked={active} onCheckedChange={setActive} disabled={disabled} />
      </ListSection>
      <input type="hidden" name="active" value={String(active)} />
      {disabled || editing ? null : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
            {ta("save")}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}
