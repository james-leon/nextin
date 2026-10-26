import { cn } from "@/lib/cn";

/**
 * Héros visuel du parcours client : numéro de ticket et attente estimée.
 * Le numéro est épelé pour les lecteurs d'écran (« C 0 4 7 »), sans dépendre de la mise en forme.
 */
export function TicketHero({
  label,
  code,
  service,
  positionLabel,
  position,
  waitLabel,
  wait,
  footnote,
  state = "waiting",
  calledTitle,
  calledBody,
  className,
}: {
  label: string;
  code: string;
  service: string;
  positionLabel: string;
  position: string;
  waitLabel: string;
  wait: string;
  footnote?: string;
  state?: "waiting" | "called";
  calledTitle?: string;
  calledBody?: string;
  className?: string;
}) {
  const called = state === "called";
  return (
    <section
      aria-live="polite"
      className={cn(
        "squircle relative overflow-hidden rounded-[var(--radius-xl)] p-6 text-center shadow-card transition-colors duration-500",
        called ? "bg-green text-white" : "bg-grouped-secondary",
        className,
      )}
    >
      <p className={cn("text-subheadline font-medium", called ? "text-white/85" : "text-label-secondary")}>{label}</p>
      <p className="mt-1 font-rounded text-hero font-bold tabular tracking-tight animate-pop-in">
        <span aria-hidden>{code}</span>
        <span className="sr-only">{code.split("").join(" ")}</span>
      </p>
      <p className={cn("mt-1 text-headline", called ? "text-white" : "text-label")}>{service}</p>

      {called ? (
        <div className="mt-5 rounded-[var(--radius-lg)] bg-white/15 px-4 py-3">
          <p className="text-title2 font-bold">{calledTitle}</p>
          <p className="mt-0.5 text-callout">{calledBody}</p>
        </div>
      ) : (
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-lg)] bg-grouped-tertiary px-3 py-3">
            <dt className="text-footnote text-label-secondary">{positionLabel}</dt>
            <dd className="mt-0.5 text-title1 font-bold tabular">{position}</dd>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-accent-tint px-3 py-3">
            <dt className="text-footnote text-accent-on-tint">{waitLabel}</dt>
            <dd className="mt-0.5 text-title1 font-bold tabular text-accent-on-tint">{wait}</dd>
          </div>
        </dl>
      )}
      {footnote && !called ? <p className="mt-4 text-footnote text-label-secondary">{footnote}</p> : null}
    </section>
  );
}
