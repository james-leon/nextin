# U1 — Qualité UX (écarts du §0 du référentiel UX)

## Livré
- **Titres** : `h1, h2, h3` sans césure (`hyphens: none`), lignes équilibrées (`text-wrap: balance`), coupure en
  dernier recours seulement (`overflow-wrap: break-word`) — « Scannez pour com-mencer » n'existe plus. Contrôlé sur
  les pages principales par `e2e/a11y-pages.spec.ts`.
- **Erreurs** : `error.tsx` pour le personnel `(staff)` et la connexion `(auth)` (`ErrorScreen` : titre, explication,
  « Réessayer » qui relance le segment, lien vers l'accueil, référence technique) ; `global-error.tsx` à la racine
  (couleurs système, sans la feuille de style, langue du navigateur). Textes FR/EN : `ERROR_TEXTS`
  (`@nextin/shared/i18n/error-texts`), source unique, utilisable sans fournisseur de traductions.
- **Squelettes** (`loading.tsx`, `components/ui/page-skeletons.tsx`, rendus par le serveur) : choix du service
  (`/q/[code]`), poste de l'agent (`/desk/counter/[id]`), accueil (`/desk/reception/[id]`, groupe `(queue)` pour ne
  pas couvrir « Rendez-vous »).
- **États vides** : `EmptyState` (icône, titre, texte, action ; `card` ou `inline` dans une liste groupée) sur les
  listes d'agences, services, guichets, praticiens, invitations, file de l'accueil, rendez-vous, demandes, console
  (abonnements, campagnes), annonceur (campagnes, caissiers), tableau de bord.
- **Mises à jour optimistes** (`useOptimistic`, retour arrière et message en cas de refus) : invitations en attente
  (`PendingInvitations`), double authentification pour tout le personnel (`OrgMfaSwitch`).
- **« Annuler » 5 s** : retrait d'une invitation — masquée aussitôt, bannière « Invitation de … annulée · Annuler »
  (`ToastProvider` accepte désormais une action et une durée), envoi à la base après 5 s (`withdrawInvitation`).
- **Accessibilité** : axe en clair et en sombre sur les pages principales hors gabarits (connexion, inscription,
  pages légales, aide, code, TV, paiement, invitation, page introuvable) ; les écrans du personnel et les pages
  client restent couverts par `responsive.spec.ts` (3 tailles, clair et sombre). « 404 » passé en
  `text-label-secondary` (contraste).

## Budget de 200 Ko des pages client (règle absolue) : arbitrages
Mesuré contre la version précédente (mêmes données) :
- un `error.tsx` dans le groupe client ajoutait **≈ 5 Ko à chaque page client** (mécanique d'erreur de Next) :
  les pages client s'appuient sur `global-error.tsx` (bilingue, 1,3 Ko) ;
- un squelette coûte ≈ 2 Ko : gardé sur `/q/[code]` (198 Ko) ; pas sur `/t/[token]` (199 Ko, à la limite), `/nearby`
  et `/b/[id]` ;
- compensations : seules les clés de `common` lues par les composants client partent (`CLIENT_COMMON_KEYS`), la carte
  « Jouer en attendant » est chargée à la demande (`next/dynamic`, montée 3 s après le chargement), « À proximité »
  affiche 8 établissements (grande carte + 7 lignes, `NEARBY_LIMIT`).
Résultat (même base de données) : `/` 179 Ko (−3), `/t` 199 Ko (=), `/q` 198 Ko (+2), `/nearby` 197 Ko (=),
`/help` 181 Ko, `/pay` 195 Ko.

## Non retenu
- Un squelette générique du back-office (`/app/o/[orgId]/loading.tsx`) : en rendu par flux, les pages refusées
  (`notFound()`) répondaient 200 au lieu de 404 ; le contrôle d'accès s'appuie sur ce 404.
