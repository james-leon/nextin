# Refonte v2 — LOT 5a : postes, patient, compte, démarrage et diagnostic

Ce lot corrige les LOTS 2 et 3 d'après les maquettes v2 20 (postes, compléments), 21 (patient, compléments) et 22
(compte, compléments), avec 01, 02, 03, 04, 08 et 13 pour le style. Les textes du dictionnaire priment ; les données des
maquettes sont des exemples. Interface seulement, sauf le délai de renvoi du code d'une demande de rendez-vous (B10),
vérifié par la base : **une migration** (`20261201090000_lot5a_request_code_cooldown.sql`, additive).

Captures : `docs/captures/v2-lot5a/` (390, 768 et 1280 px, clair et sombre ; `e2e/screenshots-v2-lot5a.spec.ts`).

## Écrans refaits

| Écran | Route | Maquette v2 |
|---|---|---|
| Choix du poste (listes groupées, retour « Établissements ») | `/desk` | 20 |
| Accueil : file d'abord sur téléphone, encadré orange « Demande d'aide » avec « Traité », ★ et minutes d'attente | `/desk/reception/[id]` | 20 |
| Feuilles d'action iOS (Annuler / titre / action) : actions du ticket, priorité avec motif, nom, transfert, absence ou retard, nouveau ticket puis « Ticket créé » | accueil et poste | 20 |
| Agenda du jour par praticien : ligne de l'heure, arrivé vert, absent gris, demande orange pointillée, congé hachuré ; détail avec « Marquer arrivé » | `…/appointments` | 20 |
| Demandes en ligne en maître-détail : confirmer, proposer un autre créneau, refuser | `…/appointments?view=requests` | 20 |
| Poste : bandeau orange hors ligne avec le nombre d'actions, « Absent » confirmé, raccourcis, mode compact | `/desk/counter/[id]` | 20 |
| Ticket imprimé 80 et 58 mm, sans nom | `/desk/print/[id]` | 20 |
| « Mon ticket » : appel manqué orange, agence fermée ou aucun poste ouvert, options groupées « Être prévenu » et « Aide », toast « Demande envoyée », annulation à boutons empilés | `/t/[jeton]` | 21 |
| Ticket terminé, annulé, clôturé (note du passage, nouveau ticket) | `/t/[jeton]` | 21 |
| Paiement : montant en tête, opérateurs, « Validez sur votre téléphone », reçu, échec (« Aucun montant n'a été débité »), déjà payée, lien expiré | `/pay/[jeton]` | 21 |
| Bon de réduction, CGU, page introuvable, erreur, page hors ligne | `/coupon/…`, `/cgu`, 404, `offline.html` | 21 |
| Demande de rendez-vous : coordonnées groupées, code en six cases, « Renvoyer le code » après 60 s (compte à rebours qui reprend après rechargement), « Ajouter au calendrier » | `/b/[id]/rdv`, `/r/[jeton]` | 21 |
| Nouveau mot de passe : règles cochées en direct, bouton grisé tant qu'elles ne sont pas remplies | `/reset-password` | 22 |
| Double authentification : exigée, configuration en trois étapes (QR, clé groupée par 4, code en cases), « Activée », désactivation confirmée, « Téléphone perdu ? » | `/app/settings/security` | 22 |
| Feuille « Confirmez votre identité » (validation au sixième chiffre) | actions sensibles | 22 |
| Session fermée (bandeau bleu sur la connexion), invitation expirée, déjà utilisée ou introuvable | `/login`, `/invite/[jeton]` | 22 |
| Écran de démarrage : icône, « NextIn » 28 pt gras, slogan, trois points | filet HTML et images iOS | 01 |
| Diagnostic de l'application installée | `/debug/pwa` | — |

## Composants et règles ajoutés

- `Sheet` : en-tête iOS (`cancelLabel`, `action` / `SheetAction`, `titleHidden`) ; `ActionSheet` (feuille d'actions
  iOS) ; `AlertDialog stacked` (boutons empilés) ; `CodeBoxes` contrôlé (`value` / `onValueChange`).
- `DayAgenda` (`components/appointments/day-agenda.tsx`) ; `OptionList` / `OptionRow` (options sous le ticket,
  composant minimal pour le budget) ; `TicketEnded` (chargé seulement pour un ticket fini, textes `client.ticketEnded`
  via `/api/i18n/ticket-ended` s'ils manquent).
- `passwordRules` / `passwordProgress` (`@nextin/shared`, testés) : mêmes règles que `passwordSchema`.
- Renvoi du code d'une demande (B10) : `issue_request_code` refuse un nouveau code moins de 60 s après le précédent
  (`rate_limited`, en plus de la limite de trois codes) ; test `request_code_cooldown.test.sql`. Compte à rebours
  calculé depuis `code_expires_at` (reprend après rechargement).
- « Ajouter au calendrier » : `/r/[jeton]/calendar` (`lib/calendar/ics.ts`, testé) — fuseau Africa/Douala, rappel 1 h
  avant, aucune donnée personnelle dans l'URL ni dans l'événement.
- `format-detection` (`telephone=no, email=no, address=no`) écrit dans `AppleWebAppTags` : iOS ne souligne plus les
  numéros ni les adresses masquées.
- `scroll-fade-x` positionné (`position: relative`) : les textes `sr-only` des pastilles ne débordaient plus de la page
  sur Android (barre du bas coupée sur la demande de rendez-vous).
- Postes : heure courante par `useNow` (`lib/desk/now.ts`) — null pendant l'hydratation, plus d'erreur React n° 418
  (chrono calculé avec l'heure du serveur puis du navigateur ; erreur présente depuis le M5, repérée par le journal E).

### D — écran de démarrage

- Une seule source, `lib/pwa/splash.ts` : CSS en ligne et HTML du filet (`#nx-s` dans le gabarit racine) et images iOS
  `apple-touch-startup-image`, rendues par Chromium depuis ce même HTML (`node --experimental-strip-types
  scripts/generate-startup-images.mjs`, police Inter, PNG en palette ≤ 15 Ko).
- Images en clair et en sombre, **en français et en anglais** (`-en.png`), choisies par la langue de la page.
- Filet : opaque au-dessus de la page tant que la feuille de style n'est pas appliquée (jamais de HTML brut), fond de
  l'application (pas de flash blanc), points immobiles si les animations sont réduites, icône après 1 s, effacé au bout de
  12 s si la feuille ne vient jamais ; masqué par `html body #nx-s` dans `globals.css`.

### E — diagnostic de l'écran blanc sur iPhone

- `POST /api/client-log` : erreurs JavaScript, promesses rejetées (script en ligne `clientErrorScript`, cinq au plus par
  page, `sendBeacon`) et navigations en échec du service worker (`navigation_timeout_offline`, `navigation_failed_cached`,
  `navigation_http_500`…, avec la version). 2 Ko au plus, dix par minute par empreinte d'adresse IP (en mémoire), schéma
  Zod strict ; ligne `[client-log]` dans les journaux (Vercel → Logs) avec la famille d'appareil seulement ; adresses
  e-mail, numéros, jetons et UUID masqués (`scrub`, testé) ; rien en base.
- `/debug/pwa` (non indexée, sans compte) : état et version du service worker, mode « écran d'accueil », caches et
  nombre d'entrées, dernière erreur (gardée sur l'appareil), « Réinitialiser » (désinstalle, vide les caches, recharge).
- `NEXT_PUBLIC_SW_ENABLED` (lu à l'exécution, `true` par défaut) : `false` désinstalle le service worker et efface
  ses caches à la visite suivante. Service worker `nextin-v4`.

## Budget des pages client

Le filet de démarrage et le script d'erreurs partent dans chaque page. Pour rester sous 200 Ko :
`React.lazy` (`lib/client/lazy.tsx`, `lazyComponent`) au lieu de `next/dynamic` sur « Mon ticket » (≈ 2 Ko de
chargeur en moins), en-tête rendu par le serveur pour un ticket inconnu (sans `NavigationBar`, 1,7 Ko), liste fermée
des erreurs de la prise de ticket sur `/q` (≈ 2 Ko ; repli « generic » existant), script du thème hors du JavaScript
client (`theme-init.ts`). Mesures (iPhone) : `/` 182 Ko, `/q/…` 199 Ko, `/t/…` 197 Ko.

## Écarts volontaires avec les maquettes

- Impression du ticket gardée dans la feuille d'actions de l'accueil (la maquette la place dans la barre).
- Détail d'un rendez-vous : « Marquer arrivé » (texte du dictionnaire) au lieu de « Arrivée du patient ».
- Couleur des pastilles de praticiens : jetons existants (aucune couleur en dur) ; la couleur « annonceur » de la
  maquette n'existe pas, remplacée par le vert.
- Hachures du congé en style en ligne (dégradé répétitif), hors de la feuille commune (budget).
- Session fermée : l'adresse e-mail n'est pas préremplie (aucune donnée gardée après la fermeture).
- Demande en attente : la ligne « Demandé » montre le créneau souhaité (seule information de créneau) ; masquée une fois
  accepté, « Vous aviez demandé » quand l'accueil propose un autre créneau.
- Fond de l'écran de démarrage : `bg-grouped` (#F2F2F7 / noir) au lieu du blanc de la maquette, pour qu'il n'y ait
  aucun saut entre l'image iOS, le filet et l'application (même couleur que `theme-color` et le manifeste).

## Éléments absents (non inventés)

- Codes de secours de la double authentification : remplacés par « Téléphone perdu ? Contactez le support Wintek ».
- Couleur propre à chaque annonceur sur l'agenda : aucune donnée.
- Rappel de rendez-vous par SMS pour une demande par e-mail : canal non activé dans `request_channels`.

## Tests

- Vitest : `password.test.ts`, `ics.test.ts`, `client-log.test.ts`, `startup-images.test.ts` (images FR/EN, ≤ 60 Ko).
- pgTAP : `request_code_cooldown.test.sql`.
- Playwright : `account.spec.ts`, `request-journey.spec.ts` (360/390/412 px), `pwa-diagnostics.spec.ts`,
  `pwa-slow-network.spec.ts` (filet), `pwa-ios-meta.spec.ts` (images EN), `desk.spec.ts` (aucune erreur
  d'hydratation au rechargement), `responsive.spec.ts` et `a11y-pages.spec.ts` (ticket inconnu, `/debug/pwa`).

## Migration à pousser

- `supabase/migrations/20261201090000_lot5a_request_code_cooldown.sql` (remplace `issue_request_code`, mêmes
  paramètres : compatible avec le code en ligne).
