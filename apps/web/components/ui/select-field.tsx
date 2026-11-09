"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Liste déroulante native (sélecteur iOS/Android du système), habillée comme les champs du design system. */
export function SelectField({
  label,
  hint,
  error,
  options,
  className,
  id: idProp,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  options: readonly { value: string; label: string }[];
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={id} className="px-4 text-footnote uppercase text-label-secondary">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "squircle h-11 w-full appearance-none rounded-[var(--radius-md)] bg-grouped-secondary pr-11 pl-4 text-body text-label outline-none",
            "focus-visible:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60",
            error && "shadow-[0_0_0_1.5px_var(--red-text)]",
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 stroke-2 text-label-secondary" />
      </div>
      {error ? (
        <p id={`${id}-error`} className="px-4 text-footnote text-red-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="px-4 text-footnote text-label-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
