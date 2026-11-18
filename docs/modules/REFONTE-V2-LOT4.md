# Refonte v2 — LOT 4 : espace directeur

Ce lot corrige deux points du LOT 3 et refait l'espace directeur d'après les maquettes v2 05, 06, 07, 16, 17, 18 et 19.
Interface seulement : aucune RPC ni règle de sécurité modifiée, **aucune migration**. Les actions de modification
gagnent un mode « enregistrement automatique » (champ caché `autosave=1` → `{ ok: true }` sans redirection), la
création garde son bouton et sa redirection.

## Écrans refaits

| Écran | Route | Maquette v2 |
|---|---|---|
| Remplissage automatique lisible (champs groupés, clair et sombre) | tous les formulaires groupés | correction LOT 3 |
| Mes établissements (un, plusieurs, aucun) | `/app` | 16 |
| Barre latérale : « Démarrage » et sa progression | `/app/o/…` | 05 |
| Démarrage (six étapes, « Tout est prêt ») | `/app/o/[orgId]/setup` | 19 |
| Agences et services : liste (chiffres, recherche, vignette, état) et fiche d'agence | `/app/o/[orgId]/branches[/id]` | 17 |
| Services (liste, fiche enregistrée automatiquement, nouveau service) | `…/services[/id|/new]` | 17 |
| Guichets et cabinets (liste avec état, fiche, nouveau poste) | `…/counters[/id|/new]` | 17 |
| Informations et photo de l'agence | `…/edit` | 17 |
| Horaires d'ouverture (une ligne par jour, enregistrement automatique) | `…/hours` | 17 |
| Personnel (maître-détail, membres et invitations, recherche) | `/app/o/[orgId]/staff` | 18 |
| Accès du membre (rôles expliqués, « ce que ce membre peut faire ») | `…/staff/[id]` | 18 |
| Inviter un membre, invitation envoyée (lien de secours, WhatsApp) | `…/staff/invite` | 18 |
| Praticiens par spécialité, fiche (semaine en colonnes, congés, fiche) | `/app/o/[orgId]/practitioners[/id]` | 18 |
| Spécialités | `…/practitioners/specialties` | 18 |
| Écrans (état en direct, appairage en deux étapes, code en six cases) | `…/displays` | 19 |
| Réglages d'un écran, annonces vocales (enregistrement automatique) | `…/displays/[id]`, `…/displays/announcements` | 19 |
| Abonnement : progression de l'essai, quatre formules dès 1 280 px | `/app/o/[orgId]/billing` | 06 |

## Composants et règles ajoutés

- `FilterList` (`components/admin/filter-list.tsx`) : recherche dans une liste groupée rendue par le serveur (lignes
  masquées, sans accents ni majuscules).
- `useAutoSave` réagit aussi à la saisie dans les champs non contrôlés et aux champs cachés tenus par des
  sous-composants (interrupteurs, listes à cocher) via un `MutationObserver` ; il garde la dernière réponse (`result`)
  pour afficher les erreurs sous le bon champ.
- `openingStatus` (`@nextin/shared`, testé) : « Ouverte jusqu'à 18:00 » / « Fermée » d'après les horaires et le fuseau.
- `initialsOf` (`lib/text/initials.ts`, testé), `StatGroup` dans `SplitPlaceholder`.
- Démarrage : six étapes mesurées dans l'ordre de la maquette ; l'étape « Imprimer le QR code » est faite dès que les
  supports sont téléchargés (champ existant `organizations.onboarding_step` mis à 4 par la route PDF, administrateurs
  seulement). « Démarrage » reste en tête de la barre latérale tant que la mise en place n'est pas terminée.
- Remplissage automatique : le navigateur peint la couleur de la cellule sur la zone de saisie seulement
  (`-webkit-autofill`), le libellé d'une cellule groupée est au premier plan (test `e2e/autofill.spec.ts`).

## Écarts volontaires

- **Barre latérale** : pas de « File en direct » ni de « Rendez-vous » (pastille 3) : ces pages n'existent pas dans le
  back-office (la file et les rendez-vous sont à l'accueil, `/desk`). Rubriques de l'app gardées : « Agences et
  services », « Praticiens », « Personnel ».
- **Démarrage** : « Tout est prêt » et « Terminer la mise en place » dès que les étapes indispensables sont faites
  (agence, services, postes, équipe) ; le QR code et l'écran TV restent facultatifs, comme avant.
- **Mes établissements** : le mot « Essai » vient du statut d'abonnement ; « Suspendu » / « En attente » de l'état
  de l'établissement. « J'ai reçu une invitation » ouvre une explication (le lien reçu par e-mail ajoute à l'équipe).
- **Fiche d'agence** : chiffres du jour (tickets, attente, postes ouverts) issus des statistiques anonymes du
  tableau de bord ; masqués pour un rôle sans accès aux statistiques. L'état d'ouverture ignore les fermetures
  exceptionnelles (la base reste la référence pour la prise de ticket).
- **Services** : durée en segments 5, 10, 15, 20, 30 min et « Autre » ; spécialité et limite par jour restent des
  champs (pas de sous-pages). Le réordonnancement par glisser n'existe pas : non affiché.
- **Horaires** : un interrupteur par jour (ouvrir ou fermer), heures en champs natifs (affichage 24 h selon la langue
  du navigateur).
- **Personnel** : désactiver et retirer restent confirmés ; « balayer pour annuler » une invitation est remplacé par
  le bouton « × » existant (annulation avec « Annuler » pendant 5 s).
- **Praticiens** : la semaine se lit sur la fiche ; l'ajout de plages et de congés reste sur « Horaires et congés »
  (pas de feuille « Nouvelle plage » ni de calcul du nombre de rendez-vous possibles).
- **Écrans** : pas d'aperçu en miniature de l'écran TV (il faudrait rendre l'écran dans le back-office) ; la
  révocation se fait depuis la fiche de l'écran.
- **Abonnement** : formules sélectionnées puis un seul bouton « Payer » (pas de bouton « Choisir » par carte) ;
  factures en liste groupée avec lien PDF.
- **Réglages de l'établissement (07)** : le moyeu de rubriques n'est pas recréé (déjà noté au LOT 3).

## Éléments de maquette absents de l'app (non inventés)

File en direct et rendez-vous dans la barre latérale du back-office ; aperçu en direct d'un écran ; ville des appareils
connectés ; réordonnancement des services par glisser ; feuille « Nouvelle plage » avec nombre de rendez-vous
possibles ; « Tickets maximum » et « Spécialité » en sous-pages.

## Migrations

Aucune.
