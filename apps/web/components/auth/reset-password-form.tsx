"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { passwordProgress, passwordRules } from "@nextin/shared";
import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { AuthHeader } from "./auth-header";
import { FormError } from "./form-error";
import { PasswordField } from "./password-field";

/**
 * Nouveau mot de passe (maquette v2 22) : deux champs groupés, barre de progression et règles cochées pendant la
 * saisie (grises tant qu'elles ne sont pas remplies, jamais de rouge pendant la frappe) ; le bouton reste grisé tant
 * que toutes ne sont pas vertes. Le serveur revérifie les mêmes règles (`passwordSchema`).
 */
export function ResetPasswordForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(resetPassword, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const rules = passwordRules(password, confirm);
  const ready = rules.length && rules.mix && rules.match;
  const field = (name: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[name] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = state && !state.ok && !state.fieldErrors ? te(state.error) : null;
  const items = [
    { ok: rules.length, label: t("ruleLength") },
    { ok: rules.mix, label: t("ruleMix") },
    { ok: rules.match, label: t("ruleMatch") },
  ];
  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title={t("resetTitle")} subtitle={t("resetSubtitle")} />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={topError} />
        <input type="hidden" name="next" value={next} />
        <FormGroup>
          <PasswordField
            grouped
            label={t("newPassword")}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            autoComplete="new-password"
            error={field("password")}
            value={password}
            onValueChange={setPassword}
          />
          <PasswordField
            grouped
            name="confirm"
            label={t("confirmPassword")}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            autoComplete="new-password"
            error={field("confirm")}
            value={confirm}
            onValueChange={setConfirm}
          />
        </FormGroup>
        <div className="flex flex-col gap-2 px-1">
          <div aria-hidden className="h-1 overflow-hidden rounded-full bg-fill-tertiary">
            <div
              className="h-full rounded-full bg-green"
              style={{ width: `${Math.round(passwordProgress(rules) * 100)}%`, transition: "width 300ms var(--ease-spring)" }}
            />
          </div>
          <ul aria-label={t("passwordRules")} className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.label} className={cn("flex items-start gap-2 text-footnote", item.ok ? "text-label" : "text-label-secondary")}>
                <Check aria-hidden className={cn("mt-0.5 size-3.5 shrink-0 stroke-[2.5]", item.ok ? "text-green-text" : "text-label-tertiary")} />
                <span>
                  {item.label}
                  <span className="sr-only"> · {item.ok ? t("ruleOk") : t("ruleTodo")}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Button type="submit" block loading={pending} loadingLabel={t("resetting")} disabled={!ready}>
          {t("resetSubmit")}
        </Button>
        <Link href="/login" className="mx-auto inline-flex min-h-11 items-center text-subheadline font-semibold text-accent-text">
          {t("backToLogin")}
        </Link>
      </form>
    </div>
  );
}
