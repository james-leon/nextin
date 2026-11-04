# Style visuel A

Statut : **terminé, en attente de validation**. Même structure d'écrans ; seule l'apparence change.
Captures avant : `docs/captures/responsive/before-style/` (clair et sombre) ; après : `docs/captures/responsive/` ; planches : `comparaison-style-a/`.

## Jetons et composants
- Fond `#F5F5F7` ; cartes blanches, rayon 24 px (`--radius-xl`), héros 28 px (`--radius-2xl`) ; ombre `0 8px 30px rgba(13,44,84,0.06)` (`shadow-card`) ; listes groupées (réglages) au rayon 16 px.
- `Card` et `StatCard` plus aérées ; évolution des indicateurs en badge (vert mieux, orange moins bien, gris stable).
- `TabBar floating` : pilule flottante de 64 px, marges 20 px, blanc translucide ; onglet actif en pilule bleue (icône + libellé), autres en icône seule (libellé pour les lecteurs d'écran). Barre latérale inchangée à partir de 1024 px.

## Écrans
| Écran | Changement |
|---|---|
| Mon ticket | Carte héros 28 px, badge « En direct », numéro 76 px, tuiles grises ; carte « Votre position » (ticket en cours, tickets devant, le vôtre surligné) — numéros publics seulement |
| À proximité | Catégories (Tous, Cliniques, Banques, Énergie, Télécoms) ; le plus proche en grande carte avec photo (Ouvert + distance sur la photo, tuiles en attente / attente / à distance) ; les suivants en lignes avec vignette ; 10 établissements par chargement |
| Photo d'établissement | Fiche de l'agence : choisie par le directeur ou le responsable, recadrée dans le navigateur (16:9 960 × 540 et carrée 320 × 320, WebP, 1 Mo au plus), bucket public `branch-photos` ; chargée après le premier affichage (comme les publicités), icône du secteur sinon |
| Poste | Carte « Client en cours » Navy (numéro 96 px sur tablette et ordinateur, nom et âge, durée), boutons translucides, « À suivre » avec rang |
| Tableau de bord | Badges d'évolution ; courbe « Attente moyenne par jour » avec la période précédente en pointillés (`daily_wait_series`), files en direct, tableau des postes |
| Connexion (et inscription, invitation) | Ordinateur : deux panneaux arrondis, formulaire à gauche, panneau bleu à droite avec un aperçu de l'application ; téléphone : formulaire seul |

## Budget des pages client (< 200 Ko)
`/t` 199 Ko, `/nearby` 199 Ko, `/b` 198 Ko, `/q` 193 Ko : la page du ticket ne reçoit plus que ses messages d'erreur, la liste « À proximité » est limitée à 10 établissements par chargement, et les photos arrivent après le premier affichage.

## Tests
pgTAP `style_branch_photos.test.sql` (droits d'écriture des photos, résumé public, série d'attente réservée aux responsables) ; suite Playwright complète (158) ; captures 5 tailles, clair et sombre.
