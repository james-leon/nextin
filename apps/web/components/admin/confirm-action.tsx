"use client";

import { useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Bouton d'action à confirmer (suppression, régénération…) : alerte iOS, puis action serveur.
 * Une erreur éventuelle est affichée en notification ; un succès redirige (géré par l'action).
 */
export function ConfirmAction({
  action,
  label,
  title,
  body,
  confirmLabel,
  destructive = true,
  variant = "destructive-plain",
  block = true,
  size = "lg",
  icon,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  variant?: ButtonProps["variant"];
  block?: boolean;
  size?: ButtonProps["size"];
  icon?: ReactNode;
}) {
  const tc = useTranslations("admin");
  const te = useTranslations("errors");
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <AlertDialog
      trigger={
        <Button variant={variant} block={block} size={size} loading={pending} leadingIcon={icon}>
          {label}
        </Button>
      }
      title={title}
      description={body}
      cancelLabel={tc("cancel")}
      actionLabel={confirmLabel}
      destructive={destructive}
      onAction={() =>
        start(async () => {
          const result = await action();
          if (result && !result.ok) toast(te(result.error), <AlertCircle aria-hidden />);
        })
      }
    />
  );
}
