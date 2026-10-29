"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useFormErrors } from "./use-form-errors";

export function SpecialtyForm({ action }: { action: (p: ActionResult | null, d: FormData) => Promise<ActionResult> }) {
  const t = useTranslations("practitioners");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4">
      <h3 className="text-headline">{t("newSpecialty")}</h3>
      <FormError message={top} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField name="name" label={t("specialtyName")} placeholder={t("specialtyNamePlaceholder")} required error={field("name")} className="[&_input]:bg-grouped-tertiary" />
        <TextField name="nameEn" label={t("specialtyNameEn")} lang="en" className="[&_input]:bg-grouped-tertiary" />
      </div>
      <Button type="submit" variant="tinted" loading={pending} leadingIcon={<Plus aria-hidden className="size-5" />}>
        {ta("add")}
      </Button>
    </form>
  );
}
