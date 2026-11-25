"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { CopyButton } from "@/components/admin/copy-button";
import { QrImage } from "@/components/admin/qr-image";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CodeBoxes } from "@/components/ui/code-boxes";
import { ListRow, ListSection } from "@/components/ui/list";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";

type Enrollment = { factorId: string; secret: string; uri: string };
type SetupError = "generic" | "mfa_code_invalid" | "mfa_required";

/** Clé de configuration en blocs de quatre caractères (lecture et saisie à la main). */
const groupKey = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/** Grande icône du cadenas (bleue à configurer, verte une fois activée). */
function LockTile({ on }: { on?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-16 items-center justify-center rounded-[18px] [&_svg]:size-8 [&_svg]:stroke-[1.75] ${on ? "bg-green-tint text-green-text" : "bg-accent-tint text-accent-on-tint"}`}
    >
      <Lock />
    </span>
  );
}

/**
 * Double authentification du compte (B5, maquette v2 22) : exigée par le rôle (configurer ou se déconnecter),
 * configuration en trois étapes numérotées avec le QR code et la clé à droite (« Activer » s'allume au 6e chiffre),
 * puis « Activée » (état, désactivation si le rôle le permet). Pas de codes de secours : téléphone perdu = support Wintek.
 */
export function MfaSetup({ enrolled, required, next }: { enrolled: boolean; required: boolean; next: string | null }) {
  const t = useTranslations("mfa");
  const te = useTranslations("errors");
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<SetupError | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
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

  const activate = () =>
    start(async () => {
      if (!enrollment) return;
      const supabase = getSupabaseBrowserClient();
      const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.replace(/\s/g, "") });
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
      <section aria-labelledby="mfa-on" className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <LockTile on />
          <h2 id="mfa-on" className="text-title2 font-bold [text-wrap:balance]">
            {t("enabled")}
          </h2>
          <p className="text-subheadline text-label-secondary">{t("enabledBody")}</p>
        </div>
        <FormError message={error ? te(error) : null} />
        <ListSection footer={required ? t("requiredNoDisable") : t("lostPhone")}>
          <ListRow title={t("state")} detail={<span className="font-semibold text-green-text">{t("on")}</span>} />
          {required ? (
            <ListRow title={t("disableShort")} detail={t("requiredRole")} />
          ) : (
            <ListRow onClick={pending ? undefined : () => setConfirmDisable(true)} title={t("disableShort")} destructive />
          )}
        </ListSection>
        {confirmDisable ? (
          <AlertDialog
            open
            onOpenChange={setConfirmDisable}
            title={t("disableTitle")}
            description={t("disableBody")}
            cancelLabel={t("cancel")}
            actionLabel={t("disableShort")}
            destructive
            onAction={disable}
          />
        ) : null}
      </section>
    );
  }

  if (!enrollment) {
    return (
      <section aria-labelledby="mfa-off" className="flex flex-col items-center gap-3 px-4 py-4 text-center">
        <LockTile />
        <h2 id="mfa-off" className="text-title2 font-bold">
          {t("title")}
        </h2>
        <p className="text-body text-label-secondary">{required ? t("setupRequired") : t("intro")}</p>
        {required ? <p className="text-footnote text-label-secondary">{t("setupHint")}</p> : null}
        <FormError message={error ? te(error) : null} />
        <Button block loading={pending} loadingLabel={t("starting")} onClick={begin} className="mt-2 h-auto min-h-[3.125rem] whitespace-normal py-3">
          {t("start")}
        </Button>
        {required ? (
          <form action={signOut} className="w-full">
            <Button type="submit" variant="plain" block>
              {t("signOut")}
            </Button>
          </form>
        ) : null}
      </section>
    );
  }

  const steps = (
    <ol className="squircle flex flex-col rounded-[var(--radius-lg)] bg-grouped-secondary">
      {[t("step1"), t("step2"), t("step3")].map((label, i) => (
        <li key={label} className={`flex flex-col gap-3 px-4 py-3 ${i ? "hairline-t" : ""}`}>
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-caption font-bold text-white">
              {i + 1}
            </span>
            <p className="text-body">{label}</p>
          </div>
          {i === 2 ? (
            <CodeBoxes
              label={t("codeLabel")}
              value={code}
              onValueChange={(v) => {
                setCode(v);
                setError(null);
              }}
              error={error === "mfa_code_invalid" ? te(error) : undefined}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        activate();
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <p className="px-4 text-subheadline text-label-secondary">{t("intro")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[var(--md-cols)]" style={{ "--md-cols": "minmax(0,1fr) 16rem" } as React.CSSProperties}>
        {steps}
        <div className="squircle flex flex-col items-center gap-2 rounded-[var(--radius-lg)] bg-grouped-secondary p-5 text-center">
          <div className="rounded-[12px] bg-white p-2">
            <QrImage value={enrollment.uri} label={t("qrLabel")} className="size-40" />
          </div>
          <span className="text-footnote text-label-secondary">{t("secretLabel")}</span>
          <code data-testid="mfa-secret" className="rounded-[8px] bg-fill-tertiary px-2.5 py-1 font-mono text-footnote tracking-wider break-all select-all">
            {groupKey(enrollment.secret)}
          </code>
          <CopyButton value={enrollment.secret} label={t("copyKey")} copiedLabel={t("keyCopied")} size="sm" />
        </div>
      </div>
      <FormError message={error && error !== "mfa_code_invalid" ? te(error) : null} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="gray"
          onClick={() => {
            setEnrollment(null);
            setCode("");
          }}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" loading={pending} loadingLabel={t("verifying")} disabled={code.length !== 6}>
          {t("activate")}
        </Button>
      </div>
    </form>
  );
}
