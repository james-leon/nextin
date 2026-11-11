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
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-orange-tint text-orange-text">
        <TriangleAlert className="size-8 stroke-[1.75]" />
      </span>
      <h1 className="text-title2 font-bold">{texts.title}</h1>
      <p className="text-body text-label-secondary">{texts.body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="pressable squircle mt-2 inline-flex h-[3.125rem] min-w-48 items-center justify-center gap-2 rounded-[12px] bg-primary px-5 text-headline font-semibold text-on-accent hover:bg-primary-pressed"
      >
        <RotateCw aria-hidden className="size-5" />
        {texts.retry}
      </button>
      {/* Lien simple (pas de préchargement) : la navigation recharge l'application si elle est en défaut. */}
      <a href={homeHref} className="inline-flex min-h-11 items-center text-subheadline font-semibold text-accent-text">
        {texts.home}
      </a>
      {digest ? <p className="text-footnote text-label-secondary tabular">{texts.code.replace("{digest}", digest)}</p> : null}
    </main>
  );
}
