import type { QuizIllustration } from "@nextin/shared/games/quiz-bank";

/**
 * Illustrations du quiz « série sans fin » (maquette v2 10), recopiées à l'identique de la maquette : dessins SVG
 * originaux, sans photo (légers en 3G, sans droits d'image). Clé = `quiz_bank_questions.illustration` (liste fermée
 * `QUIZ_ILLUSTRATIONS`). Couleurs propres au dessin (illustration, pas interface), identiques en clair et en sombre :
 * le cadre blanc qui les entoure reste blanc.
 */
export const QUIZ_ART: Record<QuizIllustration, string> = {
  mont:
    '<svg viewBox="0 0 160 120"><rect width="160" height="120" fill="#BFE6FF"/><circle cx="125" cy="28" r="12" fill="#FFD36B"/><path d="M0 120L52 46l18 18 22-34 68 90z" fill="#5C4A3D"/><path d="M78 40l14-10 12 16-8-2-6 6-6-6z" fill="#fff"/><path d="M0 120l40-30 30 12 40-18 50 36z" fill="#3E9B4F"/><path d="M0 120l60-14 50 6 50-10v18z" fill="#2E7D3E"/></svg>',
  eau:
    '<svg viewBox="0 0 160 120"><rect width="160" height="120" fill="#EAF6FF"/><path d="M80 18c18 26 30 42 30 58a30 30 0 0 1-60 0c0-16 12-32 30-58z" fill="#3FA2F0"/><path d="M68 70a14 14 0 0 0 10 16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/><g fill="#1A6BB5"><rect x="22" y="78" width="14" height="22" rx="3"/><rect x="124" y="78" width="14" height="22" rx="3"/></g></svg>',
  fleuve:
    '<svg viewBox="0 0 160 120"><rect width="160" height="120" fill="#CFEAFF"/><path d="M0 70h160v50H0z" fill="#2D7FC7"/><path d="M0 84c20-6 40 6 60 0s40 6 60 0 30 4 40 2" stroke="#8CC8F5" stroke-width="3" fill="none"/><rect x="0" y="58" width="160" height="7" fill="#5B6B80"/><g fill="#5B6B80"><rect x="18" y="64" width="6" height="22"/><rect x="58" y="64" width="6" height="22"/><rect x="98" y="64" width="6" height="22"/><rect x="138" y="64" width="6" height="22"/></g><path d="M0 58c26-18 54-18 80 0s54 18 80 0" stroke="#0D2C54" stroke-width="3" fill="none"/></svg>',
  moustique:
    '<svg viewBox="0 0 160 120"><rect width="160" height="120" fill="#FFF4E6"/><ellipse cx="82" cy="62" rx="26" ry="7" fill="#5A4636" transform="rotate(-20 82 62)"/><circle cx="56" cy="72" r="8" fill="#3E3128"/><path d="M50 76l-22 12" stroke="#3E3128" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="82" cy="44" rx="20" ry="9" fill="#BFD9F2" opacity=".85" transform="rotate(-35 82 44)"/><ellipse cx="96" cy="48" rx="18" ry="8" fill="#D6E8F8" opacity=".85" transform="rotate(-10 96 48)"/><g stroke="#3E3128" stroke-width="2" stroke-linecap="round"><path d="M70 66l-8 22M80 64l-2 26M90 60l8 24M100 56l18 18"/></g></svg>',
  mains:
    '<svg viewBox="0 0 160 120"><rect width="160" height="120" fill="#E7F6EE"/><g fill="#F2C59B" stroke="#C98A5B" stroke-width="2"><path d="M40 90c-6-20 0-44 14-52l20 10c8 4 6 14-2 14l-12-2 6 30z"/><path d="M120 90c6-20 0-44-14-52l-20 10c-8 4-6 14 2 14l12-2-6 30z"/></g><g fill="#fff" stroke="#9AD7B3" stroke-width="2"><circle cx="72" cy="30" r="8"/><circle cx="92" cy="22" r="6"/><circle cx="104" cy="36" r="5"/><circle cx="60" cy="44" r="5"/></g></svg>',
  trophee:
    '<svg viewBox="0 0 160 120"><rect width="160" height="120" fill="#13874E"/><path d="M0 0h54v120H0z" fill="#15A05A"/><path d="M106 0h54v120h-54z" fill="#E8C53A"/><path d="M60 22h40v20a20 20 0 0 1-40 0z" fill="#F5C842" stroke="#B8901A" stroke-width="2"/><path d="M60 28H48a10 10 0 0 0 12 14M100 28h12a10 10 0 0 1-12 14" stroke="#B8901A" stroke-width="3" fill="none"/><rect x="74" y="62" width="12" height="14" fill="#E0A81C"/><rect x="62" y="76" width="36" height="10" rx="2" fill="#7A4E2B"/></svg>',
};

/** Dessin d'une clé ; null si la clé est inconnue ou vide (pas d'image). */
export function quizArt(key: string | null | undefined): string | null {
  return key && Object.prototype.hasOwnProperty.call(QUIZ_ART, key) ? QUIZ_ART[key as QuizIllustration] : null;
}
