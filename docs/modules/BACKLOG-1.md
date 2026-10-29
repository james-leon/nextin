# Backlog n° 1 — vues ordinateur, poste médecin, présence, caisse

Statut : **terminé, en attente de validation**. Reprend tous les points de `docs/BACKLOG.md` relevés du M8 au M10b.
Captures avant / après : `docs/captures/backlog/before/` et `docs/captures/backlog/after/` (390, 820 et 1440 px).

## Gabarit du personnel
- **Menu latéral sur toute la hauteur** (back-office, espace annonceur, console Wintek) : colonne de fond pleine hauteur, contenu `sticky top-0 h-dvh` avec son propre défilement. Les gabarits portent `data-shell="sidebar"`.
- **Actions de la barre de navigation alignées avec le titre** : sur ordinateur, tant que le grand titre est affiché, les actions (`trailing`) se placent à droite du titre, dans la marge de la barre ; elles remontent dans la barre réduite au défilement (« Exporter », « Nouveau rendez-vous »…).
- **Lien en double** : sur ordinateur, le lien de retour vers une rubrique déjà présente dans la barre latérale est masqué (`back.inSidebar`, calculé par `isSidebarDestination`, `lib/admin/nav.ts`). Doublons supprimés aussi sur la page de démarrage et les onglets de la modération.
- **« Mes établissements »** : liste groupée sur téléphone, grille de cartes sur ordinateur (une seule liste, `role="list"`) ; « Poste » et « Espace annonceur » côte à côte.
- **Revue de tous les écrans du personnel** sur téléphone, tablette et ordinateur : débordements corrigés (publicité de l'établissement, nouvelle campagne, rendez-vous, formules) ; toute grille responsive part de `grid-cols-1`.

## Poste médecin / agent (`/desk/counter/[counterId]`)
- **Deux colonnes à partir de `lg`** : patient en cours et bouton principal à gauche ; « À suivre », chiffres du jour et actions secondaires à droite. Sur téléphone, inchangé (maquette 04, `BottomBar`).
- **Raccourcis clavier** (`deskShortcut`, `@nextin/shared/desk`, testé) — aide « ? » dans une feuille :

  | Touche | Action |
  |---|---|
  | Espace | Action principale (ouvrir, reprendre, alerter le suivant, terminer et alerter) — jamais « Admettre » |
  | Entrée | Admettre le patient alerté |
  | R | Rappeler |
  | T | Transférer (ouvre la feuille) |
  | A | Absent, après confirmation |
  | P | Pause / Reprendre |
  | ? | Aide |

  Mêmes règles que les boutons (un raccourci indisponible ne fait rien, hors ligne compris) ; inactifs pendant une saisie, une feuille ou une alerte ; sur un bouton qui a le focus, Espace et Entrée gardent leur rôle.
- **Mode compact** mémorisé sur l'appareil (`nextin.desk.compact`) : numéro en cours, chrono, bouton principal et nombre en attente, à placer à côté du logiciel médical. Cibles de 44 px conservées.

## Pages client
- **« Mon ticket » sur ordinateur** : deux colonnes (ticket et attente fixés à gauche ; alertes, itinéraire, jeux et actions à droite, `TicketBottomActions` dans la colonne).
- **« C'est votre tour » lisible (AA)** : fond vert profond réservé à cet état (`bg-called`, `#187A31`, ≈ 5:1 avec le blanc) ; axe vérifié dans l'état appelé (`client.spec.ts`).
- **Icône du secteur** (`OrgTypeIcon`, `components/ui/org-type-icon.tsx`) dans la liste « À proximité », les repères de la carte et la fiche de l'agence, avec le libellé du secteur pour les lecteurs d'écran.
- **Budget** : le gabarit client ne transmet plus que `common` et `client.tabs` ; chaque page ajoute ses textes avec `LiteMessages paths={…}` (`lib/i18n/lite-server.tsx`). « À proximité » passe de 199 à 191 Ko, « Mon ticket » de 186 à 180 Ko.

## Présence plus sûre (ticket à distance)
- **QR code tournant de l'écran TV** : `/api/tv/session` renvoie `presence_url` (`<URL d'entrée>?p=<code>`), code de 6 caractères renouvelé chaque minute (`presence_code`, empreinte d'un secret par agence, `branch_presence_secrets`, illisible même par le personnel). `confirm_presence` accepte le code de la minute en cours et de la précédente.
- Réglage d'agence **« Présence confirmée seulement par l'écran TV »** (`remote_presence_tv_only`, désactivé par défaut) : le QR imprimé et le code court servent toujours à prendre un ticket, mais plus à confirmer une présence (`presence_tv_only`).

## Publicité
- **Choix des agences** pour les formules plafonnées (Bronze, Argent) : feuille à cocher limitée au plafond (`set_campaign_branches`, `too_many_branches`), avant la soumission ; liste des agences retenues affichée avant le paiement (`campaign_branch_list`). Sans choix, tirage au hasard parmi les agences du ciblage (au lieu des plus anciennes).
- **Caisse** : scan du QR code d'un bon depuis `/ads/redeem` (caméra, même module que le scanner client, `useQrCamera`). **Comptes caissier** ajoutés par le propriétaire (`/ads/cashiers`, `add_advertiser_cashier`) : ils ne voient que « Valider un bon », sans accès aux campagnes.

## Migrations
- `20261110090000_backlog_presence_code.sql` : code de présence tournant, réglage `remote_presence_tv_only`.
- `20261110090100_backlog_ads.sql` : agences choisies, tirage au hasard, rôle `cashier`.

## Tests
| Suite | Contenu |
|---|---|
| pgTAP `backlog_presence.test.sql` (14) | Code tournant (minute en cours et précédente), secret illisible, réglage « écran TV seulement », droits |
| pgTAP `backlog_ads.test.sql` (17) | Choix des agences (plafond, ciblage, droits), tirage, caissiers (ajout, retrait, droits limités, validation des bons) |
| Vitest `shortcuts.test.ts` (12) | Raccourcis selon l'état du poste, cibles autorisées |
| Playwright `backlog.spec.ts` | Gabarit ordinateur (actions alignées, barre latérale, pas de doublon, grille), poste médecin (deux colonnes, raccourcis, aide, confirmation d'absence, mode compact), ticket sur ordinateur, secteur dans « À proximité », présence par l'écran TV, choix des agences, caissier. Axe et cibles tactiles |
| Playwright `platform-home.spec.ts` | Super admin sans établissement → console ; avec établissement → « Console Wintek » en tête |

## À faire de votre côté
- Appliquer les deux migrations sur la base distante (`pnpm db:push`).
