/**
 * Réaction immédiate à chaque navigation (toute l'application, pages client comprises), installée une fois par
 * `NavFeedback` (gabarit racine) : quelques lignes sans React ni bibliothèque (budget de 200 Ko des pages client).
 *
 * - Au toucher d'un lien interne (capture du clic, avant le `preventDefault` de `next/link`), le lien reçoit
 *   `aria-busy="true"` : le CSS (`globals.css`) atténue le lien ou garde la ligne de liste pressée ; chez le personnel,
 *   son chevron laisse place à un indicateur (`NAV_INDICATOR_CSS`). Aucun saut de mise en page.
 * - Après 150 ms, la fine barre de progression `#nx-nav` apparaît en haut de la page (sous la zone de sécurité).
 * - Fin : quand l'adresse change vraiment (`pushState` / `replaceState` appelés par Next.js à l'arrivée de la page,
 *   ou retour arrière), ou au plus tard après 15 s (lien vers un fichier, navigation interrompue).
 * Ignorés : nouvel onglet, touches de modification, `download`, `data-no-nav-feedback`, autre origine, `/api/`, ancre ou
 * même adresse.
 */
export const NAV_FEEDBACK_DELAY_MS = 150;

/** Lien dont le toucher déclenche une navigation interne suivie (règles ci-dessus), ou `null`. */
export function trackedLink(event: MouseEvent, here: Location): HTMLAnchorElement | null {
  const a = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-no-nav-feedback")) return null;
  const url = new URL(a.href, here.href);
  if (url.origin !== here.origin || url.pathname.startsWith("/api/") || url.pathname + url.search === here.pathname + here.search) return null;
  return a;
}

let installed = false;

export function installNavFeedback(): void {
  if (installed) return;
  installed = true;
  let from = "";
  let show: ReturnType<typeof setTimeout> | undefined;
  let stop: ReturnType<typeof setTimeout> | undefined;
  const end = () => {
    from = "";
    clearTimeout(show);
    clearTimeout(stop);
    document.getElementById("nx-nav")?.removeAttribute("data-on");
    document.querySelectorAll("a[aria-busy]").forEach((a) => a.removeAttribute("aria-busy"));
  };
  document.addEventListener(
    "click",
    (event) => {
      const a = trackedLink(event, location);
      if (!a) return;
      end();
      from = location.href;
      a.setAttribute("aria-busy", "true");
      show = setTimeout(() => from && document.getElementById("nx-nav")?.setAttribute("data-on", ""), NAV_FEEDBACK_DELAY_MS);
      stop = setTimeout(end, 15_000);
    },
    true,
  );
  for (const key of ["pushState", "replaceState"] as const) {
    const original = history[key];
    history[key] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      if (from && location.href !== from) end();
      return result;
    };
  }
  addEventListener("popstate", end);
  addEventListener("pageshow", end);
}

/**
 * Indicateur des lignes de liste du personnel (`ListRow`, `[data-nav-indicator]`) : pendant la navigation, le chevron
 * laisse place à un cercle qui tourne (immobile si les animations sont réduites). Feuille propre au gabarit du
 * personnel : jamais dans la feuille commune des pages client.
 */
export const NAV_INDICATOR_CSS = `a[aria-busy=true] [data-nav-indicator]:empty{display:inline-flex;width:1.125rem;height:1.125rem}a[aria-busy=true] [data-nav-indicator]>svg{visibility:hidden}a[aria-busy=true] [data-nav-indicator]:after{content:"";position:absolute;inset:0;margin:auto;width:1rem;height:1rem;border-radius:50%;border:2px solid var(--label-secondary);border-top-color:transparent;animation:nxs .7s linear infinite}@keyframes nxs{to{transform:rotate(1turn)}}@media (prefers-reduced-motion:reduce){a[aria-busy=true] [data-nav-indicator]:after{animation:none}}`;
