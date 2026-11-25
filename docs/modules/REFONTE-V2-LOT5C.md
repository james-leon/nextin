# Refonte v2 — LOT 5c : quiz sans fin et Paires conformes aux maquettes v2 10 et 11

Suite du LOT 5b (`REFONTE-V2-LOT5B.md`). Sky Catch n'est pas modifié : seul son module de sons est réutilisé.
**Une migration** : `20261203090000_lot5c_quiz_explanations.sql` (additive : colonnes nullables, mêmes fonctions avec
une clé de plus dans leur réponse ; compatible avec le code en ligne). Pas de `db push` fait : à lancer par Leonel.

Captures : `docs/captures/v2-lot5c/` (360, 768 et 1280 px, clair et sombre ; `e2e/screenshots-v2-lot5c.spec.ts`) :
question illustrée avec une réponse choisie, explication après « Valider », résultat, appel pendant le quiz, plateau des
Paires, paire ratée, appel pendant les Paires.

## 1. Explication après la réponse (tiroir « Explication »)

- Colonnes `quiz_bank_questions.explanation` et `explanation_en` (≤ 400 caractères, nullables). **Aucun droit de
  colonne** pour `anon` ni `authenticated`, comme `correct` : l'explication donne la réponse.
- `quiz_bank_check` renvoie en plus `explanation` et `explanation_en` (null si la question n'en a pas) : seule sortie,
  donc toujours après la réponse. `quiz_bank_draw` ne les envoie jamais.
- Écran : sous les réponses, tiroir bleu nuit foncé (`bg-navy-deep`) avec l'onglet « EXPLICATION », texte en italique
  centré, ouvert après « Valider » ; aucun tiroir si la question n'a pas d'explication (`QuizCard explanation`).
- Import CSV : trois colonnes facultatives à la fin, `explication_fr;explication_en;illustration`
  (`QUIZ_CSV_EXTRA`). Un fichier sans elles reste accepté **et ne touche pas** aux explications déjà en base (les
  clés sont absentes des lignes importées). Contrôles : 400 caractères, pas d'anglais sans français, illustration de
  la liste. `supabase/seed/quiz-bank.example.csv` porte les 10 explications de la maquette (anglais traduit).

## 2. Illustrations dessinées

- Colonne `illustration` (liste fermée `mont`, `eau`, `fleuve`, `moustique`, `mains`, `trophee`, contrainte de la base
  ≡ `QUIZ_ILLUSTRATIONS`), lisible avec la question et envoyée par `quiz_bank_draw`.
- `apps/web/lib/games/quiz-art.ts` : les 6 dessins SVG **recopiés à l'identique** de la maquette (test qui les compare
  au HTML de la maquette ; ni script, ni image externe). Clé inconnue ou vide : pas d'image.
- Cadre blanc arrondi, penché de -1,5°, 62 % de la largeur (240 px au plus), `role="img"` et libellé du dictionnaire
  (`games.illustrations.*`). Valeurs propres au cadre en style en ligne (rien dans la feuille commune des pages client).
- Pas de barre de progression (la maquette n'en dessine pas ; l'objectif est montré par l'anneau final).

## 3. Sons (Web Audio, aucun fichier)

- Socle commun `components/client/games/game-audio.ts`, tiré de `sky-audio.ts` (qui l'utilise désormais, sans
  changement de ses sons) : contexte créé au premier geste, `navigator.audioSession.type = "playback"`, tampon muet.
- Partitions `lib/games/game-tunes.ts`, fréquences exactes des maquettes (testées) :
  - quiz : choix 660 Hz ; bonne réponse 784, 1047 puis 1568 Hz ; mauvaise 196 → 110 Hz ; fin de série 523-659-784-1047-1319
    (au moins 4 bonnes réponses) ou 523-494-440 ;
  - Paires : carte retournée 520 → 780 Hz ; paire trouvée 784 puis 1175 Hz ; ratée 220 → 160 Hz ; victoire
    523-659-784-1047-1319 puis 1568 Hz (volumes de la maquette, multipliés par 2,2 comme son `tone`).
- `useGameSounds` (`game-sounds.ts`) : bouton icône « Sons » (`aria-pressed`) dans la barre de chaque jeu, réglage
  `nextin.games.sound` sur l'appareil (lecture et écriture dans `try/catch`). Vibration de 60 ms sur une mauvaise réponse
  (inchangée).

## 4. Comportements

- Fin de série : anneau rempli à `min(bonnes réponses / 8, 1)` (`ringFraction`) ; titre « Excellent ! » dès 8,
  « Bien joué ! » dès 4, sinon « Continuez ! » (`resultTitleKey`) ; « Nouveau record sur ce téléphone ! » ou « Votre
  record : n bonnes réponses. ».
- Paires : carte ratée = bordure rouge et secousse de 0,35 s, 380 ms après la seconde carte (fin du retournement, comme
  la maquette), retournée après 1 s ; aucune secousse si les animations sont réduites. Animation et couleurs des étoiles
  dans une petite feuille propre au jeu (chargé à la demande).
- Appel pendant une partie : `QuizSeries` reçoit `frozen` comme les Paires (aucune réponse, « Valider » désactivé, partie
  gardée). L'écran vert « C'est votre tour » de la feuille de jeu ajoute sous « Présentez-vous : … » :
  quiz → « Votre quiz est gardé : vous pourrez le finir plus tard. » ; Paires → « Votre partie est gardée : reprenez-la
  plus tard si vous voulez. » ; Sky Catch garde « Votre partie est enregistrée. Score : n ». Bouton « J'arrive ».
- **Un seul écran vert à l'appel** : jeu ouvert, l'écran d'appel de « Mon ticket » ne s'affiche plus par-dessus la
  feuille (il cachait le texte de la partie gardée) ; « J'arrive » ferme la feuille et vaut lecture de l'appel. Son et
  vibration de l'appel inchangés (déclenchés par « Mon ticket »).

## 5. Bons et sponsors

Aucun bon dans le quiz sans fin ni dans les Paires pour l'instant (choix B). Aucun bandeau « Offert par » sur ces deux
jeux : aucun sponsor n'existe pour eux (rien d'inventé).

## Liste de contrôle (UX §7)

- [x] **5 états** : chargement (indicateur de la feuille et du quiz), vide (quiz sans fin non proposé sans question
  active : `game_session.quiz_bank`), erreur (« Jeu indisponible pour le moment. »), hors ligne (encadré de la
  feuille), contenu ; plus les états propres au jeu (question, réponse vérifiée avec explication, fin de série, appel).
- [x] **axe sans erreur, clair et sombre** : question illustrée avec explication, écrans d'appel (quiz et Paires) —
  `e2e/games-lot5c.spec.ts` ; plateau et victoire des Paires — `e2e/games.spec.ts`.
- [x] **Clavier** : réponses et cartes sont des boutons (Tab, Entrée, Espace), bouton « Sons » et « Recommencer »
  atteignables, focus visible. Vérifié par revue du code ; pas de test automatique dédié.
- [x] **Texte à 200 %** : tailles en `rem`, carte de question sans hauteur fixe, plateau des Paires dimensionné à la place
  disponible (`pairsGrid`). Vérifié par revue ; pas de capture à 200 %.
- [x] **360, 768 et 1280 px** : captures `docs/captures/v2-lot5c/` dans les trois largeurs, clair et sombre.
- [x] **Aucun texte en dur ni anglais en français** : nouveaux textes dans `games` (FR et EN, test de parité des clés).
- [x] **Budget 200 Ko** : jeux, dessins et sons chargés avec la feuille de jeu (jamais au premier chargement de `/t`).
  Mesures (téléphone) : `/t/…` 197 Ko (avec publicité 197 Ko), `/q/…` 198 Ko (iPhone 199 Ko), `/nearby` 197 Ko,
  `/b/…` 198 Ko, `/b/…/rdv` 199 Ko.
- [x] **Cibles de 44 px** dans la feuille de jeu (`expectSheetTargets`).

## Écarts avec les maquettes (justifiés)

- **Place de l'illustration** : la consigne la plaçait « au-dessus de la question » ; la maquette 10 la met entre la
  question et les réponses. J'ai suivi la maquette (on lit la question, puis on regarde le dessin). À inverser en une
  ligne dans `QuizCard` si tu préfères l'ordre de la consigne.
- **Ombre du cadre d'illustration** et de l'onglet « QUESTION » : gardées comme dans la maquette (éléments posés sur la
  carte, `shadow-floating`) ; la règle « aucune ombre » vise les cartes de l'interface.
- **Couleurs du bleu nuit en sombre** : la maquette éclaircit la carte de question en thème sombre (`#163A68`) ; on garde
  le jeton `navy` (contraste AA vérifié par axe en sombre).
- **Couleurs des dessins** : propres à l'illustration (identiques en clair et en sombre, dans un cadre blanc) ; les
  étoiles des Paires passent par des jetons déclarés sur le jeu (`--pairs-star`), plus par `--game-coin`, retiré de la
  feuille commune au LOT Sky Catch (les étoiles n'étaient plus colorées : corrigé ici).
- **Bouton d'appel** : « J'arrive » (maquettes 10 et 11) à la place de « Revenir à mon ticket » ; titre « C'est votre
  tour ! » du dictionnaire.
- **Bandeau « Offert par »** des maquettes : absent (aucun sponsor, choix B).
- **Sons de l'appel** des maquettes (784-988-1175 Hz) : non repris dans les jeux ; l'appel garde le son et la vibration
  existants de « Mon ticket ».

## Tests

- Vitest : `quiz-bank.test.ts` (CSV avec et sans colonnes facultatives, erreurs, illustrations, anneau, titres, mélodie),
  `quiz-art.test.ts` (dessins identiques à la maquette, clés), `game-tunes.test.ts` (fréquences exactes), étoiles des
  Paires inchangées (`pairs.test.ts`).
- pgTAP : `quiz_explanations.test.sql` (11 tests : colonnes illisibles avant la réponse, contraintes, tirage sans
  explication, vérification avec explication, null sans explication), `quiz_bank.test.sql` (réponse de
  `quiz_bank_check` mise à jour), `security.test.sql` (droits par colonne).
- Playwright : `games-lot5c.spec.ts` (explication après « Valider », illustration, bouton Sons, quiz et Paires figés à
  l'appel avec le bon texte, un seul écran vert, secousse et animations réduites, axe clair et sombre, cibles 44 px),
  `games.spec.ts`, `ads.spec.ts` (Sky Catch, bouton « J'arrive »), budgets `client.spec.ts` et `remote.spec.ts`.

## Migration à pousser

- `supabase/migrations/20261203090000_lot5c_quiz_explanations.sql` (après `20261202090000_lot5b_quiz_bank.sql`). Puis
  réimporter la banque avec les colonnes facultatives pour remplir explications et illustrations
  (`pnpm quiz:import <fichier.csv>`).
