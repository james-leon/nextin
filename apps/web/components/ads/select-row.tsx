"use client";

import { useId } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Choix dans une liste groupée (« Secteur  Pharmacie › ») : libellé à gauche, valeur grise et chevron à droite. Le
 * menu natif du système s'ouvre au toucher (sélecteur iOS sur iPhone), accessible au clavier et aux lecteurs d'écran.
 */
export function SelectRow({
  name,
  label,
  options,
  defaultValue,
}: {
  name?: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <div className="relative flex min-h-11 items-center gap-3 px-4">
      <label htmlFor={id} className="shrink-0 text-body">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 text-right text-body text-label-secondary outline-none focus-visible:text-accent-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRight aria-hidden className="pointer-events-none absolute right-4 size-4 stroke-[2.25] text-label-tertiary" />
    </div>
  );
}
