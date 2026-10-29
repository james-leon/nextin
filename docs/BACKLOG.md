# Backlog — améliorations pour la fin du développement

Points notés pendant les tests réels, à traiter **après le M11** (sauf décision contraire). Chaque entrée garde le contexte nécessaire pour être reprise telle quelle.

## Postes du personnel

### Vraie vue ordinateur du poste médecin / agent (`/desk/counter/[counterId]`)
Aujourd'hui, le poste est pensé pour le téléphone (maquette 04) et s'étire simplement sur grand écran.
- **Deux colonnes à partir de `lg`** :
  - à gauche, le patient en cours (carte Navy) et le bouton principal ;
  - à droite, « À suivre », les statistiques du jour et les actions secondaires.
- **Raccourcis clavier**, actifs hors champ de saisie et rappelés dans une aide (« ? ») :

  | Touche | Action |
  |---|---|
  | Espace | Alerter le suivant (suit `primaryAction` : Terminer et alerter le suivant si un patient est admis) |
  | Entrée | Admettre |
  | R | Rappeler |
  | T | Transférer (ouvre la feuille) |
  | A | Absent (avec confirmation) |
  | P | Pause / Reprendre |

  Les raccourcis doivent respecter les mêmes règles que les boutons : un raccourci indisponible ne fait rien, et le mode hors ligne s'applique.
- **Mode compact mémorisé** (préférence de l'appareil) : une petite fenêtre à placer à côté du logiciel médical, avec uniquement le numéro en cours, le chrono, le bouton principal et le nombre en attente. Cibles tactiles de 44 px conservées.

### Vérification de tous les écrans du personnel sur téléphone, tablette et ordinateur
Passer en revue, en clair et en sombre :
- `/app` et le back-office : établissements, agences, services, guichets, praticiens, membres, écrans, annonces, réglages ;
- les postes : choix, agent, accueil, ticket imprimé.

Pour chaque écran : mise en page, débordements, navigation (barre latérale ou barre d'onglets), feuilles et `BottomBar`. Ajouter des captures Playwright par taille (390, 820 et 1440 px) et corriger les écarts.

## Back-office sur ordinateur (relevé au test du M8, 28/10/2026)

### Menu latéral sur toute la hauteur
Sur ordinateur, la barre latérale du back-office (`/app/o/[orgId]/…`) s'arrête à la hauteur de la fenêtre quand la page est longue : en faisant défiler, le fond de la barre ne descend pas jusqu'en bas. Elle doit couvrir toute la hauteur, en restant fixe (`sticky top-0 h-dvh`, défilement propre si le menu est plus long que l'écran) et sans décaler la largeur de contenu (`--shell-sidebar`). Vérifier en clair et en sombre, sur une page courte et sur le tableau de bord en vue mois.

### Actions de la barre de navigation collées en haut (« Exporter », « Nouveau rendez-vous »…)
Sur ordinateur, les boutons placés dans la barre de navigation (`NavigationBar trailing`) sont collés au bord haut de l'écran, voire coupés : « Exporter » du tableau de bord, « Nouveau rendez-vous » de l'écran Rendez-vous de l'accueil (relevé au M9). Corriger une fois pour toutes dans `NavigationBar`, pour tous les écrans. Il doit être aligné verticalement avec le titre et garder la marge de la barre de navigation, aussi quand le grand titre se réduit au défilement. Ajouter une capture Playwright à 1440 px qui le vérifie (boîte entièrement visible, marge haute ≥ 8 px).

## Pages client (relevé au M9, 28/10/2026)

### « Mon ticket » sur ordinateur et tablette
`/t/<jeton>` reste une colonne de téléphone centrée sur grand écran (écran du M4). Prévoir deux colonnes à partir de `lg` : le ticket (héros, attente, « Quand partir ») à gauche ; alertes, itinéraire et actions à droite ; `TicketBottomActions` dans la colonne de droite plutôt qu'en barre fixe.

### Confirmation de présence plus sûre (ticket à distance)
Aujourd'hui, scanner le QR code imprimé de l'accueil (ou saisir son code court) confirme la présence : un code photographié reste valable. Option : QR code tournant affiché sur l'écran TV (jeton renouvelé chaque minute, accepté par `confirm_presence`), le QR imprimé restant valable pour prendre un ticket sur place.

### « À proximité » : icône du secteur de l'établissement
Chaque ligne de la liste (et la fiche de l'agence) affiche aujourd'hui un bâtiment générique. Utiliser une icône par secteur (`organizations.type` : clinique et hôpital, banque, télécom, électricité et eau, administration, autre), au trait fin façon SF Symbols (lucide), sur la tuile Navy ; même icône dans les repères de la carte si la place le permet. Libellé du secteur pour les lecteurs d'écran.

## Publicité et accessibilité (relevé au M10b, 29/10/2026)

### Contraste de la carte « C'est votre tour » (Mon ticket)
Le ticket appelé (`TicketHero state="called"`) affiche du texte blanc sur le vert Wintek `#2EC04E` : contraste 2,2:1, sous le niveau AA (4,5:1 pour le texte courant, 3:1 pour le grand numéro). Les tests du M4 ne passaient pas axe dans cet état ; celui du M10b l'a relevé. Options : vert plus profond réservé à ce fond (ex. `#187A31`, ≈ 5:1 avec le blanc), ou carte blanche avec bandeau et pictogramme verts. À trancher avec la maquette 03, puis ajouter axe dans l'état « appelé » au test `client.spec.ts`.

### Ciblage plus fin des formules plafonnées
Bronze et Argent retiennent les agences les plus anciennes du ciblage (5 et 15). Permettre à l'annonceur de choisir ses agences (liste à cocher, limitée au plafond), ou répartir par tirage équitable, et l'afficher avant le paiement.

### Application de caisse pour les bons
Scanner le QR code d'un bon directement depuis `/ads/redeem` (caméra, comme le scanner client), et ouvrir l'accès à des comptes « caissier » de l'annonceur sans droits sur les campagnes.

