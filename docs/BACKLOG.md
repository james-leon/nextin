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

### Bouton « Exporter » du tableau de bord
Sur ordinateur, le bouton « Exporter » de la barre de navigation du tableau de bord est collé au bord haut de l'écran, voire coupé. Il doit être aligné verticalement avec le titre et garder la marge de la barre de navigation, aussi quand le grand titre se réduit au défilement. Ajouter une capture Playwright à 1440 px qui le vérifie (boîte entièrement visible, marge haute ≥ 8 px).
