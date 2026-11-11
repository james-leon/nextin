"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { ActionResult } from "@/lib/auth/errors";
import { verifyTotpCode } from "@/lib/auth/mfa-client";
import { TotpCodeField } from "./totp-code-field";

const STEP_UP_ERRORS = new Set(["mfa_required", "mfa_recent_required"]);

/**
 * Nouvelle saisie du code de double authentification (B5) avant une action sensible (suppression, changement de
 * rôle) : l'action est tentée ; si la base répond `mfa_recent_required` (ou `mfa_required`), une feuille demande le
 * code, puis l'action est rejouée une fois. `dialog` est à placer dans le rendu du composant.
 */
export function useMfaStepUp(): {
  run: <T extends ActionResult | null | undefined>(action: () => Promise<T>) => Promise<T>;
  dialog: ReactNode;
} {
  const t = useTranslations("mfa");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const close = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const run = useCallback(async <T extends ActionResult | null | undefined>(action: () => Promise<T>): Promise<T> => {
    const first = await action();
    if (!first || first.ok || !STEP_UP_ERRORS.has(first.error)) return first;
    setError(null);
    const verified = await new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
    return verified ? action() : first;
  }, []);

  const submit = async (data: FormData) => {
    setPending(true);
    const result = await verifyTotpCode(String(data.get("code") ?? ""));
    setPending(false);
    if (result === "ok") return close(true);
    setError(result === "no_factor" ? "no_factor" : "mfa_code_invalid");
  };

  const dialog = (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close(false))}
      title={t("stepUpTitle")}
      description={t("stepUpBody")}
      closeLabel={t("cancel")}
      footer={
        error === "no_factor" ? (
          <Button asChild block>
            <Link href="/app/settings/security">{t("configure")}</Link>
          </Button>
        ) : (
          <Button type="submit" form="mfa-step-up" block loading={pending} loadingLabel={t("verifying")}>
            {t("verify")}
          </Button>
        )
      }
    >
      <form id="mfa-step-up" action={submit} noValidate className="flex flex-col gap-4 pt-2">
        <FormError message={error === "no_factor" ? t("notEnrolled") : null} />
        <TotpCodeField label={t("codeLabel")} error={error === "mfa_code_invalid" ? te(error) : undefined} autoFocus />
      </form>
    </Sheet>
  );

  return { run, dialog };
}
