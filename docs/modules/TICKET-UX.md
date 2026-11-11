# « Mon ticket » (/t) — corrections UX

Version du 11 novembre 2026. Référentiel : `docs/NEXTIN_UX_STANDARDS.md`, budget des pages client < 200 Ko.

## Ce qui change
1. **Carte « Attente estimée »** : le texte ne déborde plus.
   - Les deux cartes (« Devant vous », « Attente estimée ») sont côte à côte dès 17rem de large, l'une sous l'autre en dessous (320 px).
   - Une valeur courte (« ≈ 15 min ») réduit sa taille à la largeur de la carte (`min(1.75rem, 18cqi)`).
   - Une phrase (« D'un instant à l'autre », « Ouverture à 08:00 ») passe sur plusieurs lignes, sans coupure de mot.
   - Texte : « D'un instant à l'autre » (EN « Any moment now »), à la place de « Imminent ».
2. **Barre de progression** : `queueProgress(ahead, top)` (`lib/client/ticket-progress.ts`). Elle va de 8 % (autant de monde devant qu'au plus fort de la file) à 92 % (personne devant), en proportion des places gagnées. Elle n'est jamais vide ni pleine avant l'appel. L'ancienne formule donnait 50 % au premier de la file.
3. **« Annuler le ticket »** :
   - plus de barre fixée en bas de l'écran, plus de rouge ;
   - un lien discret (gris, souligné) à la fin du contenu, après « Je suis en route » pour un ticket à distance ;
   - une confirmation « Annuler votre ticket C-002 ? Vous perdrez votre place. » avec deux choix : Garder mon ticket / Annuler le ticket.
4. **Agence fermée ou aucun poste ouvert pour le service** (`ticketAvailability`) : l'attente affiche, selon le cas :
   - « Ouverture à 08:00 », « Ouverture demain à 08:00 », « Ouverture lundi à 08:00 » ou « Fermé pour l'instant » ;
   - « Aucun cabinet ouvert pour l'instant » (selon le type de poste du service : guichet, caisse, laboratoire, accueil).

   Le reste de la page est inchangé. L'état des postes suit le tableau diffusé en direct, sinon la vue du ticket.
5. **Personne devant** : « Vous êtes le prochain » (sous « Votre place ») à la place de « Devant vous : 0 », aussi dans la feuille de jeu.

## Base de données
La migration `20261119090000_ticket_opening.sql` ajoute des champs à `ticket_view`. C'est ce que lisent `get_ticket` et la diffusion `ticket:<jeton>`. Aucune donnée personnelle n'est ajoutée.

| Champ | Contenu |
|---|---|
| `branch.is_open` | ouverture calculée par `branch_is_open` (fermetures exceptionnelles comprises) |
| `branch.timezone` | fuseau de l'agence |
| `branch.hours` | horaires publics, comme `branch_public` |
| `service.open` | même règle que `branch_board` |
| `service.counter_kind` | type de poste le plus courant du service |

## Tests
- **Vitest** (`ticket-progress.test.ts`) :
  - premier de la file : barre ≥ 90 % ;
  - progression croissante ;
  - ouverture le jour même ou le lundi suivant ;
  - aucun poste ouvert.
- **pgTAP** (`ticket_opening.test.sql`) : nouveaux champs, poste fermé, fermeture exceptionnelle, aucune donnée personnelle.
- **Playwright** (`e2e/ticket-ux.spec.ts`) :
  - 320 et 375 px, FR et EN ;
  - aucun débordement des cartes ni de la page ;
  - rien de fixe en bas de l'écran ;
  - « Vous êtes le prochain » et barre ≥ 90 % ;
  - aucun cabinet ouvert, agence fermée ;
  - annulation : lien discret, confirmation avec le numéro, « Garder mon ticket ».
- **Budget** : vérifié par `e2e/client.spec.ts`.
