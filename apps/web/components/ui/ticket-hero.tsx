import { spellTicketCode } from "@nextin/shared";
import { cn } from "@/lib/cn";
import { QueueDots } from "./queue-dots";

/*
 * Valeurs des deux indicateurs : jamais de débordement (testé à 320 et 375 px, FR et EN). Une valeur courte
 * (« ≈ 15 min », « C-047 ») réduit sa taille à la largeur de la colonne (`cqi`) ; une phrase (« D'un instant à
 * l'autre », « Aucun cabinet ouvert pour l'instant ») passe sur plusieurs lignes.
 */
const shortValue = "whitespace-nowrap font-rounded text-[length:min(1.625rem,20cqi)] leading-tight";
const phraseValue = "text-[length:clamp(0.9375rem,12cqi,1.0625rem)] leading-snug text-balance break-words hyphens-none";
const isShort = (v: string) => /\d/.test(v) && v.length <= 10;

/**
 * Carte du ticket (maquette v2 01 « Mon ticket ») : service, numéro en chiffres arrondis (bleu nuit, blanc en sombre),
 * « 4 personnes devant vous » et la file en points (le client = point orange), puis l'attente estimée et le ticket
 * en cours. Le numéro est épelé pour les lecteurs d'écran (« C 0 4 7 »). En cours d'appel ou de passage : carte
 * verte pleine (« C'est votre tour », poste).
 */
export function TicketHero({
  code,
  service,
  aheadText,
  ahead,
  waitLabel,
  wait,
  progress,
  progressLabel,
  side,
  state = "waiting",
  calledTitle,
  calledBody,
  className,
}: {
  code: string;
  service: string;
  /** « 4 personnes devant vous », « Vous êtes le prochain ». */
  aheadText: string;
  ahead: number;
  waitLabel: string;
  wait: string;
  /** Avancement dans la file, de 0 à 1. */
  progress: number;
  progressLabel: string;
  /** Second indicateur : ticket en cours (« C-047 · Au cabinet 1 ») ou nombre de personnes devant. */
  side?: { value: string; label: string };
  state?: "waiting" | "called";
  calledTitle?: string;
  calledBody?: string;
  className?: string;
}) {
  const called = state === "called";
  const number = (
    <p className={cn("text-hero font-bold whitespace-nowrap", called ? "text-white" : "text-ticket-number")}>
      <span aria-hidden>{code}</span>
      <span className="sr-only">{spellTicketCode(code)}</span>
    </p>
  );
  if (called) {
    return (
      <section aria-live="polite" className={cn("squircle flex flex-col items-center gap-1 rounded-[var(--radius-xl)] bg-called px-5 py-6 text-center text-white", className)}>
        <p className="text-headline">{calledTitle}</p>
        {number}
        {calledBody ? <p className="mt-1 text-title3 font-semibold">{calledBody}</p> : null}
        <p className="text-subheadline">{service}</p>
      </section>
    );
  }
  return (
    <section aria-live="polite" className={cn("squircle flex flex-col gap-3.5 rounded-[var(--radius-xl)] bg-grouped-secondary px-[1.125rem] pt-[1.125rem] pb-4", className)}>
      <div>
        <p className="text-subheadline text-label-secondary">{service}</p>
        {number}
      </div>
      <div>
        <p className="mb-2 text-subheadline font-semibold">{aheadText}</p>
        <QueueDots ahead={ahead} done={3} progress={progress} label={progressLabel} />
      </div>
      <dl className="grid grid-cols-2 pt-3 hairline-t">
        <div className="@container min-w-0 pr-3">
          <dd className={cn("font-bold", isShort(wait) ? cn(shortValue, "tabular") : phraseValue)}>{wait}</dd>
          <dt className="text-footnote text-label-secondary">{waitLabel}</dt>
        </div>
        {side ? (
          <div className="@container min-w-0 pl-3.5 shadow-[inset_0.5px_0_0_var(--separator)]">
            <dd className={cn("font-bold", isShort(side.value) ? shortValue : phraseValue)}>{side.value}</dd>
            <dt className="text-footnote text-label-secondary">{side.label}</dt>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
