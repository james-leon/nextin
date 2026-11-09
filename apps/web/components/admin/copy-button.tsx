"use client";

import { Copy } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Copie une valeur dans le presse-papiers et le confirme par une notification. */
export function CopyButton({ value, label, copiedLabel, variant = "tinted", size = "md", block }: { value: string; label: string; copiedLabel: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; block?: boolean }) {
  const toast = useToast();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      block={block}
      leadingIcon={<Copy aria-hidden className="size-5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast(copiedLabel, <CheckCircle2 aria-hidden />);
        } catch {
          window.prompt(label, value);
        }
      }}
    >
      {label}
    </Button>
  );
}
