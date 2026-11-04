"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { requestLoginCode, signInWithPassword, verifyLoginCode } from "@/app/(auth)/actions";
import { ArrowRight, Check, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Turnstile } from "@/components/security/turnstile";
import { AuthHeader } from "./auth-header";
import { FormError } from "./form-error";
import { LegalFooter, SecureNotice } from "./legal-footer";
import { PasswordField } from "./password-field";

type Mode = "password" | "code";

export function LoginForm({ next, siteKey, initialError }: { next: string; siteKey: string | null; initialError?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [mode, setMode] = useState<Mode>("password");
  // « Mot de passe oublié ? » : connexion par code e-mail, puis choix d'un nouveau mot de passe.
  const [forgot, setForgot] = useState(false);
  const codeNext = forgot ? `/reset-password?next=${encodeURIComponent(next)}` : next;
  const usePassword = () => {
    setForgot(false);
    setMode("password");
  };
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
      <AuthHeader title={t("loginTitle")} subtitle={t("loginSubtitle")} />

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
            leading={<Mail />}
            required
            error={field(pwState, "email")}
          />
          <PasswordField
            label={t("password")}
            leading={<Lock />}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            autoComplete="current-password"
            error={field(pwState, "password")}
          />
          <div className="-my-1 flex flex-wrap items-center justify-between gap-x-4">
            <RememberMe label={t("rememberMe")} />
            <button
              type="button"
              onClick={() => {
                setForgot(true);
                setMode("code");
              }}
              className="pressable inline-flex min-h-11 items-center text-subheadline font-semibold text-accent-text"
            >
              {t("forgotPassword")}
            </button>
          </div>
          <Turnstile key={captchaKey} siteKey={siteKey} action="login" />
          <Button
            type="submit"
            block
            loading={pwPending}
            loadingLabel={t("signingIn")}
            trailingIcon={<ArrowRight aria-hidden className="size-[1.1em]" />}
          >
            {t("signIn")}
          </Button>
          <SecureNotice />
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
          <input type="hidden" name="next" value={codeNext} />
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
          <Button type="button" variant="plain" block onClick={usePassword}>
            {t("usePassword")}
          </Button>
        </form>
      ) : (
        <form action={reqAction} className="flex flex-col gap-5" noValidate>
          {forgot ? (
            <p role="status" className="text-body text-label-secondary">
              {t("forgotNotice")}
            </p>
          ) : null}
          <FormError message={topError(reqState)} />
          <TextField
            name="email"
            type="email"
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            inputMode="email"
            leading={<Mail />}
            required
            error={field(reqState, "email")}
          />
          <Turnstile key={captchaKey} siteKey={siteKey} action="login_code" />
          <Button type="submit" block loading={reqPending} loadingLabel={t("sendingCode")}>
            {t("sendCode")}
          </Button>
          <Button type="button" variant="plain" block onClick={usePassword}>
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
      <LegalFooter />
    </div>
  );
}

/** Case « Se souvenir de moi » : la case native couvre toute la ligne (cible de 44 px), coche dessinée par jetons. */
function RememberMe({ label }: { label: string }) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-3 text-subheadline text-label">
      <input type="checkbox" name="remember" defaultChecked className="peer absolute inset-0 size-full cursor-pointer opacity-0" />
      <span
        aria-hidden
        className="flex size-[1.375rem] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-label-secondary text-transparent transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]"
      >
        <Check className="size-3.5 stroke-[3]" />
      </span>
      {label}
    </label>
  );
}
