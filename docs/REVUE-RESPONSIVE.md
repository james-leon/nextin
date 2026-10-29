# NextIn — Revue responsive complète (téléphone, tablette, ordinateur)

Revue faite sur les captures docs/captures/backlog/before et after (23 écrans × 3 tailles) et les captures des modules M1 à M10b. Objectif : chaque écran occupe bien l'écran et reste confortable sur téléphone, tablette et ordinateur, dans le style Apple (comme une app iPhone, iPad et Mac).

Ordre : P1 (bloquant pour la mise en ligne), puis P2, puis P3. Arrêt pour validation après chaque niveau, avec captures avant/après.

## 1. Règles globales

### Tailles à couvrir (captures obligatoires pour chaque écran)
- Téléphone : 390 × 844 (et vérification à 360 px)
- Tablette portrait : 820 × 1180
- Tablette paysage : 1180 × 820
- Ordinateur : 1440 × 900
- Grand écran : 1920 × 1080

### R1 — Plus de « colonne de téléphone au milieu de l'écran » (P1)
Constat : sur ordinateur, la plupart des pages du back-office et des postes sont limitées à max-w-3xl (≈ 768 px). Sur 1440 px avec menu latéral, plus de la moitié de l'écran est vide (Agences et services, Agence, Personnel, Praticiens, Services, Guichets, Écrans, Réglages, Postes).
Règle :
- Zone de contenu du back-office : pleine largeur disponible à droite du menu, largeur maximale max-w-7xl (≈ 1280 px), marges latérales de 32 à 48 px sur ordinateur.
- Les listes ne s'étirent pas sur 1200 px : mise en page maître-détail (liste à gauche ≈ 380 px, détail ou formulaire à droite, comme Réglages sur iPad/Mac) ou grille de cartes (2 à 4 colonnes).
- max-w-3xl reste réservé aux formulaires purs (création, édition), centrés dans la zone.
- Le large devient la règle sur ordinateur, l'étroit l'exception (supprimer « wide » comme exception).

### R2 — Tablette = vraie mise en page iPad (P1)
- Tablette paysage (≥ 1024 px) : menu latéral visible, comme sur ordinateur.
- Tablette portrait : menu latéral repliable (bouton en haut à gauche, comme iPadOS) ; deux colonnes quand il y a liste + détail.
- Taille du texte identique au téléphone (échelle iOS), jamais réduite.

### R3 — Barre d'action du bas alignée sur le contenu (P1)
Constat : sur ordinateur et tablette, la BottomBar (« Ouvrir le poste », « Nouveau ticket », « Payer », « Nouveau rendez-vous ») n'a pas la même largeur ni le même alignement que le contenu, et masque parfois le bas des listes.
Règle :
- Sur ordinateur, l'action principale remonte dans la barre de titre (à droite du grand titre, comme « Exporter ») ou dans le panneau de détail ; pas de bouton flottant en bas d'un écran de 1440 px.
- Sur téléphone et tablette portrait, la BottomBar a exactement la largeur et les marges du contenu, et le contenu a une marge basse ≥ hauteur de la barre + 16 px (aucune ligne cachée dessous).

### R4 — Textes jamais coupés ni débordants (P1)
- Téléphone : les sous-titres des lignes de liste débordent hors de l'écran sans points de suspension (ex. Personnel : e-mail coupé au bord). Dans ListRow : min-w-0 + truncate, ou retour à la ligne sur 2 lignes maximum.
- Téléphone : boutons retour tronqués (« Vue d'ens… », « Agences et … », « Cam… »). Règle iOS : si le libellé ne tient pas, afficher seulement le chevron avec un libellé court, ou « Retour » ; jamais un mot coupé.
- Segmented control : jamais sur deux lignes (Rendez-vous, téléphone : « Demandes (2) »). Raccourcir (« Demandes · 2 ») ou défilement horizontal.
- Rangées de pastilles (filtres praticiens, villes) : défilement horizontal avec dégradé de bord, jamais coupées net.
- Vérifier à 360 px et avec la taille de texte du navigateur à 125 %.

### R5 — Pages client sur ordinateur (P2)
Constat : la barre d'onglets iPhone (Scanner, À proximité, Mon ticket, Profil) reste en bas d'un écran de 1440 px.
Règle :
- À partir de 1024 px : barre d'onglets remplacée par une barre latérale ou une barre supérieure (style Mac), logo NextIn à gauche.
- « Mon ticket » ordinateur : deux colonnes (fait au backlog, à garder).
- « À proximité » ordinateur : liste à gauche, carte à droite sur toute la hauteur ; sans fournisseur de tuiles, le plan schématique ressemble à une grille vide : afficher des repères (quartiers) ou masquer la carte et élargir la liste.

### R6 — États vides et écrans peu remplis (P2)
- Un écran avec 1 à 3 éléments sur ordinateur ne doit pas laisser 70 % de vide : panneau utile (résumé, aide de démarrage, raccourcis) ou état vide centré avec illustration et action principale.
- Postes (choix du poste) : grille de tuiles (Accueil, Cabinets, Caisse, Labo) avec statut et praticien, 3 à 4 par ligne sur ordinateur.
- Mes établissements : avec un seul établissement, la carte isolée et le petit bouton « Créer un établissement » paraissent perdus : grille équilibrée (établissement, Ouvrir les postes, Espace annonceur, Console Wintek si super admin, Créer un établissement en carte « + »).

## 2. Corrections écran par écran

### Back-office directeur
- P1 Agences et services : maître-détail (liste des agences à gauche, fiche de l'agence à droite) ; « Nouvelle agence » dans la barre de titre.
- P1 Agence : sections en 2 colonnes sur ordinateur (Structure : services, guichets, QR, écrans / Fonctionnement : horaires, réglages, informations) ; « Ouvrir les postes » en carte.
- P1 Services, Guichets, Praticiens : maître-détail, édition à droite sans changer de page.
- P1 Personnel : tableau sur ordinateur (nom, rôle, agences, e-mail, statut, actions) ; téléphone : sous-titre sur 2 lignes, sans débordement ; « Inviter un membre » dans la barre de titre.
- P2 Écrans TV : grille de cartes (nom, agence, services, en ligne/hors ligne, dernière activité, révoquer).
- P2 Réglages de l'agence : formulaire en 2 colonnes sur ordinateur, barre d'enregistrement selon R3.
- P2 Tableau de bord : vérifier 1920 px (grille de 4 chiffres, graphiques côte à côte, max-w-7xl).
- P2 Abonnement : téléphone, sélecteur de formule en haut pour éviter un défilement très long ; « Payer » selon R3.
- P3 Publicité de l'établissement : secteurs bloqués en grille de cases sur ordinateur.

### Postes
- P1 Choix du poste : grille de tuiles (R6).
- P1 Poste médecin : vérifier la version deux colonnes à 1180, 1440 et 1920 px ; mode compact utilisable dans une fenêtre de 400 × 600 ; tablette portrait : bouton principal selon R3.
- P1 Accueil : ordinateur, 3 colonnes (Services et praticiens / File d'attente / Rendez-vous du jour) sur toute la largeur ; tablette : la dernière ligne de la file ne passe pas sous « Nouveau ticket ».
- P1 Rendez-vous : panneau de détail vide = résumé du jour (nombre, prochains, absents) ; vue Semaine = vrai agenda en colonnes par jour sur ordinateur ; téléphone : R4.
- P3 Ticket imprimé : aperçu centré, inchangé.

### Pages client
- P2 Mon ticket : R5.
- P2 À proximité : R5 ; vérifier les icônes de secteur.
- P3 Choisir un service, Scanner, Code : ordinateur, carte centrée plus large (≈ 640 px) avec QR ou illustration à côté.

### Annonceur et console Wintek
- P1 Nouvelle campagne : listes Villes et Types interminables → sélecteur avec recherche et cases (ou pastilles), hauteur limitée avec défilement interne ; formulaire en 2 colonnes avec récapitulatif du prix collé à droite sur ordinateur.
- P3 Campagne, Valider un bon, Console Wintek : vérifier R1 et R3, 1920 px et tablette.

### Écran TV
- P2 : vérifier en 1280 × 720 et 3840 × 2160 que tout reste proportionnel et qu'aucun texte n'est coupé.

## 3. Données de test
Les captures et la démo affichent des données de test (« Ville Budget 1793… », « Clinique API », « Boulangerie Captures mobile light… »). Les tests e2e doivent nettoyer ce qu'ils créent ou utiliser une base séparée ; pnpm seed:demo ne laisse que des données réalistes (DOUALA CLINIC, Eneo, Saveurs du Littoral…).

## 4. Critères d'acceptation
1. Pour chaque écran : captures à 390, 820, 1180, 1440 et 1920 px, clair et sombre, dans docs/captures/responsive/<écran>-<taille>.png.
2. Aucune zone vide de plus de 40 % de la largeur sur ordinateur, sauf connexion et formulaires courts volontairement centrés.
3. Aucun texte coupé sans points de suspension, aucun débordement horizontal à 360 px (test Playwright : scrollWidth <= clientWidth sur toutes les pages).
4. Aucune ligne de contenu masquée par une barre fixe (test Playwright : le dernier élément de liste est entièrement visible après défilement).
5. Action principale visible sans défilement sur toutes les tailles.
6. Cibles tactiles ≥ 44 px sur téléphone et tablette, contrastes AA en clair et sombre (axe).
7. Budget < 200 Ko des pages client toujours respecté.
