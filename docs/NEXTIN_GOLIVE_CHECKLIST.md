# NextIn — Revue du code et liste unique avant la mise en ligne

Revue du 7 novembre 2026, branche `claude/bold-ride-v2yswm`, commit `c528939`. Ce document regroupe **tout ce qui reste à faire**, dans l'ordre.
Légende : 🤖 = Claude Code ; 👤 = Leonel ; ⚖️ = juriste ou décision. État : ✅ fait (avec le commit sur `claude/bold-ride-v2yswm`), ⏳ en cours, ☐ à faire, ❓ question en attente (§7).

**Règles** : travail sur `claude/bold-ride-v2yswm` uniquement, jamais sur `main` (en ligne sur Vercel, fusion par Leonel) ; un commit par point, CI verte ; chaque migration compatible avec le code en ligne ; aucun écran terminé sans le §7 de `docs/NEXTIN_UX_STANDARDS.md`.

---

## 1. État vérifié

| Contrôle | Résultat |
|---|---|
| Modules M1 à M10b (file, postes, rendez-vous, TV, notifications, tableau de bord, distance, abonnements, publicité) | **Terminés** |
| Next.js | **16.4.5** (correctifs de sécurité de novembre appliqués) |
| `pnpm typecheck`, `pnpm lint` | **OK** |
| `pnpm audit --prod` | **Aucune faille connue** |
| Tests unitaires | ✅ 324 réussis ; `billing.test.ts` ne dépend plus de `APP_URL` (`fb9ba8a`) ; CI verte (`d6350b8`) |
| RLS | Active sur toutes les tables ; seule politique ouverte : `platform_settings` (informations publiques de Wintek, sans risque) |
| Fonctions `SECURITY DEFINER` | Toutes avec `search_path` ; droits du rôle anonyme limités à une liste fermée, testée |
| Buckets de stockage | Types limités, **pas de SVG** ; tailles plafonnées |
| Purge des données personnelles | Couvre `ticket_identities`, e-mails des demandes de rendez-vous, téléphones |
| Webhooks (paiement, WhatsApp, dispatch) | Signature ou secret vérifiés |
| Pages d'erreur | N'affichent pas le détail technique |
| Rejeu hors ligne des postes | Déjà en place (commandes idempotentes, IndexedDB) |

---

## 2. Bloquants pour la mise en ligne

Sans ces points, aucun client ne peut s'inscrire, payer ou se connecter en production.

| # | Problème constaté | Qui | État |
|---|---|---|---|
| B1 | **Aucun paiement réel** : `packages/payments` ne contient que le faux fournisseur (`fake`). Personne ne peut payer un abonnement ni une campagne | 🤖 adaptateur Notch Pay (recommandé dans `docs/payment-providers.md`) + 👤 compte marchand || ✅ 🤖 adaptateurs Notch Pay et CamPay (commit B1) — reste 👤 : compte marchand, clés dans Vercel, **validation en bac à sable** (`docs/payment-providers.md`) |
| B2 | **Le code d'inscription d'un établissement part uniquement par SMS** (`request_phone_code`, canal `sms`). Sans fournisseur SMS, l'inscription est impossible | 🤖 code par e-mail en attendant les SMS | ✅ `6b2060d` (code par e-mail, canal réglable dans la console, un essai par e-mail et par numéro) |
| B3 | **E-mails de connexion Supabase** (confirmation, mot de passe oublié, code de connexion) : le serveur d'e-mails par défaut de Supabase est limité à quelques envois par heure et n'est pas fait pour la production | 👤 SMTP Brevo ou Resend dans Supabase + 🤖 modèles FR/EN aux couleurs NextIn || ✅ 🤖 modèles : `docs/NEXTIN_AUTH_EMAILS.md` + `docs/auth-emails/` — reste 👤 SMTP et collage dans Supabase |
| B4 | **CI rouge** (tests de facturation sans `APP_URL`) | 🤖 | ✅ `fb9ba8a` (APP_URL du test de facturation) + `d6350b8` (CI verte) |
| B5 | **Pas de double authentification (2FA)** pour le super admin ni pour les admins d'établissement | 🤖 + 👤 activer TOTP dans Supabase || ✅ 🤖 `10d109d` (`docs/modules/B5-2FA.md`) — reste 👤 : TOTP dans Supabase, configurer son code, puis activer « Double authentification obligatoire » dans la console |
| B6 | **Projet Supabase gratuit** (si c'est le cas) : mise en pause après une période d'inactivité, pas de sauvegarde exploitable | 👤 formule Pro au premier client payant | ☐ 👤 |

### Correctifs et ajouts

| # | Point | Qui | État |
|---|---|---|---|
| — | Page « Mon ticket » : attente sans débordement, barre de progression, « Annuler » discret avec confirmation, agence fermée / aucun poste ouvert, « Vous êtes le prochain » | 🤖 | ✅ `beac9a4`, `d6350b8` |
| T1 | **Publicité sur les écrans TV** : `displays.show_ads` n'est réglable nulle part (`updateDisplay` envoie toujours `false`, l'appairage ne le passe pas). Interrupteur « Publicité sur cet écran » (appairage et modification, activé par défaut), seed de démo, test Playwright | 🤖 | ✅ `f590967` |

---

## 3. Sécurité restante (avant le premier client payant)

| # | Point | Qui | État |
|---|---|---|---|
| S1 | Dependabot, `pnpm audit --prod --audit-level high` et gitleaks dans la CI ; actions GitHub épinglées par SHA | 🤖 || ✅ `e53492d` : `.github/dependabot.yml`, `pnpm audit --prod --audit-level high` et job gitleaks (`.gitleaks.toml`) dans la CI, actions épinglées par empreinte |
| S2 | Test d'isolement entre établissements, généré pour chaque table métier (A ne lit, ne modifie ni ne supprime rien de B) | 🤖 || ✅ `8314aad` : `supabase/tests/database/isolation_all.test.sql` (toutes les tables avec `organization_id`, lecture / modification / suppression, dans les deux sens) |
| S3 | Journal d'audit non modifiable (aucune mise à jour ni suppression) + alertes e-mail : connexion admin depuis un nouvel appareil, 10 échecs en 15 min, 2FA désactivée, rôle admin attribué, export massif | 🤖 || ✅ `082f443` : journal d'audit inaltérable (déjà testé) + 5 alertes e-mail — reste 👤 : adresse de sécurité dans la console |
| S4 | `docs/NEXTIN_INCIDENT.md` séparé + registre des tests de restauration mensuels | 🤖 || ✅ 85519c1 : `docs/NEXTIN_INCIDENT.md` — reste 👤 : premier test de restauration avec Supabase Pro |
| S5 | Section « Normes » : alignement ISO 27001:2022 / 27701:2025 sans certification, avec la correspondance de l'annexe A | 🤖 || ✅ 0958cf2 : `docs/NEXTIN_SECURITY_AND_PRIVACY.md` §7 |
| S6 | Activer *Secret scanning* et *Push protection* sur GitHub | 👤 | ☐ |
| S7 | Revue de sécurité indépendante, puis test d'intrusion | Claude (cette conversation) | ☐ |

---

## 4. Produit, avant la clinique pilote

| # | Point | Qui | État |
|---|---|---|---|
| P1 | **Création d'un établissement depuis /admin** pour un client (formule, durée d'essai, invitation du responsable par e-mail, modèles de services) | 🤖 | ✅ 2e304fb — `docs/modules/P1-CONSOLE-ORG.md` |
| P2 | **Invitations du personnel envoyées par e-mail** : aujourd'hui le lien est seulement affiché, à copier et transmettre à la main | 🤖 | ✅ 760c7d9 — e-mail à la création, « Renvoyer » (nouveau lien) dans l'équipe et la console, `docs/modules/P2-INVITATIONS-EMAIL.md` |
| P3 | Page « À proximité » : section « Récents » + invitation à activer la position | 🤖 | ✅ ea62f52 — `docs/modules/M9.md` §P3, budget /nearby 198 Ko |
| P4 | Voix des annonces (ElevenLabs, `pnpm voices:generate`) | 👤 | ☐ |
| P5 | Fiche d'installation client + fiche « coupure de courant » | Claude, sur demande | ☐ |
| P6 | Document d'architecture du poste local hors ligne (`NEXTIN_OFFLINE_FIRST.md`), sans développement | 🤖 | ✅ e139312 — 4 questions ouvertes au §12 (matériel, formule, bascule, nom des clients) |
| C1 | Paiement manuel dans la console (espèces, virement, chèque, Mobile Money hors ligne), effet identique à un paiement en ligne, annulation avec motif, journalisé | 🤖 | ✅ 2f6e693 — `docs/modules/C1-MANUAL-PAYMENT.md` |
| C2 | Page Aide du patient (FAQ bilingue + coordonnées et horaires de l'établissement du ticket) | 🤖 | ✅ 56bd381 — `/help`, `docs/modules/M4.md` §C2 |
| C3 | « Demander de l'aide » sur la page ticket → pastille à l'accueil avec « Traité » (une demande / 5 min, rien sur la TV) | 🤖 | ✅ 84bf9eb — `docs/modules/M5.md` §C3 |
| C4 | Tableau de bord : « Aujourd'hui », « Hier », « Période personnalisée » (92 jours max, limite d'historique), comparaison avec la période précédente | 🤖 | ✅ 34e86dc — `docs/modules/M8.md` §C4 |
| C5 | `docs/NEXTIN_RECETTE_PILOTE.md` : grille de 15 tests manuels sur place | 🤖 | ✅ fe45ba8 — à dérouler sur place par Wintek et le directeur |
| U1 | Écarts du §0 du référentiel UX : `loading.tsx` (squelettes), `error.tsx` / `global-error.tsx` bilingues, `EmptyState`, `useOptimistic`, « Annuler » 5 s, titres sans coupure, axe sur toutes les pages principales (clair et sombre) | 🤖 | ✅ 737f75d — `docs/modules/U1-UX-QUALITE.md` ; arbitrage budget : pas d'`error.tsx` ni de squelette sur `/t`, `/nearby`, `/b` (≈ 5 Ko et 2 Ko par page), `global-error` bilingue à la place |

**Reporté après le pilote** (noté, non développé) : liste complète des organisations dans `/admin` (suspendre, réactiver, activité) ; module Incidents ; supervision globale (écrans en ligne, erreurs, impayés).

---

## 5. Configuration de la production (👤, dans cet ordre)

1. **Domaine** (ex. nextin.cm ou nextin.app).
2. **Brevo ou Resend** : vérifier le domaine (SPF, DKIM, DMARC), créer une clé SMTP.
3. **Supabase** → Authentication :
   - URL Configuration : *Site URL* = `https://<domaine>`, *Redirect URLs* = `https://<domaine>/**` ;
   - SMTP Settings : celui de l'étape 2 ;
   - Anonymous sign-ins activé ;
   - Captcha Turnstile avec la clé secrète ;
   - MFA TOTP activé ;
   - longueur minimale des mots de passe : 10.
4. **Cloudflare Turnstile** : un widget pour le domaine de production (les clés locales ne marchent pas sur le vrai domaine).
5. **Vercel** : importer le dépôt, dossier `apps/web`, puis saisir les variables de `.env.example` :
   - `APP_URL` ;
   - les clés Supabase ;
   - Turnstile ;
   - `IP_HASH_SALT` ;
   - `PAYMENT_PROVIDER` + clés et `PAYMENT_WEBHOOK_SECRET` ;
   - `EMAIL_PROVIDER=smtp` + `SMTP_*` + `EMAIL_FROM` ;
   - `NOTIFY_DISPATCH_SECRET` ;
   - les clés VAPID.

   Les secrets ne vont jamais dans Git ni dans la conversation.
6. Après le premier déploiement : `pnpm notify:configure` (enregistre l'adresse d'envoi des notifications dans Supabase).
   - Migrations de cette série à pousser (`pnpm db:link` puis `pnpm db:push`, avant le déploiement de `main`, toutes compatibles avec le code en ligne) : `20261120090000` (B2), `20261121090000` (B5), `20261122090000` (B1), `20261123090000` (S3), `20261124090000` (P1), `20261125090000` (P2), `20261126090000` (C1), `20261127090000` (C2), `20261128090000` (C3).
   - Console Wintek → Réglages : adresse des alertes de sécurité (S3), canal du code d'inscription (e-mail par défaut, B2) ; double authentification obligatoire **après** avoir configuré son propre code (B5).
   - Supabase → Authentication → Email Templates : coller les modèles de `docs/auth-emails/` (B3).
7. Compte **Notch Pay** (vérification d'identité, compte marchand), URL du webhook : `https://<domaine>/api/payments/webhook/notchpay`.
8. **Supabase Pro** au premier client payant (sauvegardes, pas de mise en pause).
9. Plus tard : compte SMS (agrégateur camerounais), WhatsApp Business (Meta).

---

## 6. Juridique et commercial

| # | Point | Qui |
|---|---|---|
| J1 | Compléter les champs vides des CGU et de la politique de confidentialité (date, NIU, région d'hébergement, prestataires) | 👤 |
| J2 | Relecture par un juriste, avec le registre des traitements (art. 29), le contrat de sous-traitance pour chaque établissement et les transferts hors du Cameroun (art. 60) | ⚖️ |
| J3 | Clinique pilote : 2 à 4 semaines, suivi des retours | 👤 |
| J4 | Kit d'installation à proposer : onduleur, TV, affiche QR | 👤 |

---

## 7. Décisions en attente (👤)

Les questions apparues pendant le développement sont ajoutées ici, avec le point concerné.

| Sujet | Recommandation |
|---|---|
| Agrégateur de paiement | Notch Pay (CinetPay en second) |
| Publicité : A, B ou C | A (vente accompagnée par Wintek) |
| Commission pour les établissements qui accueillent les écrans | Après la mise en ligne, 20 à 30 % |
| ISO | Alignement sans certification |
| Prix des packs d'extension | À confirmer |
| Absence automatique après appel | À tester, puis valider |
| Poste local hors ligne (P6, `NEXTIN_OFFLINE_FIRST.md` §12) : matériel (PC de l'accueil ou boîtier Wintek), formule (option ou Premium/Enterprise), bascule automatique à 30 s ou manuelle, nom des clients sur le poste local | Boîtier Wintek en option ; bascule automatique ; nom gardé seulement pour les cliniques |
| U1 : sur `/t`, `/nearby` et `/b`, ni page d'erreur dédiée ni squelette, pour tenir le budget de 200 Ko (la page d'erreur globale bilingue s'affiche) | Garder ainsi ; ou relever le budget de ces pages à 205 Ko |

---

## 8. Après la mise en ligne

- Poste local hors ligne (selon `NEXTIN_OFFLINE_FIRST.md`).
- WhatsApp, puis SMS.
- Application de caisse dédiée.
- Application mobile (M11, Expo).
- Commissions publicitaires.
- Certification ISO 27001 si une banque ou un opérateur la demande.
