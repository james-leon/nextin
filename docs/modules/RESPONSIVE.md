# Revue responsive — P1 et P2

Statut : **P1 validé ; P2 terminé, en attente de validation**. Référence : `docs/REVUE-RESPONSIVE.md`.
Captures : `docs/captures/responsive/before/` (avant, clair) et `docs/captures/responsive/` (après, clair et `-dark`), en 390, 820, 1180, 1440 et 1920 px, plus le mode compact du poste en 400 × 600.

## Règles globales
### R1 — Pleine largeur sur ordinateur
- `AdminPage` est large par défaut : zone de contenu jusqu'à `max-w-7xl`, marges de 16 px (téléphone), 32 px (tablette) et 40 px (ordinateur). `wide` est supprimé ; `narrow` (colonne centrée) est réservé aux formulaires purs et aux écrans repris au P2/P3.
- Les listes ne s'étirent plus : **maître-détail** (Agences et services, Services, Guichets et cabinets, Praticiens) ou **tableau** (Personnel).

### R2 — Tablette façon iPad
- Paysage (≥ 1024 px) : barre latérale visible.
- Portrait : barre latérale repliable — bouton en haut à gauche de la barre de navigation, panneau par-dessus le contenu, fermé par Échap, par le voile ou en suivant un lien ; le focus revient au bouton.
- Maître-détail en deux colonnes dès 768 px ; poste médecin en deux colonnes dès 768 px ; taille de texte inchangée.

### R3 — Action principale
- Téléphone : barre fixe en bas, à la largeur du contenu ; le contenu garde une marge basse suffisante.
- Tablette : barre en fin de contenu, collée au bas de la fenêtre au défilement, exactement à la largeur du contenu.
- Ordinateur : l'action remonte dans la barre de titre, à droite du grand titre (`PageFrame`), et y reste quand le titre se réduit. Un bouton « Enregistrer » y reste relié à son formulaire (attribut `form`).

### R4 — Textes
- `ListRow` : sous-titre sur deux lignes au plus, coupé avec des points de suspension (adresses e-mail comprises) ; plus aucun débordement hors de l'écran.
- Bouton retour : libellé entier s'il tient, sinon chevron seul (le libellé reste pour les lecteurs d'écran) ; jamais un mot coupé.
- `SegmentedControl` : une seule ligne (« Demandes · 2 »).
- Rangées de pastilles (praticiens, dates) : défilement horizontal avec dégradé sur les bords (`scroll-fade-x`).
- Vérifié à 360 px, avec la taille de texte à 100 % et 125 %.

## Écrans
| Écran | Téléphone | Tablette | Ordinateur |
|---|---|---|---|
| Agences et services | liste | liste + fiche | liste (≈ 320–380 px) + fiche, résumé chiffré sans agence choisie, « + » dans la barre |
| Agence | une colonne | une colonne | Structure / Fonctionnement en deux colonnes, carte « Ouvrir les postes » |
| Services, Guichets, Praticiens | liste puis détail | liste + édition | liste + édition à droite sans changer de page, élément surligné, « Enregistrer » dans la barre de titre |
| Personnel | liste (sous-titre sur deux lignes) | liste, « Inviter » en bas à la largeur du contenu | tableau (nom, rôle, agences, e-mail, statut, actions), « Inviter un membre » dans la barre de titre |
| Choix du poste | tuiles | 2 par ligne | 3 par ligne, statut et praticien |
| Poste médecin | maquette 04 | deux colonnes, bouton principal dans la colonne | deux colonnes (1180, 1440, 1920 px) ; mode compact utilisable en 400 × 600 |
| Accueil | une colonne | rendez-vous en haut, puis services / file | Services et praticiens / File d'attente / Rendez-vous du jour, « Nouveau ticket » dans la barre de titre |
| Rendez-vous | liste, feuilles | liste, semaine en colonnes | jour : liste + résumé du jour (nombre, arrivés, absents, prochains) ; semaine : agenda horaire, une colonne par jour, rendez-vous à leur heure et à leur durée |
| Nouvelle campagne | une colonne | une colonne | deux colonnes, récapitulatif (prix, période, ciblage) collé à droite ; villes avec recherche et hauteur limitée |

Corrigés au passage (critère 3 sur toutes les pages) : en-tête et choix mensuel / annuel de l'Abonnement à 360 px.

## Données de test (section 3)
Les captures sont prises sur une base propre (`pnpm db:reset` puis `pnpm seed:demo:local`) : seules les données de démo apparaissent. Les tests e2e créent leurs propres établissements (noms uniques) sur la base locale, jamais sur la base de démo distante.

## Tests
| Suite | Contenu |
|---|---|
| Playwright `responsive.spec.ts` | 21 écrans du personnel et de l'annonceur en 360, 390, 820, 1180, 1440 et 1920 px : aucun débordement horizontal ni texte coupé (aussi à 125 %), dernière ligne visible au-dessus des barres fixes, action principale visible sans défilement, aucune zone vide de plus de 40 % sur ordinateur, cibles tactiles sur téléphone et tablette, axe en clair et en sombre (390, 820, 1440). Barre latérale repliable, maître-détail, action dans la barre de titre, retour jamais tronqué, segmented control sur une ligne |
| Vitest `agenda.test.ts` | Minutes dans le fuseau de l'agence, plage horaire, couloirs des rendez-vous qui se chevauchent |

## P2
Captures avant : `docs/captures/responsive/before-p2/` (clair) ; après : `docs/captures/responsive/` (clair et `-dark`).

### Retouches du P1
- Rangées de pastilles (praticiens, dates) : fondu sur le bord qui défile — à droite tant que la rangée continue, à gauche une fois défilée (animation pilotée par le défilement ; repli : fondu fixe à droite).
- Choix du poste : barre latérale du personnel (Mes établissements, Postes, Espace annonceur, Réglages), contenu aligné sur les autres pages (`max-w-7xl`).

### R5 — Pages client sur ordinateur
- À partir de 1024 px, la barre d'onglets devient une barre latérale façon Mac : logo NextIn en tête, Scanner, À proximité, Mon ticket, Profil ; ligne choisie en accent plein. Même composant (CSS seulement) : rien de plus à charger.
- « Mon ticket » : deux colonnes (backlog), conservées.
- « À proximité » : avec un fournisseur de tuiles, liste à gauche et carte à droite sur toute la hauteur ; sans tuiles, la carte schématique est masquée et la liste s'élargit en grille de cartes (2 ou 3 par ligne).
- Barre d'action des pages client sur tablette : à la largeur de la colonne du contenu.
- Budget : onglets sans préchargement, rechargements d'« À proximité » limités à 20 agences ; pages client ≤ 198 Ko.

### R6 — Écrans peu remplis
- Mes établissements : grille équilibrée sur ordinateur (établissements, Ouvrir les postes, Espace annonceur, Console Wintek, carte « + » Créer un établissement) ; liste groupée inchangée sur téléphone.
- Écrans TV sans écran : état vide centré, l'appairage à côté en action principale.
- Panneaux de détail sans élément choisi (P1) : résumé chiffré.

### Écrans
| Écran | Changement |
|---|---|
| Écrans TV | Grille de cartes (nom, services, en ligne / hors ligne, dernière activité, Gérer, Révoquer) ; appairage dans une colonne à droite |
| Réglages de l'agence | Deux colonnes : file et rendez-vous / distance et demandes ; « Enregistrer » dans la barre de titre |
| Abonnement | Téléphone : sélecteur de formule en haut, une formule affichée à la fois ; « Payer » selon R3 ; en-tête et période sans débordement à 360 px |
| Tableau de bord | Même zone que le back-office (`max-w-7xl`, marges 16/32/40 px) jusqu'en 1920 px |
| Écran TV | Interligne sans unité et espacements en vh : proportions identiques en 1280 × 720, 1920 × 1080 et 3840 × 2160, plus aucun texte rogné |

### Tests ajoutés
`responsive.spec.ts` couvre aussi les 8 pages client (visiteur anonyme) dans les six tailles et l'écran TV en 1280 × 720, 1920 × 1080 et 3840 × 2160 (aucun débordement ni texte coupé, pas de défilement, proportions constantes).

## Reste pour P3
Publicité de l'établissement (secteurs en grille de cases), choisir un service / scanner / code (carte centrée plus large sur ordinateur), campagne, valider un bon et console Wintek (R1 et R3 en 1920 px et sur tablette), ticket imprimé (inchangé).
