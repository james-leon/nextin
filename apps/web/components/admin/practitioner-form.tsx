"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { useFormErrors } from "./use-form-errors";

export type PractitionerInitial = { title: string | null; displayName: string; specialtyId: string | null; branchId: string; active: boolean };

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
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FormError message={top} />
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <TextField name="title" label={t("titleField")} placeholder={t("titlePlaceholder")} defaultValue={initial?.title ?? ""} disabled={disabled} />
        <TextField name="displayName" label={t("displayName")} placeholder={t("displayNamePlaceholder")} defaultValue={initial?.displayName} required error={field("displayName")} disabled={disabled} />
      </div>
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
