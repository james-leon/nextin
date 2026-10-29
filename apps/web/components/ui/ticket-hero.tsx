import { spellTicketCode } from "@nextin/shared";
import { cn } from "@/lib/cn";
import { ProgressBar } from "./progress-bar";

/**
 * Héros visuel du parcours client (maquette 03) : service, numéro de ticket en Navy, établissement,
 * « Devant vous » et « Attente estimée », progression et ticket en cours.
 * Le numéro est épelé pour les lecteurs d'écran (« C 0 4 7 »).
 */
export function TicketHero({
  code,
  service,
  place,
  aheadLabel,
  ahead,
  waitLabel,
  wait,
  progress,
  progressLabel,
  nowServing,
  state = "waiting",
  calledTitle,
  calledBody,
  className,
}: {
  code: string;
  service: string;
  place: string;
  aheadLabel: string;
  ahead: number;
  waitLabel: string;
  wait: string;
  /** Avancement dans la file, de 0 à 1. */
  progress: number;
  progressLabel: string;
  nowServing?: string;
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
        "squircle relative overflow-hidden rounded-[var(--radius-xl)] px-5 pt-7 pb-5 text-center transition-colors duration-500",
        called ? "bg-called text-white" : "bg-grouped-secondary shadow-floating",
        className,
      )}
    >
      <p
        className={cn(
          "text-footnote font-semibold tracking-[0.08em] uppercase",
          called ? "text-white" : "text-label-secondary",
        )}
      >
        {service}
      </p>
      <p className={cn("mt-1 text-hero font-extrabold whitespace-nowrap animate-pop-in", called ? "text-white" : "text-ticket-number")}>
        <span aria-hidden>{code}</span>
        <span className="sr-only">{spellTicketCode(code)}</span>
      </p>
      <p className={cn("mt-2 text-callout uppercase", called ? "text-white" : "text-label-secondary")}>{place}</p>

      {called ? (
        <div className="mt-5 rounded-[var(--radius-lg)] bg-black/15 px-4 py-3">
          <p className="text-title2 font-bold">{calledTitle}</p>
          <p className="mt-0.5 text-callout">{calledBody}</p>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-[var(--radius-lg)] bg-grouped-tertiary px-3.5 py-3">
              <dt className="text-subheadline text-label-secondary">{aheadLabel}</dt>
              <dd className="mt-0.5 text-title1 font-bold tabular">{ahead}</dd>
            </div>
            <div className="rounded-[var(--radius-lg)] bg-grouped-tertiary px-3.5 py-3">
              <dt className="text-subheadline text-label-secondary">{waitLabel}</dt>
              <dd className="mt-0.5 text-title1 font-bold whitespace-nowrap tabular">{wait}</dd>
            </div>
          </dl>
          <ProgressBar value={progress} label={progressLabel} className="mt-5" />
          {nowServing ? <p className="mt-2 text-left text-subheadline text-label-secondary">{nowServing}</p> : null}
        </>
      )}
    </section>
  );
}
