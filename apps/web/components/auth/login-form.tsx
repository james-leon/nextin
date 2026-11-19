"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Clock } from "lucide-react";
import { requestLoginCode, signInWithPassword, verifyLoginCode } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { CodeBoxes } from "@/components/ui/code-boxes";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { Turnstile } from "@/components/security/turnstile";
import { AuthHeader } from "./auth-header";
import { FormError } from "./form-error";
import { LegalFooter } from "./legal-footer";
import { PasswordField } from "./password-field";

type Mode = "password" | "code";
type CodeRequest = Awaited<ReturnType<typeof requestLoginCode>>;

/** Délai avant de pouvoir redemander un code (le fournisseur d'e-mails limite les envois). */
const RESEND_DELAY_MS = 45_000;

/**
 * Connexion du personnel (maquette v2 04) : adresse et mot de passe dans une liste groupée, une seule action en bleu
 * nuit (« Se connecter »), le code par e-mail en bouton teinté. Le code sert aussi au mot de passe oublié.
 */
export function LoginForm({ next, siteKey, initialError }: { next: string; siteKey: string | null; initialError?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [mode, setMode] = useState<Mode>("password");
  // « Mot de passe oublié ? » : connexion par code e-mail, puis choix d'un nouveau mot de passe.
  const [forgot, setForgot] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const codeNext = forgot ? `/reset-password?next=${encodeURIComponent(next)}` : next;
  const usePassword = () => {
    setForgot(false);
    setMode("password");
  };
  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, null);
  // L'heure d'envoi suit directement la réponse de l'action (pas d'effet) : elle relance le compte à rebours.
  const [reqState, reqAction, reqPending] = useActionState(async (prev: CodeRequest | null, data: FormData) => {
    const result = await requestLoginCode(prev, data);
    if (result.ok) setSentAt(Date.now());
    return result;
  }, null);
  const [codeState, codeAction, codePending] = useActionState(verifyLoginCode, null);

  const field = (state: typeof pwState, name: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[name] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = (state: typeof pwState) => (state && !state.ok && !state.fieldErrors ? te(state.error) : null);

  const codeSentTo = reqState?.ok ? reqState.email : undefined;
  // Un jeton Turnstile ne sert qu'une fois : nouveau widget après chaque tentative.
  const captchaKey = `${mode}-${pwPending}-${reqPending}`;

  if (mode === "code" && codeSentTo) {
    return (
      <div className="flex flex-col gap-6">
        <AuthHeader title={t("codeTitle")} subtitle={<span role="status">{t("codeSent", { email: codeSentTo })}</span>} />
        <form action={codeAction} className="flex flex-col gap-5" noValidate>
          <FormError message={topError(codeState)} />
          <input type="hidden" name="email" value={codeSentTo} />
          <input type="hidden" name="next" value={codeNext} />
          <CodeBoxes label={t("code")} error={field(codeState, "code")} autoFocus />
          <Button type="submit" block loading={codePending}>
            {t("verifyCode")}
          </Button>
        </form>
        <form action={reqAction} className="flex flex-col items-center gap-1 text-center" noValidate>
          <input type="hidden" name="email" value={codeSentTo} />
          <p className="text-footnote text-label-secondary">{t("codeSpam")}</p>
          <ResendButton sentAt={sentAt} pending={reqPending} />
          <Turnstile key={captchaKey} siteKey={siteKey} action="login_code" />
        </form>
        <Button type="button" variant="plain" block onClick={usePassword}>
          {t("usePassword")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title={t("loginTitle")} subtitle={t("loginSubtitle")} />

      {mode === "password" ? (
        <form action={pwAction} className="flex flex-col gap-4" noValidate>
          {/* Session fermée après inactivité (console Wintek) : bandeau bleu informatif, pas une erreur (maquette v2 22). */}
          {initialError === "session_expired" && !topError(pwState) ? (
            <CalloutCard icon={<Clock />} tone="accent" role="status">
              {te("session_expired")}
            </CalloutCard>
          ) : (
            <FormError message={topError(pwState) ?? (initialError ? te(initialError as never) : null)} />
          )}
          <input type="hidden" name="next" value={next} />
          <FormGroup>
            <TextField
              grouped
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
              grouped
              label={t("password")}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
              autoComplete="current-password"
              error={field(pwState, "password")}
            />
          </FormGroup>
          <div className="-my-1 flex flex-wrap items-center justify-between gap-x-4">
            <RememberMe label={t("rememberMe")} />
            <button
              type="button"
              onClick={() => {
                setForgot(true);
                setMode("code");
              }}
              className="pressable inline-flex min-h-11 items-center text-subheadline text-accent-text"
            >
              {t("forgotPassword")}
            </button>
          </div>
          <Turnstile key={captchaKey} siteKey={siteKey} action="login" />
          <Button type="submit" block loading={pwPending} loadingLabel={t("signingIn")}>
            {t("signIn")}
          </Button>
          <Button type="button" variant="tinted" block onClick={() => setMode("code")}>
            {t("useCode")}
          </Button>
        </form>
      ) : (
        <form action={reqAction} className="flex flex-col gap-4" noValidate>
          {forgot ? (
            <p role="status" className="text-body text-label-secondary">
              {t("forgotNotice")}
            </p>
          ) : null}
          <FormError message={topError(reqState)} />
          <FormGroup>
            <TextField
              grouped
              name="email"
              type="email"
              label={t("email")}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              inputMode="email"
              required
              error={field(reqState, "email")}
            />
          </FormGroup>
          <Turnstile key={captchaKey} siteKey={siteKey} action="login_code" />
          <Button type="submit" block loading={reqPending} loadingLabel={t("sendingCode")}>
            {t("sendCode")}
          </Button>
          <Button type="button" variant="plain" block onClick={usePassword}>
            {t("usePassword")}
          </Button>
        </form>
      )}

      <p className="text-subheadline text-label-secondary">
        {t("noAccount")}{" "}
        <Link
          href={`/signup${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="inline-flex min-h-11 items-center text-accent-text"
        >
          {t("createSpace")}
        </Link>
      </p>
      <LegalFooter />
    </div>
  );
}

/** « Renvoyer le code » : désactivé pendant 45 s après chaque envoi, avec le temps restant (« dans 0:42 »). */
function ResendButton({ sentAt, pending }: { sentAt: number; pending: boolean }) {
  const t = useTranslations("auth");
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.min(RESEND_DELAY_MS / 1000, Math.max(0, Math.ceil((sentAt + RESEND_DELAY_MS - now) / 1000)));
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <Button type="submit" variant="plain" size="md" disabled={remaining > 0} loading={pending}>
      {remaining > 0 ? t("resendIn", { time }) : t("resend")}
    </Button>
  );
}

/** Case « Se souvenir de moi » : la case native couvre toute la ligne (cible de 44 px), coche dessinée par jetons. */
function RememberMe({ label }: { label: string }) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-3 text-subheadline text-label">
      <input type="checkbox" name="remember" defaultChecked className="peer absolute inset-0 size-full cursor-pointer opacity-0" />
      <span
        aria-hidden
        className="flex size-[1.375rem] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-label-secondary text-transparent transition-colors duration-200 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-accent peer-focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]"
      >
        <Check className="size-3.5 stroke-[3]" />
      </span>
      {label}
    </label>
  );
}
