"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { requestLoginCode, signInWithPassword, verifyLoginCode } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Turnstile } from "@/components/security/turnstile";
import { FormError } from "./form-error";
import { PasswordField } from "./password-field";

type Mode = "password" | "code";

export function LoginForm({ next, siteKey, initialError }: { next: string; siteKey: string | null; initialError?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [mode, setMode] = useState<Mode>("password");
  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, null);
  const [reqState, reqAction, reqPending] = useActionState(requestLoginCode, null);
  const [codeState, codeAction, codePending] = useActionState(verifyLoginCode, null);

  const field = (state: typeof pwState, name: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[name] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = (state: typeof pwState) => (state && !state.ok && !state.fieldErrors ? te(state.error) : null);

  const codeSentTo = reqState?.ok ? reqState.email : undefined;
  // Un jeton Turnstile ne sert qu'une fois : nouveau widget après chaque tentative.
  const captchaKey = `${mode}-${pwPending}-${reqPending}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-large-title font-bold">{t("loginTitle")}</h1>
        <p className="text-body text-label-secondary">{t("loginSubtitle")}</p>
      </header>

      {mode === "password" ? (
        <form action={pwAction} className="flex flex-col gap-5" noValidate>
          <FormError message={topError(pwState) ?? (initialError ? te(initialError as never) : null)} />
          <input type="hidden" name="next" value={next} />
          <TextField
            name="email"
            type="email"
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            inputMode="email"
            required
            error={field(pwState, "email")}
          />
          <PasswordField
            label={t("password")}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            autoComplete="current-password"
            error={field(pwState, "password")}
          />
          <Turnstile key={captchaKey} siteKey={siteKey} action="login" />
          <Button type="submit" block loading={pwPending} loadingLabel={t("signingIn")}>
            {t("signIn")}
          </Button>
          <Button type="button" variant="plain" block onClick={() => setMode("code")}>
            {t("useCode")}
          </Button>
        </form>
      ) : codeSentTo ? (
        <form action={codeAction} className="flex flex-col gap-5" noValidate>
          <p role="status" className="text-body">
            {t("codeSent", { email: codeSentTo })}
          </p>
          <FormError message={topError(codeState)} />
          <input type="hidden" name="email" value={codeSentTo} />
          <input type="hidden" name="next" value={next} />
          <TextField
            name="code"
            label={t("code")}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            error={field(codeState, "code")}
            className="[&_input]:text-center [&_input]:text-title2 [&_input]:font-semibold [&_input]:tracking-[0.4em]"
          />
          <Button type="submit" block loading={codePending}>
            {t("verifyCode")}
          </Button>
          <Button type="button" variant="plain" block onClick={() => setMode("password")}>
            {t("usePassword")}
          </Button>
        </form>
      ) : (
        <form action={reqAction} className="flex flex-col gap-5" noValidate>
          <FormError message={topError(reqState)} />
          <TextField
            name="email"
            type="email"
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            inputMode="email"
            required
            error={field(reqState, "email")}
          />
          <Turnstile key={captchaKey} siteKey={siteKey} action="login_code" />
          <Button type="submit" block loading={reqPending} loadingLabel={t("sendingCode")}>
            {t("sendCode")}
          </Button>
          <Button type="button" variant="plain" block onClick={() => setMode("password")}>
            {t("usePassword")}
          </Button>
        </form>
      )}

      <p className="text-center text-subheadline text-label-secondary">
        {t("noAccount")}{" "}
        <Link
          href={`/signup${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="inline-flex min-h-11 items-center font-semibold text-accent-text"
        >
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
