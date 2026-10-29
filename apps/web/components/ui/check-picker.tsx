"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { SearchField } from "./text-field";

/**
 * Choix multiples dans une longue liste (villes…) : recherche, cases à cocher, hauteur limitée avec défilement interne
 * (la page ne s'allonge plus avec la liste). Les éléments cochés restent en tête.
 */
export function CheckPicker({
  label,
  footer,
  options,
  selected,
  onChange,
  search,
  className,
}: {
  label: string;
  footer?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Champ de recherche (à partir d'une dizaine d'options). */
  search?: { label: string; clearLabel: string; empty: string; countLabel: string };
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase();
  const shown = options
    .filter((o) => !q || o.label.toLocaleLowerCase().includes(q))
    .sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)));
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <section className={cn("flex w-full flex-col gap-1.5", className)}>
      <h3 className="flex items-baseline justify-between gap-2 px-4 text-footnote uppercase text-label-secondary">
        <span>{label}</span>
        {search ? <span className="normal-case tabular">{search.countLabel}</span> : null}
      </h3>
      <div className="squircle flex flex-col overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
        {search ? (
          <div className="p-2 hairline-b">
            <SearchField label={search.label} clearLabel={search.clearLabel} value={query} onValueChange={setQuery} />
          </div>
        ) : null}
        <ul role="group" aria-label={label} className={cn(search && "max-h-72 overflow-y-auto overscroll-contain")}>
          {shown.map((o) => {
            const on = selected.includes(o.value);
            return (
              <li key={o.value} role="none" className="group/row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-fill-tertiary/50 active:bg-fill-tertiary"
                >
                  <span className="relative flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 list-separator">
                    <span className="min-w-0 flex-1 truncate text-body">{o.label}</span>
                    <Check aria-hidden className={cn("size-5 shrink-0 stroke-[2.5] text-accent-text", !on && "invisible")} />
                  </span>
                </button>
              </li>
            );
          })}
          {search && !shown.length ? <li className="px-4 py-3 text-body text-label-secondary">{search.empty}</li> : null}
        </ul>
      </div>
      {footer ? <p className="px-4 text-footnote text-label-secondary">{footer}</p> : null}
    </section>
  );
}
