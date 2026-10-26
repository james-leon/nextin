import { formatElapsed, spellTicketCode } from "@nextin/shared";
import { cn } from "@/lib/cn";

/** Carte Navy du poste agent (maquette 04) : ticket en cours, chrono, actions secondaires. */
export function NowServingCard({
  label,
  code,
  elapsedSeconds,
  elapsedLabel,
  actions,
  className,
}: {
  label: string;
  code: string;
  elapsedSeconds: number;
  elapsedLabel: string;
  actions: { label: string; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <section className={cn("squircle rounded-[var(--radius-xl)] bg-navy p-5 text-white", className)}>
      <p className="text-footnote font-semibold tracking-[0.08em] text-white/80 uppercase">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-display font-extrabold whitespace-nowrap">
          <span aria-hidden>{code}</span>
          <span className="sr-only">{spellTicketCode(code)}</span>
        </p>
        <p className="pb-1 text-title2 font-semibold tabular">
          <span className="sr-only">{elapsedLabel} : </span>
          <time dateTime={`PT${Math.floor(elapsedSeconds)}S`}>{formatElapsed(elapsedSeconds)}</time>
        </p>
      </div>
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="pressable h-11 truncate rounded-[12px] bg-on-navy-control px-2 text-callout font-semibold text-white"
          >
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

