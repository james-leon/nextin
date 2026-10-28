"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type Bar = { key: string; label: string; value: number; tooltip: string };

/**
 * Histogramme d'une seule série (maquette 06) : barres fines à sommet arrondi posées sur la ligne de base,
 * pic en orange, grille discrète, infobulle au survol et au clavier, tableau équivalent pour les lecteurs d'écran.
 * Une seule série : pas de légende, le titre de la carte la nomme.
 */
export function BarChart({
  bars,
  highlight,
  caption,
  columns,
  className,
}: {
  bars: Bar[];
  /** Index de la barre mise en avant (pic), ou -1. */
  highlight: number;
  /** Titre du tableau de données (lecteurs d'écran). */
  caption: string;
  /** En-têtes du tableau de données. */
  columns: [string, string];
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  // Graduations arrondies : 0, moitié, maximum.
  const top = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const ticks = [top, Math.round(top / 2), 0];
  // Étiquettes de l'axe : une sur deux quand les barres sont nombreuses (pas de chevauchement).
  const every = bars.length > 16 ? 3 : bars.length > 10 ? 2 : 1;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative flex h-52 gap-3 sm:h-60">
        <div aria-hidden className="flex w-6 shrink-0 flex-col justify-between pb-6 text-right text-caption text-label-secondary tabular">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((t) => (
              <span key={t} className={cn("block h-px", t === 0 ? "bg-separator" : "bg-fill-tertiary")} />
            ))}
          </div>
          <ul role="list" aria-hidden className="relative flex min-h-0 flex-1 items-end gap-[2px] sm:gap-1.5">
            {bars.map((b, i) => (
              <li
                key={b.key}
                className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center pb-0"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((a) => (a === i ? null : a))}
              >
                <span
                  className={cn(
                    "block w-full max-w-10 rounded-t-[4px] transition-[height,opacity] duration-300 ease-[var(--ease-spring)]",
                    i === highlight ? "bg-orange" : "bg-accent",
                    active !== null && active !== i && "opacity-60",
                  )}
                  style={{ height: `${(b.value / top) * 100}%`, minHeight: b.value ? 4 : 0 }}
                />
                {active === i ? (
                  <span className="squircle pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-[8px] bg-label px-2.5 py-1.5 text-footnote font-semibold whitespace-nowrap text-grouped shadow-floating">
                    {b.tooltip}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div aria-hidden className="flex h-6 shrink-0 items-end gap-[2px] sm:gap-1.5">
            {bars.map((b, i) => (
              <span
                key={b.key}
                className={cn(
                  "min-w-0 flex-1 overflow-visible text-center text-caption whitespace-nowrap text-label-secondary tabular",
                  // Téléphone : une étiquette sur trois ; plus large : selon le nombre de barres.
                  i % 3 !== 0 && "max-sm:invisible",
                  i % every !== 0 && "sm:invisible",
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{columns[0]}</th>
            <th scope="col">{columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
