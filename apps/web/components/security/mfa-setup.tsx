"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { QrImage } from "@/components/admin/qr-image";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TotpCodeField } from "./totp-code-field";

type Enrollment = { factorId: string; secret: string; uri: string };
type SetupError = "generic" | "mfa_code_invalid" | "mfa_required";

/**
 * Double authentification du compte (B5) : enregistrement d'un code TOTP (QR code dessiné par l'application, clé
 * à saisir à la main en secours), puis vérification ; désactivation si le rôle ne l'exige pas.
 */
export function MfaSetup({ enrolled, required, next }: { enrolled: boolean; required: boolean; next: string | null }) {
  const t = useTranslations("mfa");
  const te = useTranslations("errors");
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<SetupError | null>(null);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setError(null);
      const supabase = getSupabaseBrowserClient();
      // Facteurs abandonnés (non vérifiés) : supprimés avant d'en créer un nouveau.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `NextIn ${Date.now()}` });
      if (e || !data) return setError("generic");
      setEnrollment({ factorId: data.id, secret: data.totp.secret, uri: data.totp.uri });
    });

  const activate = (formData: FormData) =>
    start(async () => {
      if (!enrollment) return;
      const supabase = getSupabaseBrowserClient();
      const code = String(formData.get("code") ?? "").replace(/\s/g, "");
      const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
      if (e) return setError("mfa_code_invalid");
      router.replace(next ?? "/app/settings/security");
      router.refresh();
    });

  const disable = () =>
    start(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.totp ?? []) {
        const { error: e } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (e) return setError("mfa_required");
      }
      await supabase.auth.refreshSession();
      router.refresh();
    });

  if (enrolled) {
    return (
      <div className="flex flex-col gap-5">
        <CalloutCard icon={<CheckCircle2 />} tone="green" role="status">
          <span className="block font-semibold">{t("enabled")}</span>
          {t("enabledBody")}
        </CalloutCard>
        <FormError message={error ? te(error) : null} />
        {required ? (
          <p className="px-4 text-footnote text-label-secondary">{t("requiredNoDisable")}</p>
        ) : (
          <AlertDialog
            trigger={
              <Button variant="destructive-plain" block loading={pending}>
                {t("disable")}
              </Button>
            }
            title={t("disableTitle")}
            description={t("disableBody")}
            cancelLabel={t("cancel")}
            actionLabel={t("disable")}
            destructive
            onAction={disable}
          />
        )}
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-5">
        {required ? (
          <CalloutCard icon={<ShieldCheck />} tone="accent" role="status">
            {t("setupRequired")}
          </CalloutCard>
        ) : null}
        <p className="px-4 text-body text-label-secondary">{t("intro")}</p>
        <FormError message={error ? te(error) : null} />
        <Button block loading={pending} loadingLabel={t("starting")} onClick={begin}>
          {t("start")}
        </Button>
      </div>
    );
  }

  return (
    <form action={activate} noValidate className="flex flex-col gap-6">
      <ol className="flex flex-col gap-5">
        <li className="flex flex-col gap-1 px-4">
          <span className="text-headline">1</span>
          <p className="text-body text-label-secondary">{t("step1")}</p>
        </li>
        <li className="flex flex-col gap-3 px-4">
          <span className="text-headline">2</span>
          <p className="text-body text-label-secondary">{t("step2")}</p>
          <div className="squircle self-center rounded-[var(--radius-xl)] bg-white p-4 shadow-card">
            <QrImage value={enrollment.uri} label={t("qrLabel")} className="size-48" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-footnote uppercase text-label-secondary">{t("secretLabel")}</span>
            <code data-testid="mfa-secret" className="text-callout break-all tabular select-all">
              {enrollment.secret}
            </code>
          </div>
        </li>
        <li className="flex flex-col gap-3 px-4">
          <span className="text-headline">3</span>
          <p className="text-body text-label-secondary">{t("step3")}</p>
        </li>
      </ol>
      <FormError message={error && error !== "mfa_code_invalid" ? te(error) : null} />
      <TotpCodeField label={t("codeLabel")} error={error === "mfa_code_invalid" ? te(error) : undefined} />
      <Button type="submit" block loading={pending} loadingLabel={t("verifying")}>
        {t("activate")}
      </Button>
    </form>
  );
}
