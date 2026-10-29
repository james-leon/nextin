# Revue responsive — P1

Statut : **P1 terminé, en attente de validation**. Référence : `docs/REVUE-RESPONSIVE.md`.
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

## Reste pour P2 et P3
Pages client sur ordinateur (R5), états peu remplis (R6 : Mes établissements), Écrans TV en grille, Réglages de l'agence en deux colonnes, Abonnement, tableau de bord à 1920 px, écran TV en 720p et 4K (P2) ; publicité de l'établissement, choisir un service / scanner / code, campagne, valider un bon et console Wintek (P3).
