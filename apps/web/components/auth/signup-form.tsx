"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { signUp } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Turnstile } from "@/components/security/turnstile";
import { FormError } from "./form-error";
import { PasswordField } from "./password-field";

export function SignupForm({ next, siteKey }: { next: string; siteKey: string | null }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(signUp, null);

  if (state?.ok && state.checkEmail) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 pt-6 text-center">
        <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint">
          <MailCheck aria-hidden className="size-8 stroke-[1.75]" />
        </span>
        <h1 className="text-title1 font-bold">{t("checkEmailTitle")}</h1>
        <p className="text-body text-label-secondary">{t("checkEmailBody", { email: state.checkEmail })}</p>
      </div>
    );
  }

  const field = (name: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[name] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = state && !state.ok && !state.fieldErrors ? te(state.error) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-large-title font-bold">{t("signupTitle")}</h1>
        <p className="text-body text-label-secondary">{t("signupSubtitle")}</p>
      </header>
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormError message={topError} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="locale" value={locale} />
        <TextField
          name="fullName"
          label={t("fullName")}
          placeholder={t("fullNamePlaceholder")}
          autoComplete="name"
          required
          error={field("fullName")}
        />
        <TextField
          name="email"
          type="email"
          label={t("email")}
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          inputMode="email"
          required
          error={field("email")}
        />
        <PasswordField
          label={t("password")}
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          hint={t("passwordHint")}
          autoComplete="new-password"
          error={field("password")}
        />
        <Turnstile key={String(pending)} siteKey={siteKey} action="signup" />
        <Button type="submit" block loading={pending} loadingLabel={t("signingUp")}>
          {t("signUp")}
        </Button>
      </form>
      <p className="text-center text-subheadline text-label-secondary">
        {t("haveAccount")}{" "}
        <Link
          href={`/login${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="inline-flex min-h-11 items-center font-semibold text-accent-text"
        >
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
