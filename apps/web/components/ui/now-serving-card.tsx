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
    // Maquette v2 08 : carte blanche (aplat), numéro en bleu nuit et chiffres arrondis ; le bleu nuit plein reste
    // réservé au bouton principal, sous la carte.
    <section className={cn("squircle rounded-[var(--radius-2xl)] bg-grouped-secondary p-5 shadow-card md:p-6", className)}>
      <p className="text-subheadline text-label-secondary">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-display font-extrabold whitespace-nowrap text-ticket-number md:text-[6rem] md:leading-none">
          <span aria-hidden>{code}</span>
          <span className="sr-only">{spellTicketCode(code)}</span>
        </p>
        <p className="pb-1 font-rounded text-title2 font-semibold tabular md:text-title1">
          <span className="sr-only">{elapsedLabel} : </span>
          <time dateTime={`PT${Math.floor(elapsedSeconds)}S`}>{formatElapsed(elapsedSeconds)}</time>
        </p>
      </div>
      {subtitle ? <p className="mt-2 truncate text-title3 font-semibold">{subtitle}</p> : null}
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="pressable h-12 truncate rounded-[var(--radius-md)] bg-fill-tertiary px-2 text-callout font-semibold text-label transition-colors hover:bg-fill-secondary"
          >
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

