/**
 * Textes des pages d'erreur (U1), FR et EN, source unique (hors des dictionnaires : rien de plus à transmettre avec
 * chaque page client). Utilisés par toutes les pages d'erreur, y compris `global-error.tsx`, qui n'a aucun
 * fournisseur de traductions. Module minuscule, sans dépendance : il entre dans les pages au budget serré.
 */
export const ERROR_TEXTS = {
  fr: {
    title: "Cette page n'a pas pu s'afficher",
    body: "Un problème passager est survenu. Vérifiez votre connexion, puis réessayez.",
    retry: "Réessayer",
    home: "Revenir à l'accueil",
    code: "Référence : {digest}",
  },
  en: {
    title: "This page could not be displayed",
    body: "A temporary problem occurred. Check your connection, then try again.",
    retry: "Try again",
    home: "Back to home",
    code: "Reference: {digest}",
  },
} as const;

export function errorTexts(locale: string | null | undefined) {
  return locale?.toLowerCase().startsWith("en") ? ERROR_TEXTS.en : ERROR_TEXTS.fr;
}
