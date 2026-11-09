"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Bouton déclenchant une action serveur sans confirmation (erreur affichée en notification). */
export function ActionButton({
  action,
  children,
  variant = "tinted",
  size = "sm",
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const te = useTranslations("errors");
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await action();
          if (result && !result.ok) toast(te(result.error), <AlertCircle aria-hidden />);
        })
      }
    >
      {children}
    </Button>
  );
}
