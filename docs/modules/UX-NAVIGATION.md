# Correctifs après le LOT 6a — aperçu des publicités, réaction des navigations, code de présence TV

**Aucune migration.** Captures avant / après : `docs/captures/ux-navigation/` (`e2e/screenshots-ux-navigation.spec.ts`,
`UX_PHASE=before|after` : 700 ms après le toucher d'un lien, réseau ralenti de 2 s ; 390 et 1440 px, clair et sombre ;
écran TV d'une agence sans ticket à distance).

## 0. Aperçu des publicités (alertes CodeQL « DOM text reinterpreted as HTML », `ad-preview.tsx`)

- Leonel a classé les deux alertes en faux positif : la source est `URL.createObjectURL(fichier choisi)` ou `adFileUrl`
  (chemin du stockage encodé), utilisée seulement dans le `src` d'une image ou d'une vidéo.
- Protection ajoutée : `safeMediaSrc` (`lib/ads/media-src.ts`, testée) n'accepte qu'une adresse `blob:` (dont l'origine
  intérieure est http(s)) ou un fichier du bucket public `ad-creatives` du projet Supabase (même origine, adresse
  normalisée : pas de remontée `..`, pas d'autre bucket). Sinon l'aperçu montre son état vide.

## 1. Réaction immédiate à chaque navigation

Constat (iPhone) : « Mes établissements » → toucher l'établissement : rien ne bougeait pendant 1 à 3 s.

- **Lien touché** : `NavFeedback` (composant client du gabarit racine, `lib/ui/nav-feedback.ts`) écoute les clics en
  capture (avant le `preventDefault` de `next/link`) et met `aria-busy="true"` sur le lien interne touché. CSS :
  lien atténué (barre latérale, onglets, `IconLink`, boutons-liens, retours), ligne de liste (`data-row-link`) gardée
  pressée ; chez le personnel, le chevron (`[data-nav-indicator]`) laisse place à un cercle qui tourne
  (`NAV_INDICATOR_CSS`, gabarit du personnel), immobile si les animations sont réduites. Aucun saut de mise en page.
- **Barre de progression** `#nx-nav` : 2 px, couleur d'accent, sous la zone de sécurité, après 150 ms ; pleine et
  immobile si les animations sont réduites.
- **Fin** : quand l'adresse change vraiment (`pushState` / `replaceState` de Next.js à l'arrivée de la page, retour
  arrière), ou au plus tard après 15 s. Ignorés : nouvel onglet, touches de modification, `download`,
  `data-no-nav-feedback` (lien vers un fichier sans `download`), autre origine, `/api/`, même adresse.
- Retour tactile `pressable` ajouté aux onglets client et aux lignes de « Mes établissements » (liens faits main, qui
  reçoivent aussi `data-row-link` et l'indicateur).
- Aucun `loading.tsx` ajouté (règle inchangée sur les segments qui font `notFound`).

### Écart avec la demande : pas de `useLinkStatus`

`useLinkStatus` demande un composant client dans chaque lien : du JS en plus sur toutes les pages client, déjà au
plafond. Un seul écouteur global donne le même résultat pour tous les liens (y compris ceux faits main) pour quelques
centaines d'octets. Un premier essai en script en ligne coûtait deux fois (HTML et données RSC) : remplacé par un
composant client intégré au fichier JS déjà chargé par le gabarit (les écouteurs s'installent à l'hydratation, avant
laquelle `next/link` ne navigue pas côté client).

### Budget des pages client

Les pages client étaient déjà au plafond (LOT 6a : 373 à 379 octets de marge sur `/q` vu d'un iPhone). Pour ne rien
dépasser, la feuille commune a été allégée de règles réservées au personnel : ombres arbitraires remplacées par des
styles en ligne ou des classes existantes, grilles arbitraires remplacées par trois classes à variables
(`md|lg|xl:grid-cols-[var(--…-cols)]`, `@3xl:grid-cols-[var(--cq-cols)]`), animation `call-flash` inutilisée retirée,
variante teintée de `CalloutCard` sortie dans `TintedCallout` (plus dans le JS de `/q`), requêtes média des écrans de
démarrage iOS écrites sans espaces.

Mesures (téléphone, `e2e/client.spec.ts`, `e2e/remote.spec.ts`, `e2e/ads.spec.ts`) : `/` 182 Ko, `/scan` 173 Ko,
`/c` 184 Ko, `/t` 183 Ko, `/profile` 192 Ko, `/q/…` 199 Ko (iPhone 200 Ko, sous 204 800 octets : marge de 225 à 480 octets
selon l'essai), `/t/…` 197 Ko (avec publicité 198 Ko, iPhone 198 Ko), `/nearby` 197 Ko, `/b/…` 199 Ko, `/b/…/rdv` 199 Ko.
La marge reste faible : tout ajout aux pages client doit être compensé.

## 2. Écran TV — code de présence seulement si utile

`/api/tv/session` ne demande `tv_presence_code` (et n'ajoute `?p=…` au QR) que si l'agence de l'écran a
`remote_tickets_enabled` (lecture de `branch_settings` en service role, après validation du jeton). Sinon
`presence_url` = `entry_url` et le pied de l'écran n'affiche pas « Code de présence ». `confirm_presence` inchangée.

## Liste de contrôle (UX §7)

- [x] 5 états : inchangés (la barre ne remplace aucun état ; elle signale l'attente entre deux pages).
- [x] axe clair et sombre pendant et après la navigation (`e2e/ux-navigation.spec.ts`, `e2e/responsive.spec.ts`).
- [x] Clavier : la navigation au clavier (Entrée sur un lien) passe par le même clic ; focus des lignes de « Mes
  établissements » dessiné à l'intérieur de la ligne.
- [x] Texte à 200 % : aucune taille fixe ajoutée.
- [x] 360 / 768 / 1280 px : captures 390 et 1440 px, test responsive complet.
- [x] Aucun texte ajouté.
- [x] Budget 200 Ko : mesures ci-dessus.
- [x] Nouvelle règle : réaction visible en moins de 100 ms, barre au-delà de 150 ms.

## Tests

- Vitest : `lib/ads/media-src.test.ts` (`blob:` et bucket acceptés ; `javascript:`, `data:`, `blob:javascript:`,
  autre domaine, autre bucket, remontée de dossier refusés).
- Playwright : `e2e/ux-navigation.spec.ts` (réseau ralenti de 2 s : ligne de « Mes établissements » en cours avec
  indicateur, barre visible, tout disparaît à l'arrivée ; barre latérale ; onglet client ; écran TV sans ticket à
  distance sans code, avec code affiché), `e2e/backlog.spec.ts` (code accepté par `confirm_presence`),
  `e2e/pwa-ios-meta.spec.ts`, budgets client.
