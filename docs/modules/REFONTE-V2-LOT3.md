# Refonte v2 — LOT 3 : écrans du personnel

Ce lot applique les maquettes v2 04 à 08 aux écrans du personnel ; le reste du back-office suit par ses composants
communs (barre latérale, cartes, listes groupées). Une seule migration, additive : `20261130090000_lot3_staff_sessions.sql`
(appareils connectés). Rien n'est changé dans les RPC existantes, le temps réel, Turnstile, le hors-ligne ni les tarifs.

## Écrans refaits

| Écran | Route | Maquette v2 |
|---|---|---|
| Connexion (champs groupés, « Recevoir un code par e-mail » teinté) | `/login` | 04 · connexion |
| Code par e-mail (six cases, « Renvoyer le code dans 0:42 ») | `/login` | 04 · code par e-mail |
| Double authentification (bouclier, six cases, « Téléphone perdu ? ») | `/mfa`, feuilles de confirmation | 04 · double authentification |
| Inscription « Votre compte » | `/signup` | 04 · inscription 1 |
| Nouvel établissement en trois étapes (barre d'étapes, code en six cases, secteur en pastilles) | `/app/new` | 04 · inscription 3 |
| Invitation (initiales, « Rejoindre Douala Clinic », « Lien valable 7 jours ») | `/invite/[token]` | 04 · invitation |
| Nouveau mot de passe | `/reset-password` | style v2 |
| Barre latérale du back-office (carte de l'établissement, rubriques, personne connectée) | `/app/o/…` | 05 |
| Tableau de bord (indicateurs dans une seule carte à filets, titres semi-gras) | `/app/o/[orgId]` | 05 |
| Abonnement (une colonne : statut, utilisation en jauges, extensions en pastilles, formules, factures) | `/app/o/[orgId]/billing` | 06 |
| Réglages de la file (enregistrement automatique) | `/app/o/[orgId]/branches/[id]/settings` | 07 · établissement |
| Mon compte (profil, Sécurité, Notifications, langue, apparence, déconnexion) | `/app/settings` | 07 · mon compte |
| Sécurité (mot de passe, double authentification, appareils connectés) | `/app/settings/security` | 07 · sécurité |
| Notifications (demande d'aide d'un patient, sur cet appareil) | `/app/settings/notifications` | 07 · notifications |
| Poste (client en cours sur carte blanche, numéro bleu nuit) | `/desk/counter/[id]` | 08 · poste médecin |
| Accueil (numéros en bleu nuit arrondi) | `/desk/reception/[id]` | 08 · accueil |

## Composants ajoutés

- `CodeBoxes` (`components/ui/code-boxes.tsx`) : code à usage unique en six cases ; un vrai champ invisible posé dessus
  garde le clavier numérique, le collage et le remplissage automatique (`one-time-code`). `TotpCodeField` s'en sert.
- `StepProgress` (`components/ui/step-progress.tsx`) : traits d'étapes et sur-titre « Étape 2 sur 3 ».
- `StatGroup` (`components/ui/stat-card.tsx`) : rangée d'indicateurs dans une seule carte, cellules séparées par un filet.
- `AuthIcon` (`components/auth/auth-header.tsx`) : symbole d'en-tête en carré teinté (double authentification).
- `useAutoSave` + `AutoSaveStatus` (`components/admin/use-auto-save.tsx`) : enregistrement 600 ms après le dernier
  changement, sans envois qui se chevauchent ; état annoncé (`role="status"`) : « Enregistrement… », « Enregistré
  automatiquement » ou la vraie raison du refus (dictionnaire `errors`).
- `ConnectedDevices` (`components/settings/connected-devices.tsx`) et `describeUserAgent` (`lib/auth/user-agent.ts`,
  testé) : navigateur et système, jamais l'adresse IP.
- `initialsOf` (`lib/text/initials.ts`, testé) : initiales d'un établissement ou d'une personne.
- `lib/desk/notification-prefs.ts` : réglage de notification propre à l'appareil (lu par l'accueil).
- Jeton typographique : `text-headline` porte désormais son semi-gras (17 pt semibold de l'échelle iOS).

## Base de données

- `my_sessions()` : sessions ouvertes du compte connecté (navigateur, création, dernière activité, session en cours),
  sans adresse IP ; personnel seulement (anonymes exclus), rôle `anon` refusé.
- `revoke_my_session(p_session)` : ferme une autre session du compte (jamais celle en cours : `session_current`), les
  jetons de rafraîchissement partent avec elle ; journalisée (`auth.session_revoked`).
- Test : `supabase/tests/database/staff_sessions.test.sql` (isolation entre comptes, session en cours protégée,
  journal, aucune IP).

## Écarts volontaires

- **Le grand titre du tableau de bord reste la période** (« 30 derniers jours », « Aujourd'hui »…) au lieu de « Vue
  d'ensemble » : il dit ce que montrent les chiffres ; l'établissement reste en sur-titre. Pas de bouton « Inviter un
  membre » sur le tableau de bord (l'invitation est dans « Personnel » ; une seule action par écran : « Exporter »).
- **Inscription** : la maquette réunit compte et téléphone à l'étape 1. Le parcours réel garde le compte d'un côté
  (`/signup`, aussi utilisé par les invitations) et l'établissement en trois étapes de l'autre (`/app/new` : téléphone,
  code, établissement). Pas de champs « Première agence » ni « Ville » : l'agence se crée ensuite (configuration).
- **Durée d'essai** non écrite sur l'inscription (« Essai gratuit, sans carte ni engagement ») : elle est réglée par le
  super admin, jamais en dur ; la formule d'essai est annoncée à l'étape téléphone.
- **Téléphone de Wintek** absent de « Téléphone perdu ? » : aucun numéro en dur ; « Contactez le support Wintek ».
- **Notifications** : seule la demande d'aide d'un patient existe vraiment côté personnel ; elle est réglable par
  appareil (son et vibration à l'accueil). Les autres lignes de la maquette (rendez-vous, attente trop longue, résumé du
  soir, factures par e-mail) n'ont pas d'envoi derrière elles : elles ne sont pas affichées (`docs/BACKLOG.md`).
- **Appareils connectés** : pas de ville (aucune géolocalisation d'adresse IP, donnée personnelle évitée).
- **Réglages de l'établissement** : la page « Réglages de la file » garde ses sections actuelles ; le moyeu de réglages
  avec liste de rubriques à gauche (Informations, Agences, Rendez-vous…) n'est pas recréé, les rubriques existant déjà
  dans le back-office (barre latérale). Seul l'enregistrement automatique change le comportement.
- **Abonnement** : pas de barre « Jour 5 sur 14 » (la date de début d'essai n'est pas exposée) ; la ligne « jours d'essai
  restants » existante est gardée. Factures en liste groupée (lien PDF) plutôt qu'en tableau.
- **Poste** : la durée moyenne et les servis du jour restent sous « À suivre » (cartes séparées) plutôt que dans la carte
  du client en cours ; le bouton principal reste sous la carte (barre du bas sur téléphone).
