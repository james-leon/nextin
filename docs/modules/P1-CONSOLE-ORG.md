# P1 — Création d'un établissement depuis la console Wintek

Pour un client signé, le super admin crée l'espace complet depuis `/admin` → « Nouvel établissement »
(`/admin/organizations/new`), sans passer par l'inscription en libre-service.

## Ce qui est créé (une seule transaction, `admin_create_organization(p_fields)`)
- **Établissement** actif (`created_by` = super admin, `validated_at`), secteur, langue des messages, téléphone facultatif.
  Identifiant d'URL dérivé du nom (`slugify`), suffixe aléatoire s'il est pris.
- **Abonnement en essai** sur la formule choisie (toutes les formules actives, Enterprise comprise), durée de 1 à 365 jours
  (défaut : `platform_settings.trial_days`). Pendant l'essai, les droits sont ceux de la formule d'essai (règle existante
  d'`org_entitlements`). Événement `trial_started` (`created_by: platform_admin`, motif).
- **Adresse du responsable réservée** (`trial_email_claims`) : pas de second essai par l'inscription en libre-service.
- **Première agence** (`create_branch` : horaires par défaut, QR code émis) et **services du modèle du secteur**
  (`SERVICE_TEMPLATES`, `@nextin/shared` : nom FR/EN, préfixe, durée, couleur ; cochés d'office, décochables).
  Les limites de la formule s'appliquent (`plan_limit` : rien n'est créé).
- **Invitation du responsable** (`org_admin`, 7 jours) : jeton renvoyé une seule fois, seule son empreinte est stockée.
  Le super admin **n'est jamais membre** de l'établissement ; le responsable le devient en acceptant l'invitation
  (`/invite/<jeton>`, création de compte puis connexion) et arrive sur l'assistant de démarrage.
- **Motif obligatoire**, journalisé (`org.create_by_platform`, `member.invite`).

## E-mail d'invitation
`invitationEmail` (`@nextin/shared/notifications`, FR/EN, texte + HTML, une seule action « Accepter l'invitation »),
mise en page commune `renderEmail`. Envoyé aussitôt par le fournisseur e-mail (`EMAIL_PROVIDER=smtp`, sinon console).
Si l'envoi échoue, le lien est affiché **une seule fois** au super admin (bouton « Copier le lien ») pour le transmettre.
Réutilisé par P2 (invitations du personnel).

## Validation
Même schéma Zod (`adminCreateOrganizationSchema`) dans le navigateur (la saisie reste en place) et sur le serveur ;
la base revérifie tout (`reason_required`, `invalid_trial_days`, `invalid_email`, `invalid_services`…).

## Tests
- pgTAP `admin_create_organization.test.sql` (22) : droits, validation, création, super admin non membre, essai,
  services, QR, invitation, réservation de l'adresse, motif, acceptation par le responsable, identifiant pris, limite.
- Vitest `service-templates.test.ts` : modèles (préfixes uniques, bornes de la base), schéma, e-mail FR/EN échappé.
- Playwright `admin-create-organization.spec.ts` (mobile + ordinateur, axe, cibles tactiles) ; écran ajouté à
  `responsive.spec.ts`. Nettoyage e2e : établissements créés par un super admin de test sans membre.

Migration : `20261124090000_p1_admin_create_organization.sql` (nouvelle fonction seulement, compatible avec `main`).
