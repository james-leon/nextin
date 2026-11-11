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
Un incident est tout accès non autorisé, perte, fuite ou indisponibilité prolongée touchant des données de visiteurs, du personnel ou de facturation.

1. **Détecter et signaler** (immédiatement) : toute personne qui constate un incident prévient le responsable sécurité de Wintek (contact@wintekservices.com — +237 690 72 23 16). Noter l'heure, ce qui a été vu, les établissements concernés.
2. **Contenir** (dans l'heure) : révoquer les accès en cause (mot de passe, sessions dans Supabase, clés d'API) ; faire tourner les secrets exposés (clé de service Supabase, `WHATSAPP_TOKEN`, `PAYMENT_WEBHOOK_SECRET`, `NOTIFY_DISPATCH_SECRET`, `SMTP_PASSWORD`, clés VAPID) ; suspendre si besoin l'établissement concerné depuis la console.
3. **Évaluer** (sous 24 h) : périmètre (quelles données, quels établissements, combien de personnes), cause, à l'aide du journal d'audit, des journaux Supabase et Vercel. Conserver les preuves (exports des journaux).
4. **Notifier** : chaque établissement concerné sans délai (il est responsable des données de ses visiteurs) ; l'autorité camerounaise de protection des données dans le délai prévu par la loi n° 2024/017 ; les personnes concernées si le risque est élevé (avec l'établissement).
5. **Corriger** : corriger la cause, ajouter un test qui empêche le retour du problème, déployer.
6. **Retour d'expérience** (sous 2 semaines) : rapport écrit (chronologie, cause, données touchées, mesures), mise à jour de ce document.

Registre des incidents : à tenir par Wintek (date, nature, périmètre, notifications faites, mesures).

## 6. Contrôles automatiques
| Contrôle | Où |
|---|---|
| RLS partout, isolation entre établissements | `supabase/tests/database/*.test.sql` ; **toutes les tables métier** (généré, S2) : `isolation_all.test.sql` |
| Droits d'exécution, chemins de recherche, journaux inaltérables, appels hors ordre | `supabase/tests/database/security.test.sql` |
| En-têtes et CSP | `apps/web/lib/security/headers.test.ts`, `apps/web/e2e/security.spec.ts` |
| Session invalide, redirections | `apps/web/e2e/session.spec.ts`, `lib/auth` |
| Dépendances | `pnpm audit --prod` (à lancer avant chaque mise en production) |
