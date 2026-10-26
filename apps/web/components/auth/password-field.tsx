"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField } from "@/components/ui/text-field";

export function PasswordField({
  label,
  showLabel,
  hideLabel,
  hint,
  error,
  autoComplete,
}: {
  label: string;
  showLabel: string;
  hideLabel: string;
  hint?: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      name="password"
      type={visible ? "text" : "password"}
      label={label}
      hint={hint}
      error={error}
      autoComplete={autoComplete}
      required
      trailing={
        <button
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="pressable flex size-11 items-center justify-center text-label-secondary"
        >
          {visible ? <EyeOff aria-hidden className="size-5 stroke-[1.75]" /> : <Eye aria-hidden className="size-5 stroke-[1.75]" />}
        </button>
      }
    />
  );
}
