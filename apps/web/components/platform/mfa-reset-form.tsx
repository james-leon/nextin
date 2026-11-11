"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetAccountMfa } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

/** Console (B5) : réinitialisation de la double authentification d'un compte, avec motif (journalisée par la base). */
export function MfaResetForm() {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState(resetAccountMfa, null);
  const { field, top } = useFormErrors(state);
  return (
    <section aria-labelledby="mfa-reset-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-4">
        <h2 id="mfa-reset-title" className="text-title3 font-bold">
          {t("settingsFields.mfaResetTitle")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("settingsFields.mfaResetFooter")}</p>
      </div>
      <form action={action} noValidate className="flex flex-col gap-4">
        <FormError message={top} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField name="email" type="email" inputMode="email" autoComplete="off" label={t("settingsFields.mfaResetEmail")} required error={field("email")} />
          <TextField name="reason" label={t("settingsFields.mfaResetReason")} maxLength={300} required error={field("reason")} />
        </div>
        <Button type="submit" variant="gray" className="self-start" loading={pending}>
          {t("settingsFields.mfaResetSubmit")}
        </Button>
      </form>
    </section>
  );
}
