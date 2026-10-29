"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { slugify } from "@nextin/shared";
import { ORG_TYPES } from "@nextin/shared/schemas";
import { createOrganization, requestSignupCode, verifySignupCode } from "@/app/(staff)/app/new/actions";
import { FormError } from "@/components/auth/form-error";
import { Turnstile } from "@/components/security/turnstile";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { OrgTypeIcon } from "@/components/ui/org-type-icon";

type OrgType = (typeof ORG_TYPES)[number];
type Step = "phone" | "code" | "org";
const STEPS: Step[] = ["phone", "code", "org"];

/**
 * Inscription d'un établissement (M10a) : téléphone du directeur, code reçu sur WhatsApp, puis établissement.
 * Une seule action principale par étape, dans la barre du bas.
 */
export function NewOrganizationForm({ siteKey, defaultLocale }: { siteKey: string | null; defaultLocale: "fr" | "en" }) {
  const t = useTranslations("orgNew");
  const te = useTranslations("errors");
  const [step, setStep] = useState<Step>("phone");
  const [verification, setVerification] = useState<{ id: string; phoneMasked: string } | null>(null);
  // Étape suivante dès que le serveur répond (pas d'effet : l'état suit directement la réponse de l'action).
  const [phoneState, phoneAction, phonePending] = useActionState(async (prev: Awaited<ReturnType<typeof requestSignupCode>> | null, data: FormData) => {
    const result = await requestSignupCode(prev, data);
    if (result.ok) {
      setVerification({ id: result.verificationId, phoneMasked: result.phoneMasked });
      setStep("code");
    }
    return result;
  }, null);
  const [codeState, codeAction, codePending] = useActionState(async (prev: Awaited<ReturnType<typeof verifySignupCode>> | null, data: FormData) => {
    const result = await verifySignupCode(prev, data);
    if (result.ok) setStep("org");
    return result;
  }, null);
  const [orgState, orgAction, orgPending] = useActionState(createOrganization, null);

  const index = STEPS.indexOf(step);
  const back = index === 0 ? { href: "/app", label: t("back") } : undefined;

  return (
    <div className="pb-36">
      <NavigationBar title={t("title")} eyebrow={t("stepOf", { step: index + 1, total: STEPS.length })} back={back} />
      <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 pt-3">
        {step === "phone" ? (
          <form id="signup-step" action={phoneAction} noValidate className="flex flex-col gap-7">
            <StepHeader title={t("phoneTitle")} body={t("phoneBody")} />
            <FormError message={phoneState && !phoneState.ok && !phoneState.fieldErrors ? te(phoneState.error) : null} />
            <TextField
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              label={t("phoneLabel")}
              placeholder={t("phonePlaceholder")}
              required
              error={phoneState && !phoneState.ok && phoneState.fieldErrors?.phone ? te("phone_invalid") : undefined}
            />
            <input type="hidden" name="locale" value={defaultLocale} />
            <CalloutCard icon={<Sparkles />} tone="accent">
              {t("trialNote")}
            </CalloutCard>
            <Turnstile key={String(phonePending)} siteKey={siteKey} action="signup_phone" />
          </form>
        ) : null}

        {step === "code" && verification ? (
          <form id="signup-step" action={codeAction} noValidate className="flex flex-col gap-7">
            <StepHeader title={t("codeTitle")} body={t("codeBody", { phone: verification.phoneMasked })} />
            <input type="hidden" name="verificationId" value={verification.id} />
            <TextField
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              label={t("codeLabel")}
              className="[&_input]:tabular [&_input]:tracking-[0.3em]"
              required
              error={codeState && !codeState.ok ? te(codeState.error) : undefined}
            />
            <Button type="button" variant="plain" onClick={() => setStep("phone")}>
              {t("changePhone")}
            </Button>
          </form>
        ) : null}

        {step === "org" && verification ? <OrgStep verificationId={verification.id} defaultLocale={defaultLocale} state={orgState} action={orgAction} /> : null}
      </div>
      <BottomBar>
        <Button
          type="submit"
          form="signup-step"
          block
          loading={phonePending || codePending || orgPending}
          loadingLabel={step === "phone" ? t("sendingCode") : step === "code" ? t("verifying") : t("submitting")}
        >
          {step === "phone" ? t("sendCode") : step === "code" ? t("verify") : t("submit")}
        </Button>
      </BottomBar>
    </div>
  );
}

function StepHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1 px-4">
      <h2 className="text-title2 font-bold">{title}</h2>
      <p className="text-body text-label-secondary">{body}</p>
    </div>
  );
}

function OrgStep({
  verificationId,
  defaultLocale,
  state,
  action,
}: {
  verificationId: string;
  defaultLocale: "fr" | "en";
  state: Awaited<ReturnType<typeof createOrganization>> | null;
  action: (data: FormData) => void;
}) {
  const t = useTranslations("orgNew");
  const tt = useTranslations("orgTypes");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType | "">("");
  const [locale, setLocale] = useState<"fr" | "en">(defaultLocale);
  const fieldError = (f: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[f] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = state && !state.ok && !state.fieldErrors ? te(state.error) : null;
  const typeError = fieldError("type");

  return (
    <form id="signup-step" action={action} noValidate className="flex flex-col gap-7">
      <StepHeader title={t("orgTitle")} body={t("footer")} />
      <FormError message={topError} />
      <input type="hidden" name="verificationId" value={verificationId} />
      <TextField
        name="name"
        label={t("name")}
        placeholder={t("namePlaceholder")}
        hint={name.trim().length >= 2 ? t("identifier", { slug: slugify(name) }) : t("nameHint")}
        autoComplete="organization"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        error={fieldError("name")}
      />

      <div className="flex flex-col gap-1.5">
        <ListSection header={t("sector")} radioGroupLabel={t("sector")}>
          {ORG_TYPES.map((value) => (
            <ListRow
              key={value}
              role="radio"
              selected={type === value}
              onClick={() => setType(value)}
              icon={
                <ListIcon color="var(--brand-tile)">
                  <OrgTypeIcon type={value} />
                </ListIcon>
              }
              title={tt(value)}
              accessory="check"
            />
          ))}
        </ListSection>
        {typeError ? (
          <p role="alert" className="px-4 text-footnote text-red-text">
            {typeError}
          </p>
        ) : null}
        <input type="hidden" name="type" value={type} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="px-4 text-footnote uppercase text-label-secondary">{t("language")}</span>
        <SegmentedControl
          label={t("language")}
          value={locale}
          onValueChange={setLocale}
          options={[
            { value: "fr", label: tc("french") },
            { value: "en", label: tc("english") },
          ]}
        />
        <input type="hidden" name="defaultLocale" value={locale} />
      </div>
    </form>
  );
}
