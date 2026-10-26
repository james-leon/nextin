"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Search, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** Élément à droite dans le champ (ex. bouton afficher le mot de passe). */
  trailing?: ReactNode;
};

/** Champ de saisie iOS : libellé au-dessus, aide ou erreur en dessous, reliés par aria-describedby. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, trailing, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={id} className="px-4 text-footnote uppercase text-label-secondary">
        {label}
      </label>
      <div className="relative">
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "squircle h-11 w-full rounded-[var(--radius-md)] bg-grouped-secondary px-4 text-body text-label",
          "placeholder:text-label-tertiary outline-none transition-shadow",
          "focus-visible:shadow-[0_0_0_3px_var(--accent-tint)] focus-visible:outline-none",
          error && "shadow-[0_0_0_1.5px_var(--red-text)]",
          trailing ? "pr-12" : undefined,
        )}
        {...props}
      />
      {trailing ? <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div> : null}
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
});

/** Champ de recherche iOS avec loupe et bouton d'effacement. */
export function SearchField({
  label,
  clearLabel,
  value: valueProp,
  onValueChange,
  className,
}: {
  label: string;
  clearLabel: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  const [inner, setInner] = useState("");
  const value = valueProp ?? inner;
  const set = (v: string) => {
    setInner(v);
    onValueChange?.(v);
  };
  return (
    <div className={cn("relative flex h-11 items-center rounded-[10px] bg-fill-tertiary", className)}>
      <Search aria-hidden className="pointer-events-none absolute left-2.5 size-[1.0625rem] stroke-2 text-label-secondary" />
      <input
        type="search"
        role="searchbox"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="h-full w-full bg-transparent pr-11 pl-9 text-body text-label outline-none placeholder:text-label-secondary [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => set("")}
          className="absolute right-0 flex size-11 items-center justify-center text-label-tertiary"
        >
          <XCircle aria-hidden className="size-[1.0625rem] fill-label-tertiary stroke-grouped-secondary" />
        </button>
      ) : null}
    </div>
  );
}
