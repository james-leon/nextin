/**
 * Écran de démarrage (maquette v2 01 « Démarrage ») : fond uni, icône NextIn, « NextIn » en 28 pt gras, le slogan et
 * les trois points de la file. Une seule source pour le filet HTML du gabarit racine (`app/layout.tsx`, affiché tant
 * que la feuille de style de l'application n'est pas appliquée) et pour les images iOS `apple-touch-startup-image`
 * (`scripts/generate-startup-images.mjs`, rendues par Chromium à partir de ce même HTML) : le passage de l'image au
 * filet puis à l'application se fait sans saut ni flash blanc (même fond que `theme-color` et le manifeste).
 *
 * CSS minifié à la main : il part dans chaque page (budget de 200 Ko des pages client).
 * - Fond de `<html>` immédiat (#F2F2F7, noir en sombre, comme `data-theme`).
 * - Icône posée après 1 s seulement : si la feuille de style arrive avant (cas normal), le bloc est masqué
 *   (`html body #nx-s` dans globals.css) et l'image n'est jamais téléchargée.
 * - Points immobiles si les animations sont réduites (et toujours immobiles sur les images iOS).
 */
const DARK = "--l:#fff;--s:rgb(235 235 245/.6);--a:#4a9be8";

export const splashCss =
  "html{background:#f2f2f7}@media(prefers-color-scheme:dark){html:not([data-theme=light]){background:#000}}html[data-theme=dark]{background:#000}" +
  "#nx-s{--l:#000;--s:#6c6c70;--a:#1a6bb5;position:fixed;inset:0;z-index:-1;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;" +
  'font:15px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--s);text-align:center}' +
  `@media(prefers-color-scheme:dark){html:not([data-theme=light]) #nx-s{${DARK}}}html[data-theme=dark] #nx-s{${DARK}}` +
  "#nx-s:before{content:'';width:92px;height:92px;background:50%/92px no-repeat;animation:nx-i 0s 1s forwards}" +
  "#nx-s b{font-size:28px;font-weight:700;letter-spacing:-.02em;color:var(--l)}#nx-s p{margin:-8px 0 8px}" +
  "#nx-s span{display:flex;gap:7px;align-items:flex-end;height:16px}" +
  "#nx-s i{width:9px;height:9px;border-radius:50%;background:var(--a);opacity:.8;animation:nx-h 1.2s infinite ease-in-out}" +
  "#nx-s i+i{width:8px;height:8px;animation-delay:.15s}#nx-s i+i+i{width:7px;height:7px;animation-delay:.3s}" +
  "@keyframes nx-h{0%,60%,100%{transform:none;opacity:.45}30%{transform:translateY(-6px);opacity:1}}" +
  "@keyframes nx-i{to{background-image:url(/brand/nextin-icon.svg)}}" +
  "@media(prefers-reduced-motion:reduce){#nx-s i{animation:none}}";

/** Contenu du bloc (texte échappé : il vient du dictionnaire). */
export function splashHtml(appName: string, tagline: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<b>${esc(appName)}</b><p>${esc(tagline)}</p><span><i></i><i></i><i></i></span>`;
}
