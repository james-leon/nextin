"use client";

import { cn } from "@/lib/cn";

/**
 * Carte « Votre position » : frise verticale du ticket en cours (point vert), des tickets devant (cercles gris) et
 * du ticket du client (surligné). Seulement des numéros, déjà publics sur l'écran TV : jamais de nom.
 */
export function QueuePosition({
  title,
  current,
  ahead,
  me,
  labels,
}: {
  title: string;
  /** Ticket en cours dans le service (numéro et poste), sinon null. */
  current: { code: string; counter: string } | null;
  /** Numéros devant le client, dans l'ordre de passage. */
  ahead: string[];
  me: string;
  labels: { now: (counter: string) => string; idle: string; more: (count: number) => string; you: string };
}) {
  // Au plus trois tickets juste devant le client ; les autres résumés en une ligne.
  const shown = ahead.slice(-3);
  const hidden = ahead.length - shown.length;
  const rows: { key: string; code: string | null; text: string; kind: "now" | "ahead" | "more" | "me" }[] = [
    current ? { key: "now", code: current.code, text: labels.now(current.counter), kind: "now" } : { key: "now", code: null, text: labels.idle, kind: "now" },
    ...(hidden > 0 ? [{ key: "more", code: null, text: labels.more(hidden), kind: "more" as const }] : []),
    ...shown.map((code) => ({ key: code, code, text: "", kind: "ahead" as const })),
    { key: "me", code: me, text: labels.you, kind: "me" },
  ];

  return (
    <section aria-label={title} className="squircle rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <h2 className="text-headline">{title}</h2>
      <ol className="mt-3 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.key} className="relative flex min-h-11 items-center gap-3">
            {/* Trait de la frise entre deux points. */}
            {i < rows.length - 1 ? <span aria-hidden className="absolute top-1/2 left-[0.6875rem] h-full w-px bg-separator" /> : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-[1.375rem] shrink-0 items-center justify-center rounded-full",
                r.kind === "now" && (r.code ? "bg-green" : "bg-fill"),
                r.kind === "ahead" && "border-2 border-separator-opaque bg-grouped-secondary",
                r.kind === "more" && "bg-grouped-secondary",
                r.kind === "me" && "bg-accent",
              )}
            >
              {r.kind === "more" ? <span className="text-footnote font-bold text-label-secondary">⋮</span> : null}
            </span>
            <span
              className={cn(
                "flex min-w-0 flex-1 items-baseline gap-2 rounded-[var(--radius-md)] py-2",
                r.kind === "me" && "-mr-2 bg-accent-tint px-3",
              )}
            >
              {r.code ? (
                <span className={cn("shrink-0 text-headline font-bold", r.kind === "me" ? "text-accent-on-tint" : "text-label")}>{r.code}</span>
              ) : null}
              {r.text ? (
                <span className={cn("truncate text-subheadline", r.kind === "me" ? "font-semibold text-accent-on-tint" : "text-label-secondary")}>{r.text}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
