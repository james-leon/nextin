"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/(auth)/actions";
import { TotpCodeField } from "@/components/security/totp-code-field";
import { Button } from "@/components/ui/button";
import { verifyTotpCode } from "@/lib/auth/mfa-client";
import { AuthHeader } from "./auth-header";
import { FormError } from "./form-error";

/**
 * Code de double authentification (B5) : après le mot de passe, ou avant une action sensible (export).
 * Un seul champ, une seule action ; « Se déconnecter » pour changer de compte.
 */
export function MfaChallengeForm({ next }: { next: string }) {
  const t = useTranslations("mfa");
  const te = useTranslations("errors");
  const router = useRouter();
  const [error, action, pending] = useActionState(async (_prev: string | null, data: FormData) => {
    const result = await verifyTotpCode(String(data.get("code") ?? ""));
    if (result === "no_factor") return "mfa_required";
    if (result === "invalid") return "mfa_code_invalid";
    // Export : téléchargement par navigation complète ; pages : navigation de l'application.
    if (next.includes("/export")) window.location.assign(next);
    else router.replace(next);
    router.refresh();
    return null;
  }, null);
  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title={t("challengeTitle")} subtitle={t("challengeBody")} />
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormError message={error ? te(error) : null} />
        <TotpCodeField label={t("codeLabel")} error={error === "mfa_code_invalid" ? te(error) : undefined} autoFocus />
        <Button type="submit" block loading={pending} loadingLabel={t("verifying")}>
          {t("verify")}
        </Button>
      </form>
      <form action={signOut}>
        <Button type="submit" block variant="plain">
          {t("signOut")}
        </Button>
      </form>
    </div>
  );
}
