import { primaryAction, type DeskSnapshot } from "./desk";

/**
 * Raccourcis clavier du poste (vue ordinateur) : mêmes règles que les boutons. Un raccourci indisponible ne renvoie
 * rien (aucun effet) ; le mode hors ligne est géré par la commande elle-même.
 */
export type DeskCommand = "primary" | "admit" | "recall" | "transfer" | "absent" | "pause" | "resume" | "help";

/** Aide « ? » : touche affichée (ou clé de traduction pour Espace et Entrée) et commande. */
export const DESK_SHORTCUTS: readonly { key: "space" | "enter" | "R" | "T" | "A" | "P" | "?"; command: DeskCommand }[] = [
  { key: "space", command: "primary" },
  { key: "enter", command: "admit" },
  { key: "R", command: "recall" },
  { key: "T", command: "transfer" },
  { key: "A", command: "absent" },
  { key: "P", command: "pause" },
  { key: "?", command: "help" },
];

type ShortcutEvent = { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

/**
 * Commande d'une touche selon l'état du poste, ou `null`.
 * - Espace : action principale (ouvrir, reprendre, alerter le suivant, terminer et alerter) — jamais « Admettre »,
 *   réservé à Entrée pour éviter une admission involontaire.
 * - Entrée : admettre le patient alerté. R : rappeler, A : absent (patient alerté). T : transférer (patient en cours).
 * - P : pause (poste ouvert, sans patient) ou reprise (poste en pause). ? : aide.
 */
export function deskShortcut(e: ShortcutEvent, s: Pick<DeskSnapshot, "counterStatus" | "current" | "waiting">): DeskCommand | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const called = s.current?.status === "called";
  switch (key) {
    case " ":
    case "Spacebar": {
      const action = primaryAction(s);
      return action === "none" || action === "admit" ? null : "primary";
    }
    case "Enter":
      return called ? "admit" : null;
    case "r":
      return called ? "recall" : null;
    case "a":
      return called ? "absent" : null;
    case "t":
      return s.current ? "transfer" : null;
    case "p":
      if (s.counterStatus === "open" && !s.current) return "pause";
      return s.counterStatus === "paused" ? "resume" : null;
    case "?":
      return "help";
    default:
      return null;
  }
}

/**
 * Les raccourcis ne s'appliquent ni pendant une saisie ni quand une feuille ou une alerte est ouverte. Sur un bouton
 * ou un lien qui a le focus, Espace et Entrée gardent leur rôle habituel (activer cet élément), sans double action.
 */
export function shortcutTargetAllowed(
  target: { tagName?: string; isContentEditable?: boolean } | null,
  dialogOpen: boolean,
  key: string,
): boolean {
  if (dialogOpen) return false;
  if (!target) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return false;
  if ((key === " " || key === "Spacebar" || key === "Enter") && (tag === "BUTTON" || tag === "A")) return false;
  return true;
}
