"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/ui/text-field";
import { AuthHeader } from "./auth-header";
import { FormError } from "./form-error";
import { PasswordField } from "./password-field";

export function ResetPasswordForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(resetPassword, null);
  const field = (name: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[name] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = state && !state.ok && !state.fieldErrors ? te(state.error) : null;
  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title={t("resetTitle")} subtitle={t("resetSubtitle")} />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={topError} />
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <FormGroup>
            <PasswordField
              grouped
              label={t("newPassword")}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
              autoComplete="new-password"
              error={field("password")}
            />
            <PasswordField
              grouped
              name="confirm"
              label={t("confirmPassword")}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
              autoComplete="new-password"
              error={field("confirm")}
            />
          </FormGroup>
          <p className="px-4 text-footnote text-label-secondary">{t("passwordHint")}</p>
        </div>
        <Button type="submit" block loading={pending} loadingLabel={t("resetting")}>
          {t("resetSubmit")}
        </Button>
      </form>
    </div>
  );
}
