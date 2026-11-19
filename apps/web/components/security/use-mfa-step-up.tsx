"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { ActionResult } from "@/lib/auth/errors";
import { verifyTotpCode } from "@/lib/auth/mfa-client";
import { CodeBoxes } from "@/components/ui/code-boxes";

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
  const [code, setCode] = useState("");
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
    setCode("");
    const verified = await new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
    return verified ? action() : first;
  }, []);

  // Validée toute seule au 6e chiffre (maquette v2 22) ; un code faux vide les cases.
  const submit = async (value: string) => {
    setPending(true);
    const result = await verifyTotpCode(value);
    setPending(false);
    if (result === "ok") return close(true);
    setCode("");
    setError(result === "no_factor" ? "no_factor" : "mfa_code_invalid");
  };

  const dialog = (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close(false))}
      title={t("stepUpTitle")}
      description={t("stepUpBody")}
      closeLabel={t("cancel")}
      cancelLabel={t("cancel")}
      titleHidden
      footer={
        error === "no_factor" ? (
          <Button asChild block>
            <Link href="/app/settings/security">{t("configure")}</Link>
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-3 pt-2 pb-4 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-[16px] bg-accent-tint text-accent-on-tint">
          <Lock className="size-7 stroke-[1.75]" />
        </span>
        <h2 className="text-title2 font-bold [text-wrap:balance]">{t("stepUpTitle")}</h2>
        <p className="text-subheadline text-label-secondary">{t("stepUpBody")}</p>
        <FormError message={error === "no_factor" ? t("notEnrolled") : null} />
        <div className="w-full pt-2" aria-busy={pending}>
          <CodeBoxes
            label={t("codeLabel")}
            value={code}
            autoFocus
            onValueChange={(v) => {
              setCode(v);
              setError(null);
              if (v.length === 6 && !pending) void submit(v);
            }}
            error={error === "mfa_code_invalid" ? te(error) : undefined}
          />
        </div>
      </div>
    </Sheet>
  );

  return { run, dialog };
}
