# NextIn — Sécurité et protection des données

Document de référence demandé par `docs/NEXTIN_MASTER_SPEC.md` (partie 16). Version du 5 novembre 2026, établie après l'audit du dépôt (branche `claude/bold-ride-v2yswm`). À tenir à jour à chaque module.
Textes destinés au public : `docs/NEXTIN_CGU.md`, `docs/NEXTIN_CONFIDENTIALITE.md` (projets, à faire relire par un juriste).

## 1. Ce que nous protégeons
| Donnée | Qui la voit | Durée |
|---|---|---|
| Nom du visiteur, âge ou n° de dossier | personnel de l'agence uniquement (jamais l'écran TV, les annonces, les messages, les statistiques, le journal d'audit, ni la console Wintek) | `data_retention_days` (30 j par défaut) |
| Téléphone, adresse e-mail, abonnement push | personnel de l'agence ; masqués pour le visiteur ; jamais la console Wintek | 30 j |
| Position du téléphone | personne : jamais enregistrée (seule une durée de trajet estimée) | — |
| Numéros ayant demandé STOP | empreinte SHA-256 seulement | conservée pour respecter le choix |
| Comptes du personnel, journal d'audit, factures | établissement, Wintek (console) pour la facturation | abonnement ; factures : obligations comptables |
| Statistiques | établissement ; annonceurs : seulement affichages, clics, bons (anonymes) | — |

La publicité n'est **jamais** ciblée à partir de données personnelles ou de santé : ciblage par ville, type d'établissement et horaires uniquement (`ad_candidates`).

## 2. Mesures en place
### Isolation et droits (base de données)
- RLS activée sur **toutes** les tables ; chaque table métier porte `organization_id` (clé étrangère composite vers l'agence). Test pgTAP d'isolation entre deux établissements pour chaque table.
- Écritures sensibles uniquement par des fonctions `SECURITY DEFINER` à chemin de recherche figé, qui revérifient le rôle (`assert_branch_staff`, `has_org_role`, `is_platform_admin`…). Sessions anonymes des visiteurs exclues des droits du personnel (`is_anonymous()`).
- Droit d'exécution : retiré par défaut à PUBLIC (révocation globale, migration `20261117090000`). Le rôle anonyme n'exécute qu'une **liste fermée** de fonctions des pages publiques, vérifiée par `supabase/tests/database/security.test.sql`.
- Journal d'audit et événements des tickets en ajout seulement (aucune modification ni suppression possible). Chaque appel garde son auteur ; un **appel hors ordre** (ticket appelé alors que d'autres passaient avant) est journalisé `ticket.call_out_of_order`.
- **Alertes de sécurité par e-mail (S3, `20261123090000_security_alerts.sql`)** : connexion d'un administrateur depuis un nouvel appareil (identifiant aléatoire du navigateur, seule son empreinte est gardée), 10 échecs de connexion en 15 minutes sur un compte (adresse en empreinte), double authentification supprimée, rôle d'administrateur attribué, export massif (plus de 92 jours ou plus de 10 exports par heure). Envoyées à l'adresse de sécurité de Wintek (console), au compte concerné et, selon le cas, aux administrateurs de l'établissement ; file `security_alerts` lisible de la console seulement. Test : `security_alerts.test.sql`.
- Limitation des abus : `check_rate_limit` (tickets, demandes, codes, abonnements push, revérification des paiements), captcha Turnstile en production, un ticket actif par visiteur et par agence.

### Application web
- Session du personnel vérifiée auprès de Supabase (`auth.getUser()`) dans le proxy, les pages et les routes PDF ; cookies de session `Secure` en HTTPS, `SameSite=Lax` ; « Se souvenir de moi » décoché = cookies de session.
- En-têtes des documents : politique de sécurité du contenu (scripts et connexions limités à l'application, Supabase et Turnstile ; aucun cadre autorisé ; aucun plug-in ; formulaires vers l'application seulement), `X-Frame-Options: DENY`, `Permissions-Policy` (caméra et position pour l'application seule, micro refusé), `Cross-Origin-Opener-Policy`, HSTS en HTTPS (2 ans), `nosniff` partout. Testé : `lib/security/headers.test.ts`, `e2e/security.spec.ts` (aucune violation sur les pages client, TV et personnel).
- Liens personnels (`/t`, `/r`, `/pay`, `/coupon`) : jetons aléatoires de 22 à 32 caractères, jamais indexés, sans référent.
- Redirections après connexion via `safeNextPath` ; actions serveur validées par Zod ; API en JSON uniquement (anti-CSRF).
- Webhooks (WhatsApp, paiements) signés, idempotents ; un paiement est revérifié auprès du fournisseur avant activation. Expéditeur des messages protégé par un secret (comparaison à temps constant).
- Secrets : uniquement dans les variables d'environnement (Vercel, `apps/web/.env.local` ignoré par Git) ; jamais dans le code ni l'historique Git (vérifié le 5 novembre 2026). Codes de vérification et jetons d'écran stockés en empreinte.
- Dépendances : `pnpm audit --prod` sans vulnérabilité connue (5 novembre 2026).

### Audit du 5 novembre 2026 — constats et corrections
| Constat | Gravité | Correction |
|---|---|---|
| nodemailer 7.0.10 (envoi des e-mails) : 21 failles connues, dont 5 élevées | Élevée | Passage en 10.2.0 |
| 39 fonctions du personnel exécutables par le rôle anonyme (droit PUBLIC par défaut jamais retiré : la révocation du M1 était limitée au schéma) ; elles refusaient l'appel faute d'utilisateur | Moyenne (défense en profondeur) | Révocation globale + liste fermée testée |
| Aucune politique de sécurité du contenu ni HSTS | Moyenne | CSP, HSTS, COOP ajoutés, sans dépasser le budget de 200 Ko des pages client |
| Cookies de session sans attribut `Secure` | Faible (HTTPS imposé par l'hébergeur) | `Secure` en HTTPS |
| Routes PDF : jeton vérifié localement (`getClaims`) au lieu de `getUser` | Faible | `getUser` |
| Suivi de paiement sans limite : chaque appel interroge le fournisseur | Faible | 20 revérifications par minute et par lien |
| Appels hors ordre non journalisés (spec, annexe A) | — | `ticket.call_out_of_order` |
| Changement de mot de passe sans connexion récente | Faible | `secure_password_change` (à reporter dans Supabase, §4) |

## 3. Recommandations restantes (à décider)
1. ~~**Double authentification (TOTP)**~~ : **faite (B5)**, voir `docs/modules/B5-2FA.md` (aal2 exigé par la base dans les fonctions sensibles, code récent avant suppression, changement de rôle et export, console fermée après 30 min d'inactivité, réinitialisation journalisée). Reste à activer TOTP dans Supabase puis l'obligation dans la console.
2. **Comptes des services** (Supabase, Vercel, GitHub, Meta, agrégateur Mobile Money, Brevo/Resend) : double authentification obligatoire, accès nominatifs, retrait le jour du départ d'un collaborateur.
3. **Sauvegardes** : sauvegarde quotidienne et restauration à un instant donné (offre Supabase Pro), test de restauration chaque trimestre.
4. **Protection contre les mots de passe divulgués** (Supabase Auth, offre Pro).
5. **Test d'intrusion externe** avant le premier grand compte (banque, hôpital).
6. **Accord de traitement des données** (sous-traitance pour le compte des établissements) à faire rédiger avec le juriste.

## 4. À régler dans les tableaux de bord avant la mise en production
- **Supabase → Authentication** : longueur minimale 10 caractères, lettres et chiffres ; « Secure password change » activé ; confirmation des e-mails activée pour le personnel ; Turnstile (Attack Protection) avec la clé secrète ; « Allow anonymous sign-ins » activé (visiteurs) ; limites d'envoi par défaut gardées.
- **Supabase → Database** : migrations à jour (`pnpm db:push`) ; « Network restrictions » si l'offre le permet.
- **Vercel** : `APP_URL` en `https://…` (active HSTS, cookies `Secure` et `upgrade-insecure-requests`) ; variables secrètes en « Sensitive » ; protection des déploiements de prévisualisation.
- **Domaine** : HTTPS uniquement ; enregistrements SPF, DKIM et DMARC pour l'expéditeur des e-mails.

## 5. Procédure en cas d'incident
Document séparé : **`docs/NEXTIN_INCIDENT.md`**. Il contient les niveaux, la procédure (détecter, contenir, évaluer, notifier, corriger, retour d'expérience), le registre des incidents et le registre des tests de restauration mensuels.

## 6. Contrôles automatiques
| Contrôle | Où |
|---|---|
| RLS partout, isolation entre établissements | `supabase/tests/database/*.test.sql` ; **toutes les tables métier** (généré, S2) : `isolation_all.test.sql` |
| Droits d'exécution, chemins de recherche, journaux inaltérables, appels hors ordre | `supabase/tests/database/security.test.sql` |
| En-têtes et CSP | `apps/web/lib/security/headers.test.ts`, `apps/web/e2e/security.spec.ts` |
| Session invalide, redirections | `apps/web/e2e/session.spec.ts`, `lib/auth` |
| Dépendances | `pnpm audit --prod` (à lancer avant chaque mise en production) |

## 7. Normes : alignement ISO/IEC 27001:2022 et 27701:2025, sans certification (S5)
Décision (liste avant mise en ligne, §7) : NextIn **s'aligne** sur ISO/IEC 27001:2022 (sécurité de l'information) et ISO/IEC 27701:2025 (protection de la vie privée), **sans certification** pour l'instant. La certification sera envisagée si une banque ou un opérateur la demande.

Ce que cela signifie :
- **Tenir à jour** les documents qui servent de politique : ce document, `NEXTIN_INCIDENT.md`, la liste avant mise en ligne, les CGU et la politique de confidentialité.
- **Relier chaque mesure de l'annexe A** à ce qui existe dans NextIn (tableau ci-dessous).
- **Revoir le tableau** à chaque module et au moins une fois par an.

Les intitulés suivent la version 2022 de l'annexe A (93 mesures en 4 thèmes) ; à confirmer avec le texte acheté le jour d'un audit.

### Correspondance avec l'annexe A d'ISO/IEC 27001:2022
État : ✅ en place, ◐ en partie, ☐ à faire, — sans objet (assuré par l'hébergeur).

| Mesure | Intitulé | Dans NextIn | État |
|---|---|---|---|
| 5.1 | Politiques de sécurité de l'information | Ce document, `CLAUDE.md` (règles absolues), liste avant mise en ligne | ◐ (à faire valider par la direction de Wintek) |
| 5.2 | Rôles et responsabilités | Responsable sécurité Wintek (`NEXTIN_INCIDENT.md`) ; rôles du personnel (`member_role`) | ◐ |
| 5.3 | Séparation des tâches | Rôles distincts (administrateur, responsable d'agence, accueil, agent, caissier), super admin à part | ✅ |
| 5.9 | Inventaire des informations et des actifs | §1 « Ce que nous protégeons » ; tables métier listées par le test S2 | ◐ |
| 5.12 | Classification de l'information | §1 (qui voit quoi, durée) | ◐ |
| 5.14 | Transfert de l'information | HTTPS partout, HSTS, webhooks signés | ✅ |
| 5.15 | Contrôle d'accès | RLS sur toutes les tables, fonctions `SECURITY DEFINER` qui revérifient le rôle | ✅ |
| 5.16 | Gestion des identités | Comptes nominatifs (Supabase Auth), invitations, désactivation d'un membre | ✅ |
| 5.17 | Informations d'authentification | Mots de passe de 10 caractères au moins, codes hachés, double authentification (B5) | ✅ |
| 5.18 | Droits d'accès | Attribution et retrait par l'administrateur ; changement de rôle avec code récent, alerte (S3) | ✅ |
| 5.19–5.22 | Fournisseurs (relations, accords, suivi) | Supabase, Vercel, Brevo/Resend, agrégateur, Meta : contrats et sous-traitance à formaliser (J2) | ☐ |
| 5.23 | Services en nuage | Supabase et Vercel : comptes à double authentification, accès nominatifs (§3) | ◐ |
| 5.24–5.28 | Gestion des incidents (préparation, évaluation, réponse, retour d'expérience, preuves) | `NEXTIN_INCIDENT.md`, alertes S3, journal d'audit inaltérable | ✅ |
| 5.29–5.30 | Continuité, préparation des TIC | Postes hors ligne (rejeu), sauvegardes Supabase Pro, tests de restauration mensuels | ◐ (offre Pro à prendre) |
| 5.31 | Exigences légales | Loi n° 2024/017 ; CGU et confidentialité (J1, J2) | ◐ |
| 5.33 | Protection des enregistrements | Factures immuables, journal d'audit en ajout seulement | ✅ |
| 5.34 | Vie privée et protection des données personnelles | Nom du visiteur réservé au personnel, purge à 30 jours, position jamais enregistrée | ✅ |
| 5.35 | Revue indépendante | Revue de sécurité puis test d'intrusion (S7) | ☐ |
| 5.37 | Procédures d'exploitation documentées | `CLAUDE.md`, `docs/modules/`, guides (e-mails Supabase, paiements) | ✅ |
| 6.3 | Sensibilisation et formation | Formation du personnel de la clinique pilote (recette C5, test 12) | ☐ |
| 6.8 | Signalement des événements | `NEXTIN_INCIDENT.md` §2 ; alertes automatiques | ✅ |
| 7.1–7.14 | Sécurité physique | Centres de données de Supabase et Vercel | — |
| 8.1 | Terminaux des utilisateurs | Postes : session verrouillée, masquage du nom après 2 min | ◐ |
| 8.2 | Droits d'accès privilégiés | Super admin à part, double authentification obligatoire (B5), console fermée après 30 min | ✅ |
| 8.3 | Restriction d'accès à l'information | RLS, isolement testé sur toutes les tables (S2) | ✅ |
| 8.4 | Accès au code source | Dépôt GitHub privé, accès nominatifs ; protection de `main` (S6) | ◐ |
| 8.5 | Authentification sécurisée | Supabase Auth, captcha, limites de tentatives, alertes d'échecs (S3), TOTP | ✅ |
| 8.7 | Protection contre les programmes malveillants | Aucun fichier exécutable accepté ; types de fichiers limités, pas de SVG | ✅ |
| 8.8 | Vulnérabilités techniques | `pnpm audit` dans la CI, Dependabot, mises à jour de Next.js (S1) | ✅ |
| 8.9 | Gestion de la configuration | Migrations versionnées, `.env.example`, réglages documentés | ✅ |
| 8.10 | Suppression de l'information | `purge_personal_data` (30 jours) | ✅ |
| 8.11 | Masquage des données | Téléphones et e-mails masqués côté visiteur ; jamais de nom sur la TV | ✅ |
| 8.12 | Prévention des fuites | Aucun nom dans les diffusions, statistiques anonymes, alertes d'export massif (S3) | ✅ |
| 8.13 | Sauvegarde de l'information | Supabase Pro + tests de restauration mensuels | ☐ (offre Pro) |
| 8.15–8.16 | Journalisation, surveillance | Journal d'audit, `security_alerts`, journaux Supabase et Vercel | ◐ (supervision globale reportée après le pilote) |
| 8.20–8.23 | Sécurité des réseaux, filtrage | Hébergeur ; CSP, `X-Frame-Options`, HSTS | ✅ |
| 8.24 | Cryptographie | TLS, empreintes SHA-256 salées (codes, jetons, téléphones STOP), signatures HMAC | ✅ |
| 8.25–8.29 | Développement sécurisé, exigences, codage, tests | Revues, Zod côté client et serveur, pgTAP, Playwright, CI obligatoire | ✅ |
| 8.31 | Séparation des environnements | Supabase local (Docker) pour les tests, projet distant pour la production | ✅ |
| 8.32 | Gestion des changements | Branche de travail, CI verte, fusion dans `main` par Leonel après vérification | ✅ |
| 8.33 | Informations de test | Données de démo et de test fictives, nettoyées (`pnpm e2e:cleanup`) | ✅ |

### ISO/IEC 27701:2025 (vie privée)
NextIn est **sous-traitant** des établissements, qui sont responsables du traitement des données de leurs visiteurs. Il est **responsable de traitement** pour les comptes du personnel et la facturation. Points couverts :
- **Finalité et minimisation** : nom du visiteur seulement si l'agence le demande, position jamais enregistrée, statistiques anonymes.
- **Conservation** : 30 jours par défaut, réglable par établissement, purge automatique.
- **Droits des personnes** : à documenter dans la politique de confidentialité (J1), avec la procédure de réponse.
- **Sous-traitance** : contrat avec chaque établissement et liste des sous-traitants ultérieurs (J2).
- **Transferts hors du Cameroun** : hébergement Supabase et Vercel, à déclarer (J2, art. 60).
- **Violation de données** : `NEXTIN_INCIDENT.md` (notification de l'établissement sans délai).

Les numéros de clause de la version 2025 sont à reprendre du texte officiel lors d'un audit.
