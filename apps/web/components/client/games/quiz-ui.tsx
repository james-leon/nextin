"use client";

import type { ReactNode } from "react";
import { Check, Heart, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLiteT } from "@/lib/i18n/lite";

/** État d'une réponse après la vérification : bonne (vert), choisie et fausse (rouge), autres atténuées. */
export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "dim";

const LETTERS = ["A", "B", "C", "D"];

/**
 * Carte de question du quiz (maquette v2 10) : grande carte bleu nuit, numéro en onglet (vert ou rouge après la
 * réponse), catégorie, question, réponses en pilules avec une lettre dans un rond.
 */
export function QuizCard({
  number,
  verdict,
  category,
  question,
  children,
}: {
  number: number;
  verdict: "correct" | "wrong" | null;
  category?: string;
  question: string;
  children: ReactNode;
}) {
  const t = useLiteT("games");
  return (
    <section aria-live="polite" className="relative mt-5 rounded-[24px] bg-navy px-4 pt-11 pb-4 text-white">
      <span
        className={cn(
          "absolute -top-5 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 font-rounded text-subheadline font-extrabold tracking-[0.12em] whitespace-nowrap uppercase shadow-floating transition-colors",
          verdict === "correct" ? "bg-called text-white" : verdict === "wrong" ? "bg-red text-white" : "bg-white text-navy",
        )}
      >
        {t("questionTab", { n: number })}
        {verdict ? <span className="sr-only"> · {verdict === "correct" ? t("correctAnswer") : t("wrongAnswer")}</span> : null}
      </span>
      {category ? <p className="mb-2 text-center text-caption font-bold tracking-[0.14em] text-white/80 uppercase">{category}</p> : null}
      <h2 id="quiz-question" className="mx-1.5 mb-4 text-center font-rounded text-title3 leading-snug font-bold text-balance">
        {question}
      </h2>
      <div role="radiogroup" aria-labelledby="quiz-question" className="flex flex-col gap-2.5">
        {children}
      </div>
    </section>
  );
}

/** Réponse en pilule : lettre dans un rond ; coche ou croix après la vérification. */
export function AnswerPill({ index, text, state, disabled, onSelect }: { index: number; text: string; state: AnswerState; disabled: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={state === "selected" || state === "correct" || state === "wrong"}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "pressable flex min-h-14 w-full items-center gap-3.5 rounded-full py-2 pr-4 pl-2 text-left text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-tint",
        state === "correct" ? "bg-called text-white" : state === "wrong" ? "bg-red text-white" : "bg-white text-navy",
        state === "selected" && "ring-4 ring-orange",
        state === "dim" && "opacity-55",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full font-rounded text-callout font-extrabold",
          state === "correct" || state === "wrong" ? "bg-white" : state === "selected" ? "bg-orange text-navy" : "bg-navy text-white",
        )}
      >
        {state === "correct" ? (
          <Check className="size-5 stroke-[3.2] text-called" />
        ) : state === "wrong" ? (
          <X className="size-5 stroke-[3.2] text-red" />
        ) : (
          LETTERS[index]
        )}
      </span>
      <span className="min-w-0 flex-1">{text}</span>
    </button>
  );
}

/** Vies (cœurs) : les vies perdues sont estompées. */
export function Lives({ lives, total }: { lives: number; total: number }) {
  const t = useLiteT("games");
  return (
    <span role="img" aria-label={t("livesLeft", { count: lives })} className="flex flex-1 gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <Heart key={i} aria-hidden className={cn("size-6", i < lives ? "fill-red text-red" : "fill-label-tertiary text-label-tertiary opacity-40")} />
      ))}
    </span>
  );
}

/** Anneau de résultat (maquette v2 10) : part de l'objectif atteinte, nombre au centre. */
export function ResultRing({ value, fraction, label }: { value: number; fraction: number; label: string }) {
  const r = 66;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[150px] place-items-center">
      <svg aria-hidden viewBox="0 0 150 150" className="absolute inset-0 size-full -rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" strokeWidth="16" className="stroke-fill-secondary" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          strokeWidth="16"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, fraction)))}
          className="stroke-green transition-[stroke-dashoffset] duration-700 ease-[var(--ease-spring)] motion-reduce:transition-none"
        />
      </svg>
      <p className="flex flex-col items-center leading-tight">
        <span className="font-rounded text-[38px] font-extrabold tabular">{value}</span>
        <span className="text-footnote font-semibold text-label-secondary">{label}</span>
      </p>
    </div>
  );
}
