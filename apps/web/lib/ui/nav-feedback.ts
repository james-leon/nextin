/**
 * Réaction immédiate à chaque navigation (toute l'application, pages client comprises) : petit script en ligne du
 * gabarit racine, sans React ni bibliothèque (budget de 200 Ko des pages client).
 *
 * - Au toucher d'un lien interne (capture du clic, avant le `preventDefault` de `next/link`), le lien reçoit
 *   `aria-busy="true"` : le CSS (`globals.css`, « Navigation en cours ») garde la ligne pressée et remplace son chevron
 *   par un indicateur (`[data-nav-indicator]`), ou atténue les autres liens — sans saut de mise en page.
 * - Après 150 ms, la fine barre de progression `#nx-nav` apparaît en haut de la page (sous la zone de sécurité).
 * - Fin : quand l'adresse change vraiment (`pushState` / `replaceState` appelés par Next.js à l'arrivée de la page,
 *   ou retour arrière), ou au plus tard après 15 s (lien vers un fichier, navigation interrompue).
 * Ignorés : nouvel onglet, touches de modification, `download`, `data-no-nav-feedback`, autre origine, `/api/`, ancre ou
 * même adresse.
 */
export const NAV_FEEDBACK_DELAY_MS = 150;

export const navFeedbackScript = `(function(){var d=document,l=location,on=0,from="",t1,t2;
function bar(){return d.getElementById("nx-nav")}
function end(){on=0;clearTimeout(t1);clearTimeout(t2);var b=bar();b&&b.removeAttribute("data-on");d.querySelectorAll('a[aria-busy="true"]').forEach(function(a){a.removeAttribute("aria-busy")})}
d.addEventListener("click",function(e){if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||(a.target&&a.target!=="_self")||a.hasAttribute("download")||a.hasAttribute("data-no-nav-feedback"))return;var u;try{u=new URL(a.href,l.href)}catch(x){return}if(u.origin!==l.origin||u.pathname.indexOf("/api/")===0||(u.pathname===l.pathname&&u.search===l.search))return;end();on=1;from=l.href;a.setAttribute("aria-busy","true");t1=setTimeout(function(){var b=bar();on&&b&&b.setAttribute("data-on","")},${NAV_FEEDBACK_DELAY_MS});t2=setTimeout(end,15000)},true);
["pushState","replaceState"].forEach(function(k){var o=history[k];history[k]=function(){var r=o.apply(this,arguments);on&&l.href!==from&&end();return r}});
addEventListener("popstate",end);addEventListener("pageshow",end)})()`;
