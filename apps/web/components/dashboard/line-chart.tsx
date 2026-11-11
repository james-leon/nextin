"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type LinePoint = { key: string; label: string; value: number | null; previous: number | null; tooltip: string };

const W = 600;
const H = 220;

/**
 * Courbe d'une mesure par jour (style A, tableau de bord) : période choisie en trait plein bleu, période précédente
 * en pointillés gris (même rang de jour), grille discrète, infobulle au survol et au clavier, tableau équivalent pour
 * les lecteurs d'écran. Fait maison, sans bibliothèque de graphiques. Jours sans donnée : trait interrompu.
 */
export function LineChart({
  points,
  caption,
  columns,
  legend,
  format,
  className,
}: {
  points: LinePoint[];
  caption: string;
  /** En-têtes du tableau : jour, période choisie, période précédente. */
  columns: [string, string, string];
  legend: { current: string; previous: string };
  /** Valeur affichée sur l'axe et dans le tableau. */
  format: (value: number) => string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.flatMap((p) => [p.value, p.previous]).filter((v): v is number => v != null);
  const max = Math.max(1, ...values);
  const top = Math.ceil(max / 300) * 300 || 300;
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - (v / top) * H;
  // Segments continus (un jour sans donnée interrompt la courbe).
  const path = (pick: (p: LinePoint) => number | null) =>
    points
      .map((p, i) => {
        const v = pick(p);
        if (v == null) return null;
        const prev = i > 0 ? pick(points[i - 1]!) : null;
        return `${prev == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const every = points.length > 16 ? Math.ceil(points.length / 8) : 1;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div aria-hidden className="flex flex-wrap gap-4 text-footnote text-label-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-accent" />
          {legend.current}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-5 border-t-2 border-dashed border-label-secondary" />
          {legend.previous}
        </span>
      </div>
      <div className="flex gap-3">
        <div aria-hidden className="flex h-52 w-10 shrink-0 flex-col justify-between pb-6 text-right text-caption text-label-secondary tabular sm:h-60">
          <span className="leading-none">{format(top)}</span>
          <span className="leading-none">{format(top / 2)}</span>
          <span className="leading-none">0</span>
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div aria-hidden className="relative h-46 sm:h-54">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              {[0, 0.5, 1].map((f) => (
                <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className={f === 1 ? "stroke-separator" : "stroke-fill-tertiary"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              <path d={path((p) => p.previous)} fill="none" className="stroke-label-secondary" strokeWidth={2} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
              <path d={path((p) => p.value)} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {active != null && points[active]?.value != null ? (
                <line x1={x(active)} x2={x(active)} y1={0} y2={H} className="stroke-separator" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ) : null}
            </svg>
            {/* Points (cercles réguliers hors du SVG étiré) et zones de survol. */}
            {points.map((p, i) =>
              p.value != null ? (
                <span
                  key={p.key}
                  className={cn(
                    "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-grouped-secondary bg-accent transition-transform",
                    active === i && "scale-150",
                  )}
                  style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
                />
              ) : null,
            )}
            <div className="absolute inset-0 flex">
              {points.map((p, i) => (
                <span key={p.key} className="relative h-full flex-1" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive((a) => (a === i ? null : a))}>
                  {active === i ? (
                    <span className="squircle pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-[8px] bg-label px-2.5 py-1.5 text-footnote font-semibold whitespace-nowrap text-grouped shadow-floating">
                      {p.tooltip}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
          <div aria-hidden className="flex h-6 items-end">
            {points.map((p, i) => (
              <span key={p.key} className={cn("min-w-0 flex-1 text-center text-caption whitespace-nowrap text-label-secondary tabular", i % every !== 0 && "invisible")}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Tableau pour lecteurs d'écran : `sr-only` sur un conteneur, une table s'élargirait à ses colonnes. */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td>{p.value != null ? format(p.value) : "—"}</td>
              <td>{p.previous != null ? format(p.previous) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
