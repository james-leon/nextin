# NextIn — Poste local hors ligne (architecture « offline-first »)

Document d'architecture (P6 de la liste avant mise en ligne). **Aucun développement** : il fixe la cible, les choix et
les questions ouvertes avant un éventuel module après le pilote.

## 1. Objectif
Une coupure d'internet dans l'agence (fréquente : fibre, délestage, forfait épuisé) ne doit jamais arrêter la file.
- L'accueil continue d'émettre des tickets.
- Les postes appellent, admettent et terminent.
- L'écran TV annonce.
- Au retour du réseau, tout est rattrapé dans le cloud **sans doublon ni perte**, et les statistiques restent justes.

Hors périmètre :
- les rendez-vous en ligne et les paiements pendant la coupure ;
- les messages WhatsApp, envoyés au retour du réseau seulement s'ils ont encore un sens.

## 2. Ce qui existe déjà
| Élément | Comportement hors ligne aujourd'hui |
|---|---|
| Poste de l'agent (M5) | Copie de la file et commandes en attente en IndexedDB (`lib/desk/store.ts`, `commands.ts`). Application locale (`applyOp`), puis rejeu ordonné au retour. Commandes idempotentes (`p_client_op_id`). En cas de conflit : le suivant disponible est appelé et un bandeau l'indique. |
| Service worker (`public/sw.js`) | Coquille de l'application et page hors ligne (`offline.html`). Cache des fichiers statiques et des visuels publicitaires (borné). |
| Écran TV (M6) | Garde le dernier tableau affiché. Plus d'annonce tant que le canal temps réel est coupé. |
| Accueil | **Aucune émission de ticket hors ligne** (création par RPC uniquement). |
| Téléphones des patients | Utilisent leurs propres données mobiles : ils restent en ligne, sur le cloud. |

Limite principale : chaque appareil est hors ligne **seul**. Les postes ne se voient plus entre eux. L'accueil ne peut
plus créer de ticket. La TV ne reçoit plus les appels. C'est ce que le poste local corrige.

## 3. Scénarios de panne
| Scénario | Effet attendu avec le poste local |
|---|---|
| Internet de l'agence coupé, réseau local (Wi-Fi) en état | La file bascule sur le poste local : accueil, postes, TV et impression fonctionnent. |
| Coupure électrique courte (onduleur sur le poste local et le routeur) | Idem, sans perte. |
| Poste local en panne, internet en état | Rien ne change : le cloud reste la référence. Le poste local n'est jamais indispensable. |
| Internet et poste local en panne | Mode actuel : chaque poste hors ligne seul, tickets papier de secours (§8). |
| Cloud indisponible (incident Supabase / Vercel) | Même bascule que la coupure d'internet. |

## 4. Architecture cible
**Matériel**
- Mini-PC (ou PC de l'accueil déjà présent) sur le réseau local de l'agence.
- Onduleur partagé avec le routeur.
- Une imprimante 80 mm sur le réseau local, ou en USB sur l'accueil.

**Logiciel : « NextIn Local »**
- Une application Node unique, installée en service (Windows ou Linux).
- Contenu :
  - une base locale (SQLite, fichier chiffré) ;
  - le **même contrat que les RPC du cloud** pour les opérations de file (`reception_create_ticket`, `call_next`, `admit_ticket`, `finish_ticket`, `mark_no_show`, `recall_ticket`, `transfer_ticket`), mêmes codes d'erreur ;
  - un canal temps réel WebSocket qui diffuse les mêmes événements que `staffTopic` / `boardTopic`.
- Une seule base de code pour la logique : les fonctions pures de `@nextin/shared` (estimation, `pickNextTicket` / équité, `primaryAction`, annonces). Elles sont déjà testées pour leur parité avec la base.

**Découverte**
- Adresse fixe sur le réseau local (`nextin.local` en mDNS, ou IP réservée dans le routeur).
- Saisie une fois dans « Agences → Poste local » au moment de l'appairage.

**Appairage**
- Même principe que l'écran TV : code à 6 chiffres → jeton d'appareil.
- Seule l'empreinte du jeton est stockée dans le cloud.
- Le poste local est rattaché à **une** agence.

**Navigateur des postes**
- Les écrans du personnel interrogent le cloud en priorité.
- Après 10 s sans réponse (ou en cas d'échec du canal temps réel), ils basculent sur le poste local.
- Le changement est signalé par le bandeau « Mode local ».

## 5. Modes et bascule
| Mode | Référence de la file | Déclenchement |
|---|---|---|
| **Cloud** (normal) | Base Supabase | Par défaut |
| **Local** | Poste local | Cloud injoignable depuis le poste local pendant 30 s, **ou** décision de l'accueil (« Passer en mode local ») |
| **Reprise** | Cloud, après rattrapage | Cloud joignable pendant 60 s **et** journal local entièrement accepté |

**Une seule autorité par agence à un instant donné**, pour éviter deux files parallèles :
- En mode cloud, le poste local garde une **copie à jour** de la file du jour (abonnement à `staffTopic` + relecture toutes les 30 s), prête pour la bascule.
- En mode local, le cloud est prévenu dès que possible (« bail » daté du poste local).
- Pendant le bail, les prises de ticket **en ligne** de l'agence sont suspendues côté cloud : encadré « Prise de ticket en ligne momentanément indisponible », déjà prévu par `online_open`, jamais de raison affichée.
- Si le cloud n'a pas pu être prévenu (coupure totale), les tickets pris en ligne pendant ce temps sont ajoutés **après** les tickets locaux lors de la reprise (règle d'équité de §6), et les patients concernés voient leur position mise à jour.

## 6. Données et synchronisation
**Journal d'opérations**
- Chaque action en mode local est une entrée append-only : type, paramètres, `client_op_id` (uuid v4), heure locale, heure du poste local, auteur.
- Au retour, le journal est rejoué **dans l'ordre** vers le cloud. C'est le mécanisme du poste de l'agent (M5), étendu à l'accueil.
- Idempotent : un rejeu interrompu reprend sans doublon.

**Numérotation sans collision**
- En mode local, les numéros sont pris dans une **plage réservée** de l'agence pour la journée (ex. `C-501` à `C-999`).
- Cette plage est attribuée par le cloud à l'ouverture et gardée par le poste local.
- Aucun numéro ne peut exister deux fois, même si un ticket est créé en ligne pendant la coupure.

**Horloge**
- Le poste local se synchronise sur l'heure du cloud à chaque connexion.
- Les durées (attente, service) sont calculées avec l'horloge du poste local, qui est unique pour l'agence.

**Équité au rattrapage**
- `public.fair_pick` reste la référence.
- Les tickets locaux gardent leur heure d'émission.
- Les éventuels tickets en ligne de la période sont intercalés par heure d'émission.

**Conflits possibles et règle appliquée**
- Ticket annulé par le patient (cloud) puis appelé en local : l'appel est rejoué, puis l'annulation est enregistrée comme « absent ». Le cas est journalisé et visible dans l'audit.
- Même ticket terminé deux fois : le second est ignoré (idempotence).
- Ticket transféré vers un service fermé entre-temps : rejeu refusé ; le ticket est remis en attente dans son service d'origine, avec une alerte à l'accueil.

**Statistiques**
- Calculées par la base **après** rattrapage (cumuls nocturnes inchangés).
- Les opérations locales portent leurs heures réelles : les indicateurs du jour restent exacts.

## 7. Sécurité et confidentialité
**Données minimales sur le poste local**
- File du jour de **son** agence seulement : numéros, services, postes, heures.
- Nom du client seulement si l'agence le demande, et seulement pour l'affichage aux postes, comme dans le cloud.

**Protection des données**
- Base locale chiffrée (clé dérivée du jeton d'appareil, gardée dans le coffre du système : DPAPI sous Windows, keyring sous Linux).
- Purge automatique à la clôture de la journée, après rattrapage confirmé.

**Accès**
- Le poste local n'expose **que** l'API de file au réseau local, en HTTPS (certificat local généré à l'appairage).
- Accès réservé aux appareils déjà connectés au compte du personnel : jeton de session vérifié par le cloud avant la coupure, gardé 12 h au plus.

**Traçabilité**
- Chaque opération locale est journalisée avec son auteur.
- Le journal d'audit du cloud reçoit les entrées lors de la reprise (`origin: local`).

**Révocation**
- Depuis le back-office (« Agences → Poste local → Révoquer »).
- Le jeton est refusé à la prochaine connexion et la base locale est effacée.

## 8. Écrans et parcours en mode local
**Accueil**
- Création de tickets avec impression 80 mm : QR de suivi, valable une fois le réseau revenu.
- Bandeau « Mode local : les patients ne peuvent pas prendre de ticket en ligne ».

**Postes**
- Fonctionnement inchangé : même bouton principal, mêmes raccourcis.
- Bandeau « Mode local ».

**Écran TV**
- Connecté au poste local (même jeton d'écran, canal local).
- Les annonces vocales utilisent les MP3 déjà en cache dans le service worker.
- Synthèse vocale du navigateur en secours.

**Patients avec téléphone**
- Leur page reste sur le cloud. Pendant le mode local, leur position n'avance pas en direct.
- La page affiche « Mise à jour suspendue : suivez l'écran de la salle d'attente », jamais une position fausse.

**Secours ultime** (internet et poste local en panne)
- Carnet de tickets papier numérotés dans une plage dédiée (ex. `P-01`…).
- Saisie a posteriori par l'accueil (« Ajouter des tickets papier »), qui garde les heures.

## 9. Exploitation
**Installation**
- Paquet signé (Windows MSI / Linux deb), configuration par l'appairage.
- Aucune clé dans un fichier.

**Mises à jour**
- Automatiques, hors des heures d'ouverture.
- Version minimale imposée par le cloud : un poste local trop ancien reste en mode cloud et le signale.

**Supervision**
- Le poste local envoie un signe de vie toutes les 5 min.
- Le back-office affiche « Poste local : en ligne / hors ligne depuis … » ; la console Wintek liste les postes muets.

**Sauvegarde**
- Rien à sauvegarder : le cloud reste la référence.
- Le journal local est gardé 7 jours après rattrapage (diagnostic), chiffré.

## 10. Tests à prévoir
- **Unitaires** : mêmes fixtures que `estimate.ts` et `fairness.fixtures.json`. Rejeu du journal (ordre, idempotence, conflits du §6).
- **Intégration** : base locale + base Supabase locale. Couper le réseau du conteneur, dérouler une demi-journée, rétablir, comparer les tickets et les statistiques.
- **Playwright** : bascule automatique d'un poste et de la TV, bandeaux, retour au mode cloud.
- **Recette sur place** : ajout d'un test « coupure d'internet de 15 minutes » à la grille `NEXTIN_RECETTE_PILOTE.md`.

## 11. Phasage proposé (après le pilote)
1. **Accueil hors ligne seul** : création de tickets en IndexedDB, plage réservée, rejeu. Effort faible, gain immédiat.
2. **Poste local** : copie de la file, API de file, canal local, bascule des postes et de la TV.
3. **Bail et suspension des prises en ligne**, supervision, révocation.
4. **Paquets signés**, mises à jour automatiques, tickets papier de secours.

## 12. Questions ouvertes (décision de Leonel)
- **Matériel** : PC de l'accueil existant, ou boîtier dédié fourni par Wintek (coût, location, garantie) ?
- **Inclusion** : le poste local fait-il partie d'une formule (Premium, Enterprise), ou est-il proposé en option ?
- **Bail** : seuil de bascule automatique (30 s proposé), ou bascule manuelle seulement par l'accueil ?
- **Nom des clients** : conservé sur le poste local (cliniques), ou jamais hors du cloud (plus simple, moins pratique) ?
