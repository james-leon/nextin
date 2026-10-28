# M5b — Rendez-vous

Statut : **terminé, en attente de validation**. Plan : `docs/PLAN.md` §12.3.

## Ce qui est fait

### Back-office
- **Praticiens → Horaires et congés** (`/app/o/<org>/practitioners/<praticien>/schedule`) :
  - plages hebdomadaires (jour, de, à, durée d'un rendez-vous, service des rendez-vous) ; deux plages d'un même jour ne se chevauchent jamais ;
  - congés, dates incluses.
  - Sur grand écran, la semaine est à gauche et les congés à droite.
- **Agence → Réglages de la file → Rendez-vous**, la règle d'équité de l'agence :
  - **Alterner** (par défaut) : après chaque rendez-vous, au moins N patients sans rendez-vous passent s'ils attendent (N = 2 par défaut) ;
  - **À l'heure** : un rendez-vous passe dès son heure, avant les patients sans rendez-vous ;
  - priorité à partir de X minutes avant l'heure (15 par défaut) ;
  - **tolérance de retard** (10 min) : au-delà, le patient arrivé reçoit un ticket ordinaire ;
  - **absent** sans arrivée X minutes après l'heure (60 min), par une tâche toutes les 5 minutes.

### Accueil : « Rendez-vous » (`/desk/reception/<agence>/appointments`)
L'accès se fait depuis le poste d'accueil (« Rendez-vous · N à venir aujourd'hui »).
- **Jour** et **Semaine**, navigation par jour ou par semaine, « Aujourd'hui », filtre par praticien.
- **Statuts** :
  - Confirmé, Arrivé, Terminé, Reprogrammé, Annulé, Absent ;
  - **En attente** : patient arrivé dont le praticien est absent ou en retard ;
  - **À reprogrammer** : congé, fermeture ou absence tombant sur un rendez-vous encore à venir.
- **Nouveau rendez-vous** : praticien, jour (21 jours proposés), créneau libre, repère du patient (initiales, jamais annoncé), numéro WhatsApp avec l'accord du patient et langue des messages.
- **Détail** :
  - « Marquer arrivé », action principale le jour même : le ticket est créé au cabinet du praticien, ou chez un collègue de même spécialité s'il est absent ; prioritaire « RDV » et classé à l'heure du rendez-vous s'il est à l'heure, ordinaire au-delà de la tolérance ;
  - impression du ticket ;
  - « Reprogrammer » : nouveau créneau, le numéro est conservé ;
  - « Marquer absent » ;
  - « Annuler le rendez-vous », avec confirmation.
- **Responsive** :
  - **ordinateur** : liste du jour et détail (ou prise de rendez-vous) côte à côte, action principale dans la barre du haut ; semaine en 7 colonnes ;
  - **tablette** : semaine en 7 colonnes, détail en feuille ;
  - **téléphone** : liste, feuilles, action principale en bas.
- Mise à jour en direct (canal privé de l'agence), plus une vérification toutes les 30 s.

### Poste du praticien
- Ligne « **Rendez-vous du jour · N** », qui ouvre la liste du jour : heure, repère, statut, ticket. La refonte complète du poste sur ordinateur reste dans `docs/BACKLOG.md`.

### WhatsApp (mêmes règles que le M7)
- Les messages partent seulement si le numéro a été saisi avec l'accord du patient :
  - **confirmation** à la prise ;
  - **rappel la veille à 18 h** et **2 heures avant** (pas de rappel trop proche de la prise) ;
  - **rendez-vous déplacé** ;
  - **rendez-vous annulé**.
- Le message ne part que si le rendez-vous est toujours confirmé au moment de l'envoi. Les rappels en attente sont annulés à l'arrivée, à la reprogrammation, à l'annulation et à l'absence.
- À l'arrivée, le numéro suit le ticket : confirmation du ticket, puis alertes de la file.
- **5 nouveaux modèles Meta** sont listés dans `docs/modules/M7.md` : `rdv_confirme`, `rdv_rappel_veille`, `rdv_rappel_2h`, `rdv_reprogramme`, `rdv_annule`. Jamais le nom ni le repère du patient : seulement l'établissement, le jour, l'heure et le praticien.

### Base de données
Deux migrations : `20261104090000_m5b_appointment_types.sql` (types) et `20261104090100_m5b_appointments.sql`.
- Tables :
  - `practitioner_schedules` ;
  - `practitioner_leaves` ;
  - `appointments`, avec une contrainte **EXCLUDE** : deux rendez-vous actifs d'un praticien ne se chevauchent jamais, même en cas de prises simultanées ;
  - `tickets.appointment_id` ;
  - contacts et messages rattachés à un rendez-vous ;
  - compteur d'équité par poste.
- **Créneaux libres** calculés à la volée (`practitioner_free_slots`) : horaires − congés − fermetures − rendez-vous actifs − absence ou retard en cours − passé, en heure locale de l'agence.
- RPC du personnel : `available_slots`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `mark_appointment_no_show`, `check_in_appointment`, `list_appointments`. Chaque action est inscrite au journal d'audit.
- **Règle d'équité** :
  - fonction pure `pickNextTicket` (`@nextin/shared/appointments`) et miroir SQL `fair_pick`, utilisé par `pick_next_ticket` (donc par `call_next` et `call_ticket`) ;
  - **parité** vérifiée par 12 cas de référence partagés (`fairness.fixtures.json`) : Vitest les rejoue, et vérifie que pgTAP rejoue exactement les mêmes.
- Le rendez-vous suit son ticket : servi ou transféré → terminé, absent à l'appel → absent, annulé → annulé.
- **RLS** : rendez-vous lisibles par le personnel de l'agence seulement (jamais par une session client), écritures uniquement par RPC. Horaires et congés modifiables par les gestionnaires de l'agence. **Purge** : repère et numéro effacés après la durée de conservation.
- **Correctif de concurrence** : avec six postes qui appellent en même temps, la nouvelle sélection écarte les tickets déjà pris par un autre poste et continue tant qu'il reste un candidat. Jamais deux fois le même ticket, jamais de faux « file vide » (test d'intégration rejoué 5 fois).

## Tests
| Suite | Résultat |
|---|---|
| Vitest `@nextin/shared` (équité : 12 cas + parité avec pgTAP, calendrier, modèles et SMS des rendez-vous) | 140 ✓ |
| Vitest `@nextin/web` (messages de rendez-vous : modèle, date et heure de Douala, rappel ignoré si arrivé, annulation) | 62 ✓ |
| pgTAP M1 → M7 + M5b (54 tests M5b : parité, créneaux, chevauchement, congé, fermeture, prise, consentement, rappels à 18 h, exclusion en base, reprogrammation, annulation, arrivée à l'heure ou en retard, ordre « alterner » et « à l'heure », suivi du ticket, absents, « en attente », isolation, RLS, purge) | 380 ✓ |
| Intégration (concurrence, temps réel) | 6 ✓ (5 passages consécutifs) |
| Playwright mobile + desktop | 96 ✓ (18 ignorés : parcours propres à un appareil) |

Parcours Playwright (`e2e/appointments.spec.ts`) :
- **ordinateur** :
  1. plage ajoutée, chevauchement refusé, congé, suppression ;
  2. prise de rendez-vous dans le panneau, consentement exigé, confirmation WhatsApp envoyée ;
  3. arrivée : ticket C-001 prioritaire « RDV » au cabinet du praticien ;
  4. reprogrammation, annulation ;
  5. vue semaine ;
  6. poste du praticien ;
- **téléphone** : liste, cibles tactiles ≥ 44 px, prise en feuille, détail, réglage d'équité enregistré ;
- contrôle d'accessibilité (axe) sur chaque écran.

## Captures (`docs/captures/m5b/`)
Formats : téléphone 390 px, tablette portrait 820 px, tablette paysage 1180 px, ordinateur 1440 px. Le mode sombre est capturé en téléphone et en ordinateur pour le jour et la semaine.
- `01-day-*` : jour ;
- `02-week-*` : semaine ;
- `03-booking-*` : prise de rendez-vous ;
- `04-detail-*` : détail en feuille ;
- `05-schedule-*` : horaires et congés ;
- `06-fairness-*` : règle d'équité ;
- `07-desk-today-mobile` : rendez-vous du jour au poste.

## Données de démo
DOUALA CLINIC, agence Akwa :
- horaires du lundi au vendredi, créneaux de 20 min :
  - Dr Mbarga : 8 h – 12 h et 14 h – 17 h ;
  - Dr Nkeng : 8 h – 12 h ;
  - Dr Ngo Biyong (pédiatrie) : 8 h 30 – 12 h 30 et 14 h – 16 h ;
- une quarantaine de rendez-vous sur les jours ouvrés à venir (repères fictifs), dont certains avec un numéro de démonstration ;
- `pnpm seed:demo` ne recrée rien si des rendez-vous sont déjà à venir.

## À faire de votre côté
- `pnpm db:push` : deux migrations M5b.
- Chez Meta, faire approuver aussi les **5 modèles de rendez-vous** (`docs/modules/M7.md`, section 3).
- Comparatif SMS : `docs/sms-providers.md`.
