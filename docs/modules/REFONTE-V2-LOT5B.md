# Refonte v2 — LOT 5b : écran TV et jeux

Ce lot refait l'écran de la salle d'attente d'après les maquettes v2 09 (écran TV) et 23 (compléments), et les jeux
d'après 10 (quiz), 11 (paires) et 12 (Sky Catch), avec 01 pour la feuille « Jouer en attendant ». Les textes du
dictionnaire priment ; les données des maquettes sont des exemples. Aucune règle de sécurité ni de diffusion
publicitaire n'est modifiée. **Une migration** (`20261202090000_lot5b_quiz_bank.sql`, additive).

Captures : `docs/captures/v2-lot5b/` — TV en 1280 × 720, 1920 × 1080 et 3840 × 2160 (toujours claire) ; jeux en 360,
768 et 1280 px, clair et sombre (`e2e/screenshots-v2-lot5b.spec.ts`).

## Écrans refaits

| Écran | Route / composant | Maquette v2 |
|---|---|---|
| Écran TV : bandeau bleu nuit, appels en cours (dernier marqué d'un trait et de « Appel »), colonne publicité ou QR code, « À suivre », personnes en attente, code de présence | `/tv` (`TvBoard`) | 09 |
| Flash d'appel vert plein écran, 4 s, barre du temps restant, en même temps que le carillon et l'annonce | `TvFlash` | 09 |
| Appairage : code en deux groupes de trois cases, barre jusqu'au prochain code, adresse de l'écran | `TvPairing` | 23 |
| Activer le son (voile, puis « Son activé » 3 s), aucun appel (message calme, QR code, appels précédents), sans publicité (QR code et code court), hors ligne (dernier état atténué, pastille orange), service indisponible (sans raison), écran révoqué (appairage et message rouge) | `/tv` | 23 |
| « Jouer en attendant » sur « Mon ticket » (ligne à carré orange) | `PlayCard` | 01 |
| Feuille de jeux : retour « Mon ticket », mini-ticket « En direct », cartes de jeu avec le record de l'appareil, « C'est votre tour » vert | `GameSheet` | 01 |
| Quiz sponsorisé (logique inchangée) et quiz « série sans fin » : carte bleu nuit, onglet « Question n » vert ou rouge, réponses en pilules, 3 vies, résultat en anneau | `QuizGame`, `QuizSeries` | 10 |
| Paires : niveaux 6, 8, 10, paires / coups / temps, plateau à la hauteur de l'écran, étoiles, record par niveau | `PairsGame` | 11 |
| Sky Catch : cadre du jeu, pastilles score / niveau / temps, pause, écrans d'accueil, de pause, de niveau et de fin | `SkyCatch` | 12 |

## Écran TV

- Toujours clair (`bg-grouped`, cellules blanches), lisible à 3 m : toutes les tailles sont des multiples de `--u`
  (`TV_UNIT_STYLE` = `min(1vw, 1.7778vh)`) ; vérifié en 720p, 1080p et 4K (`e2e/responsive.spec.ts`, captures).
- Contenu calculé par `tvView` (`lib/tv/calls.ts`, testé) : appels en cours (`isActiveCall`, quatre au plus), dernier
  appel marqué s'il attend encore le patient, appels terminés depuis moins de 30 minutes pour l'écran sans appel,
  « À suivre » pris à tour de rôle dans chaque file (six au plus), personnes en attente des services de l'écran.
- Code de présence : celui du QR code (`presence_url`, paramètre `p`), affiché seulement s'il existe.
- Flash : un appel à la fois (file), à chaque nouvel appel ou rappel annoncé, jamais pour l'état initial.
- Publicité : mêmes règles de diffusion (`TvAdSlot` : 20 s de QR code, puis un visuel tiré au sort), avec ou sans appel
  en cours ; le QR code de l'agence prend la place des files d'attente.
- Aucun nom : seulement des numéros, des postes et des services.

- Tailles de l'écran dans une feuille propre à `/tv` (`app/tv/tv.css`, classes `u-<propriété>-<multiple>`) et non dans
  la feuille commune : chargées seulement par l'écran TV (sinon ≈ 0,9 Ko compressé de plus sur chaque page client).

## Quiz « série sans fin »

- Proposé quand la banque Wintek contient au moins une question active et que l'établissement n'a pas désactivé le quiz
  (clé `quiz_bank` de `game_session`) ; en plus du quiz sponsorisé quand il existe (deux cartes).
- Questions tirées au hasard par la base (`quiz_bank_draw`, cinq à la fois, réserve chargée d'avance), sans celles déjà
  vues sur l'appareil (`nextin.quiz.seen`, 1 000 au plus ; tout vu : un nouveau tour commence). Jamais la bonne réponse.
- Chaque réponse est vérifiée par la base (`quiz_bank_check`) qui renvoie la bonne réponse après coup.
- 3 vies, score = bonnes réponses, record sur l'appareil (`nextin.quiz.best`), lecture et écriture dans `try/catch`.
- Interstitielle existante proposée toutes les 5 questions (`QUIZ_INTERSTITIAL_EVERY`), l'espacement minimal de la
  plateforme (`interstitial_min_gap_seconds`) s'appliquant toujours.
- Limites par ticket (donc par appareil) : 120 tirages et 300 réponses par heure.

### Banque de questions

- Table `quiz_bank_questions` : identifiant du fichier (clé), catégorie, difficulté 1 à 3, question FR/EN, 2 à 4
  réponses FR/EN, index de la bonne réponse, active. RLS : lecture par `anon` et `authenticated` des seules questions
  actives, et **sans la colonne `correct`** (droits par colonne) ; écriture par le service role seulement.
- Import : `pnpm quiz:import <fichier.csv> [--dry-run]` (Node, compatible Windows, service role ; contre la base
  locale : `node scripts/local-env.mjs pnpm quiz:import <fichier.csv>`). CSV UTF-8, séparateur `;`, en-tête :
  `id;categorie;difficulte;question_fr;question_en;reponse1_fr;reponse1_en;reponse2_fr;reponse2_en;reponse3_fr;reponse3_en;reponse4_fr;reponse4_en;bonne_reponse`.
  Idempotent par identifiant (mise à jour et réactivation, jamais de doublon) ; rien n'est écrit si une ligne est
  invalide (erreurs listées avec leur ligne). Lecture : `parseQuizCsv` (`@nextin/shared/games/quiz-bank`, testé).
- Exemple de 10 questions : `supabase/seed/quiz-bank.example.csv` (non chargé par `db:reset`). La vraie banque sera
  fournie ensuite ; sa gestion dans la console Wintek viendra au LOT 6.

## Paires

- Logique pure `@nextin/shared/games/pairs` (testée) : plateau mélangé, deux cartes à la fois, cartes différentes
  retournées après 1 s, chrono à partir de la première carte, coups, étoiles, record par niveau
  (`nextin.pairs.best.<paires>`), grille choisie pour la plus grande carte possible sans défilement (`pairsGrid`).
- Rendu sans bibliothèque : boutons et retournement CSS 3D (380 ms), immobile si les animations sont réduites ;
  dessins vectoriels `lib/games/pair-art.ts` (fruits et produits du marché de la maquette). Figé à l'appel.

## Budget des pages client

Jeux chargés à la demande (feuille `GameSheet`, jeux et textes `/api/i18n/games` à l'ouverture) ; la ligne « Jouer en
attendant » n'appelle plus la base (`games_available`) puisque Paires est toujours proposé. Mesures (Playwright,
téléphone, build de production) : **`/t/…` 197 Ko** (198 Ko sur iPhone, 197 Ko avec publicité), `/q/…` 198 Ko
(199 Ko sur iPhone), `/` 181 Ko, `/nearby` 198 Ko, `/b/…/rdv` 199 Ko, `/pay/…` 198 Ko.

## Écarts volontaires avec les maquettes

- Étiquette « Appel » et pastille « Hors ligne » : texte noir sur orange (la maquette met du blanc, 2,3:1 seulement).
- Flash d'appel et bonne réponse du quiz : vert `bg-called` (#187A31, texte blanc AA) au lieu de #15A05A.
- Bouton principal des jeux en bleu nuit (la maquette du quiz le met en orange à texte blanc, contraire à la règle AA).
- Publicité de l'écran TV : titre et offre sous le visuel, sur fond blanc (lisibles quel que soit le visuel), et non
  par-dessus.
- Liste des appels de l'écran : seulement les appels en cours ; les appels terminés apparaissent dans « Appels
  précédents » quand aucun appel n'est en cours (règle `isActiveCall`).
- Écran révoqué : la consigne d'appairage n'est pas répétée sous le titre (comme la maquette).
- Quiz : ni illustration ni explication après la réponse (aucune colonne dans le format d'import), ni sons ni bouton
  « Sons » (non demandés) ; catégorie en blanc atténué au lieu d'orange clair.
- Paires et quiz : pas d'encart d'annonceur ni de bon (habillage à faire plus tard) ; pas de sons.
- Sky Catch : la logique n'a ni vies, ni gemmes, ni musique : pastille du temps restant au lieu des cœurs, légende
  « Pièce » et « Orage » ; voiles en bleu nuit uni (pas de dégradé).
- « Jouer en attendant » : sous-titre de la maquette (« On vous prévient dès que c'est votre tour ») au lieu de
  l'ancien texte du dictionnaire, qui ne citait que le quiz et Sky Catch.
- Record de Paires sur la carte du jeu : celui du plus petit niveau déjà réussi (« Record : 9 coups · Facile · 6 »).

## Tests

- Vitest : `lib/tv/calls.test.ts` (`tvView`, `presenceCodeOf`), `games/quiz-bank.test.ts` (série, questions vues,
  import CSV), `games/pairs.test.ts` (plateau, coups, chrono, étoiles, record, grille).
- pgTAP : `quiz_bank.test.sql` (RLS, colonne de la réponse illisible, écriture refusée au visiteur et au personnel,
  service role, tirage sans répétition, vérification, question retirée, réglage de l'établissement, limite) ;
  `security.test.sql` (deux fonctions publiques ajoutées à la liste fermée).
- Playwright : `tv.spec.ts` (appairage, appels, flash, annonce, aucun appel, révocation), `tv-ads.spec.ts`,
  `responsive.spec.ts` (TV 720p / 1080p / 4K), `games.spec.ts` (quiz sans fin : vérification, interstitielle, record ;
  Paires : plateau sans défilement, partie gagnée, niveau suivant, figé à l'appel ; axe et cibles de 44 px),
  `ads.spec.ts` (quiz sponsorisé, Sky Catch, budget de `/t`).

## Migration à pousser

- `supabase/migrations/20261202090000_lot5b_quiz_bank.sql` : table `quiz_bank_questions`, fonctions `quiz_bank_draw`
  et `quiz_bank_check`, `game_session` remplacée à l'identique avec la clé `quiz_bank` en plus (mêmes paramètres :
  compatible avec le code en ligne).
