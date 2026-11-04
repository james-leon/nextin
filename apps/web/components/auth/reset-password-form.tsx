"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
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
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormError message={topError} />
        <input type="hidden" name="next" value={next} />
        <PasswordField
          label={t("newPassword")}
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          hint={t("passwordHint")}
          autoComplete="new-password"
          leading={<Lock />}
          error={field("password")}
        />
        <PasswordField
          name="confirm"
          label={t("confirmPassword")}
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          autoComplete="new-password"
          leading={<Lock />}
          error={field("confirm")}
        />
        <Button type="submit" block loading={pending} loadingLabel={t("resetting")}>
          {t("resetSubmit")}
        </Button>
      </form>
    </div>
  );
}
