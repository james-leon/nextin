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
  leading,
  grouped,
  name = "password",
  value,
  onValueChange,
}: {
  /** Valeur contrôlée (facultative), pour vérifier les règles en direct. */
  value?: string;
  onValueChange?: (value: string) => void;
  label: string;
  showLabel: string;
  hideLabel: string;
  hint?: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
  /** Icône à gauche (cadenas sur l'écran de connexion). */
  leading?: React.ReactNode;
  name?: string;
  /** Cellule d'une liste groupée (`FormGroup`). */
  grouped?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      name={name}
      type={visible ? "text" : "password"}
      leading={leading}
      grouped={grouped}
      label={label}
      hint={hint}
      error={error}
      autoComplete={autoComplete}
      {...(value !== undefined ? { value } : {})}
      onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
      required
      trailing={
        <button
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className={grouped ? "pressable -my-2 -mr-2 flex size-11 shrink-0 items-center justify-center text-label-secondary" : "pressable flex size-11 shrink-0 items-center justify-center text-label-secondary"}
        >
          {visible ? <EyeOff aria-hidden className="size-5 stroke-[1.75]" /> : <Eye aria-hidden className="size-5 stroke-[1.75]" />}
        </button>
      }
    />
  );
}
