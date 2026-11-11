# B5 — Double authentification (TOTP, Supabase MFA)

## Règles
- **Obligatoire** pour le super admin et les administrateurs d'établissement quand `platform_settings.mfa_required` est activé (console Wintek → Réglages).
- **Facultative** pour les autres rôles. Elle devient obligatoire pour tout le personnel d'un établissement avec `organizations.mfa_required_all` (écran Personnel, administrateurs seulement). Un compte qui a enregistré un facteur doit toujours l'utiliser.
- Les deux réglages sont **désactivés par défaut** : la migration ne change rien pour le code en ligne. Ordre d'activation en production :
  1. TOTP activé dans Supabase ;
  2. déploiement ;
  3. le super admin configure son propre code ;
  4. il active l'obligation. La base refuse l'activation depuis une session sans code (aal1) : impossible de se bloquer.

## Contrôles côté base (`20261121090000_mfa.sql`)
- `assert_mfa(org, recent)` : session **aal2** exigée quand la double authentification est requise. Avec `recent`, le code doit dater de moins de 5 minutes (revendication `amr` du jeton). Seules les sessions des utilisateurs sont contrôlées (le serveur et les tâches ne le sont pas).
- **aal2** :
  - toute la console (`assert_platform_admin`) ;
  - abonnement, paiements et extensions (`assert_org_admin`) ;
  - invitations et désactivation d'un membre (déclencheurs sur `invitations` et `memberships`).
- **Code récent** : changement de rôle, suppression d'un membre, export des statistiques (`stats_export`).
- `admin_reset_mfa(email, motif)` : super admin seulement, facteurs supprimés, journalisé (`security.mfa_reset`). `my_mfa_status()` : exigée, enregistrée, niveau de la session.
- Test : `supabase/tests/database/mfa.test.sql`.

## Application
- `requireStaffSession` :
  - facteur enregistré et session aal1 → `/mfa` (saisie du code) ;
  - double authentification exigée sans facteur → `/app/settings/security?setup=1` (QR code dessiné par l'application, clé en secours).
- Nouvelle saisie avant une action sensible : `useMfaStepUp`. L'action est tentée, une feuille demande le code si la base répond `mfa_recent_required`, puis l'action est rejouée. Branché sur `ConfirmAction` (toutes les suppressions confirmées), le formulaire du rôle d'un membre et le réglage de l'établissement. L'export CSV redirige vers `/mfa`, puis reprend.
- Console Wintek : déconnexion après 30 minutes sans requête. Le proxy contrôle le cookie `nextin_admin_seen` ; `AdminIdleGuard` recharge la page après 30 minutes sans interaction.
- Test : `apps/web/e2e/mfa.spec.ts` (configuration imposée, code à la connexion, réinitialisation par le super admin, expiration de la console).
