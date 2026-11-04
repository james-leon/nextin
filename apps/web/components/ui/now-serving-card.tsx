import type React from "react";
import { formatElapsed, spellTicketCode } from "@nextin/shared";
import { cn } from "@/lib/cn";

/** Carte Navy du poste agent (maquette 04) : ticket en cours, chrono, actions secondaires. */
export function NowServingCard({
  label,
  code,
  elapsedSeconds,
  elapsedLabel,
  actions,
  subtitle,
  className,
}: {
  label: string;
  code: string;
  /** Nom du client (personnel uniquement), ou « Nom masqué ». */
  subtitle?: React.ReactNode;
  elapsedSeconds: number;
  elapsedLabel: string;
  actions: { label: string; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <section className={cn("squircle rounded-[var(--radius-2xl)] bg-navy p-5 text-white shadow-card md:p-6", className)}>
      <p className="text-footnote font-semibold tracking-[0.08em] text-white/80 uppercase">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-display font-extrabold whitespace-nowrap md:text-[6rem] md:leading-none">
          <span aria-hidden>{code}</span>
          <span className="sr-only">{spellTicketCode(code)}</span>
        </p>
        <p className="pb-1 text-title2 font-semibold tabular md:text-title1">
          <span className="sr-only">{elapsedLabel} : </span>
          <time dateTime={`PT${Math.floor(elapsedSeconds)}S`}>{formatElapsed(elapsedSeconds)}</time>
        </p>
      </div>
      {subtitle ? <p className="mt-2 truncate text-title3 font-semibold text-white/90">{subtitle}</p> : null}
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="pressable h-12 truncate rounded-[14px] bg-on-navy-control px-2 text-callout font-semibold text-white transition-colors hover:bg-white/20"
          >
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

