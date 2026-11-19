"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

export type ErrorScreenTexts = { title: string; body: string; retry: string; home: string; code: string };

/**
 * Page d'erreur (U1) : une action principale « Réessayer » (relance le rendu du segment), lien discret vers
 * l'accueil, référence technique pour le support (jamais le message d'erreur brut : il peut contenir des données).
 * Sans `Button` ni utilitaires de classes : ce composant est chargé avec chaque page client (budget de 200 Ko).
 */
export function ErrorScreen({
  texts,
  homeHref,
  digest,
  onRetry,
  error,
}: {
  texts: ErrorScreenTexts;
  homeHref: string;
  digest?: string;
  onRetry: () => void;
  error?: unknown;
}) {
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);
  // Maquette v2 21 : icône grise, titre, phrase, référence courte pour le support ; « Réessayer » puis « Revenir à
  // l'accueil » en bas.
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center">
      <section className="flex flex-1 flex-col items-center justify-center gap-4">
        <span aria-hidden className="flex size-16 items-center justify-center rounded-[18px] bg-fill-tertiary text-label-secondary">
          <TriangleAlert className="size-8 stroke-[1.75]" />
        </span>
        <h1 className="text-title1 font-bold [text-wrap:balance]">{texts.title}</h1>
        <p className="text-body text-label-secondary">{texts.body}</p>
        {digest ? <p className="text-footnote text-label-secondary tabular">{texts.code.replace("{digest}", digest)}</p> : null}
      </section>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="pressable squircle inline-flex h-[3.125rem] w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-5 text-headline font-semibold text-on-accent hover:bg-primary-pressed"
        >
          <RotateCw aria-hidden className="size-5" />
          {texts.retry}
        </button>
        {/* Lien simple (pas de préchargement) : la navigation recharge l'application si elle est en défaut. */}
        <a
          href={homeHref}
          className="pressable squircle inline-flex h-[3.125rem] w-full items-center justify-center rounded-[12px] bg-accent-tint px-5 text-headline font-semibold text-accent-on-tint"
        >
          {texts.home}
        </a>
      </div>
    </main>
  );
}
