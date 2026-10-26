# NextIn by Wintek — Plan d'architecture (étape 1)

> Statut : **validé le 26/10/2026**, avec les ajustements de la §10 (intégrés dans tout le document).
> Conventions : identifiants (tables, colonnes, code) en anglais ; interface en français par défaut, bascule EN.

---

## 1. Vue d'ensemble

```
                    ┌──────────────────────────── apps/web (Next.js App Router, PWA) ────────────────────────────┐
 Client (anonyme)   │ /q/[token]  /c  /t/[token]  /nearby        → pages RSC ultra-légères (< 200 Ko)            │
 Réception / Agent  │ /desk/reception  /desk/counter             → PWA hors ligne (IndexedDB + outbox)           │
 Écran TV           │ /tv                                        → kiosque, cache audio, reconnexion auto        │
 Admin étab.        │ /app/...  (dashboard, config, écrans, QR, abonnement)                                      │
 Annonceur          │ /ads/...                                                                                   │
 Super admin        │ /admin/...                                                                                 │
                    └───────────────┬───────────────────────────────────────┬───────────────────────────────────┘
                                    │ supabase-js (anon / session)          │ Route handlers (service role,
                                    │ RPC SECURITY DEFINER + Realtime       │ rate limit, PDF, IP hash)
                    ┌───────────────▼───────────────────────────────────────▼───────────────────────────────────┐
                    │ Supabase : Postgres 15 (+ PostGIS, pg_cron, pg_net) · Auth · RLS · Realtime · Storage     │
                    │ Edge Functions : whatsapp-webhook · notify-dispatcher · payments-callback · remote-sweeper │
                    └───────────────┬──────────────────────────┬───────────────────────────┬────────────────────┘
                                    │                          │                           │
                           WhatsApp Cloud API          MTN MoMo / Orange Money        SMS (secours)
```

### Décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| Identité client | **Supabase Anonymous Sign-in** au premier ticket + `public_token` (128 bits) par ticket, **protégés par Cloudflare Turnstile invisible** (captcha natif Supabase Auth à la création de la session anonyme + vérification serveur à chaque prise de ticket) ; **tâche pg_cron quotidienne** qui supprime les comptes anonymes inactifs (> 7 jours sans connexion et sans ticket actif) | Aucun compte, aucune install ; RLS par `auth.uid()` ; lien WhatsApp `/t/{token}` pour rouvrir le ticket sur un autre appareil ; anti-abus sans friction ; conversion en compte possible plus tard (M11) |
| Écritures sensibles | **Uniquement via RPC Postgres `SECURITY DEFINER`** (`take_ticket`, `call_next`, `finish_ticket`…) — aucune policy INSERT/UPDATE directe sur `tickets` | Le moteur de file est transactionnel (verrous `FOR UPDATE SKIP LOCKED`), atomique et non contournable |
| Source de vérité de la file | SQL (position, numérotation, appel) ; **formule d'estimation** dupliquée en TS (`packages/shared`) et SQL, avec un **test de parité** | L'estimation doit être calculable côté serveur (établissements à proximité) et côté client (affichage optimiste hors ligne) |
| Temps réel | **Realtime Broadcast émis par triggers DB** (`realtime.send`) plutôt que Postgres Changes | Pas de fuite de colonnes ; topics publics sans données personnelles pour client/TV ; topics privés (RLS sur `realtime.messages`) pour le staff |
| Écran TV | Pas de compte utilisateur : appairage → `device_token` (hash en base) ; config/pubs via route handler ; flux d'appels via topic public de l'agence | Numéros de ticket = information publique (affichée en salle) ; révocation = token invalidé → écran repasse en mode appairage |
| API | Route handlers Next.js pour l'app ; **Edge Functions** pour webhooks et workers | URL de webhook stable, indépendante de l'hébergement web |
| Notifications | Table **outbox** `notification_jobs` alimentée par triggers → `notify-dispatcher` (pg_net + pg_cron chaque minute) → fournisseurs `whatsapp` → `webpush` → `sms` | Retries, déduplication, bascule SMS, statuts tracés |
| i18n | `next-intl` **sans préfixe d'URL** (cookie + Accept-Language) ; dictionnaires dans `packages/shared/i18n` | Les URL des QR codes imprimés restent stables quelle que soit la langue |
| PWA | **Service worker écrit à la main** (`public/sw.js`) : precache de l'app shell, runtime cache, page hors ligne, web push ; manifest via `app/manifest.ts` | Next.js 16 compile avec Turbopack, que les plugins SW basés sur webpack ne supportent pas ; un SW maison reste petit et entièrement maîtrisé |
| Poids client | Pages client en RSC, JS client minimal, **pas de framer-motion** sur le parcours client (ressorts en CSS `linear()`), polices système | Budget < 200 Ko, 3G |
| UI | shadcn/ui (Radix) **re-stylé intégralement** selon les tokens iOS ; `vaul` pour les sheets | Accessibilité Radix + rendu Apple HIG |
| Hébergement | **Vercel** ; URL publique lue dans la variable `APP_URL`, jamais en dur (QR codes, liens WhatsApp, PDF) | Domaine définitif communiqué avant M2 |
| PDF supports QR | `@react-pdf/renderer` dans un route handler (chevalet A5, affiche A4) | Rendu vectoriel net, génération serveur, pré-rempli |
| Hors ligne agent | Snapshot de file + **outbox de commandes idempotentes** (`client_op_id`) en IndexedDB, rejouées au retour réseau | Voir §5.4 |

---

## 2. Arborescence du monorepo

```
nextin/
├── CLAUDE.md                         # conventions projet + règles design Apple (tenu à jour)
├── .env.example                      # toutes les variables, sans valeurs
├── turbo.json · pnpm-workspace.yaml · package.json · tsconfig.base.json
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (public)/             # client : q/[token], c (code court), t/[token], nearby, rate
│   │   │   ├── (desk)/desk/          # reception, counter/[id] — PWA hors ligne
│   │   │   ├── tv/                   # écran TV plein écran + appairage
│   │   │   ├── (org)/app/            # admin établissement : dashboard, branches, services, counters,
│   │   │   │                         #   staff, displays, qr, settings, billing
│   │   │   ├── (ads)/ads/            # annonceur : campaigns, billing, stats
│   │   │   ├── (platform)/admin/     # super admin : organizations, plans, moderation, revenue, support
│   │   │   ├── (auth)/               # login (e-mail OTP / mot de passe), invite/[token]
│   │   │   ├── design/               # vitrine du design system (M1)
│   │   │   ├── api/                  # route handlers : tickets, pdf, tv, push, ads/track
│   │   │   ├── manifest.ts · sw.ts   # PWA
│   │   ├── components/ui/            # design system iOS (Button, GroupedList, Sheet, TabBar…)
│   │   ├── components/…              # composants métier par domaine
│   │   ├── lib/supabase/             # clients browser / server / service
│   │   ├── lib/offline/              # IndexedDB, outbox, sync
│   │   ├── lib/audio/                # file d'annonces, cache segments, Web Speech fallback
│   │   ├── messages/ → packages/shared/i18n
│   │   └── e2e/                      # Playwright
│   └── mobile/                       # Expo — créé UNIQUEMENT en M11
├── packages/
│   ├── shared/
│   │   ├── src/types/                # types DB générés (supabase gen types) + types domaine
│   │   ├── src/schemas/              # Zod (validation client ET serveur)
│   │   ├── src/queue/                # estimation d'attente, ordre de file, formatage ticket
│   │   ├── src/announcements/        # construction de la séquence audio (« Ticket C 47, cabinet 3 »)
│   │   ├── src/phone/                # normalisation E.164 Cameroun (+237)
│   │   ├── src/money/                # XAF (pas de décimales), formatage FCFA
│   │   └── src/i18n/{fr,en}.json
│   ├── notifications/                # abstraction fournisseurs : whatsapp, webpush, sms (Deno + Node)
│   ├── payments/                     # abstraction : mtn-momo, orange-money
│   └── config/                       # eslint, tsconfig, tailwind preset (tokens iOS)
├── supabase/
│   ├── config.toml
│   ├── migrations/                   # SQL versionné, appliqué via `npx supabase db push`
│   ├── functions/                    # whatsapp-webhook, notify-dispatcher, payments-callback, remote-sweeper
│   ├── tests/                        # pgTAP : RLS + moteur de file
│   └── seed/                         # démo DOUALA CLINIC + Eneo Douala (script idempotent)
├── scripts/
│   ├── generate-voices.ts            # ElevenLabs (M6)
│   └── seed-demo.ts
└── docs/ (PLAN.md, captures/, notes de module)
```

---

## 3. Schéma de base de données

Conventions : `uuid` (`gen_random_uuid()`), `timestamptz`, `created_at`/`updated_at` partout (trigger `set_updated_at`), montants en `integer` XAF. **Chaque table métier porte `organization_id`** (dénormalisé si besoin) pour des policies RLS simples et indexées.

> **Migrations progressives** : ce schéma est la cible. Chaque module ne crée **que** les tables dont il a besoin (M1 : socle identité/tenants/audit/rate limit ; M2 : structure + QR ; M3 : file ; etc. — voir §7.1). Aucune table n'est créée « en avance ».

### 3.1 Énumérations

```
org_type          : clinic | hospital | telecom | bank | utility | administration | other
org_status        : pending | active | suspended   (pending conservé pour compatibilité, plus utilisé : activation immédiate, §11)
member_role       : org_admin | branch_manager | receptionist | agent
counter_kind      : cabinet | guichet | caisse | laboratoire | accueil
counter_status    : closed | open | paused
ticket_status     : waiting | called | serving | served | no_show | cancelled | transferred
ticket_source     : qr | short_code | remote | reception
priority_reason   : appointment | pregnancy | elderly | disability | other
notif_channel     : whatsapp | webpush | sms
notif_event       : ticket_confirmed | almost_turn | your_turn | ticket_moved_back | ticket_cancelled | rate_visit
job_status        : queued | sending | sent | delivered | read | failed | skipped
display_status    : pending | active | revoked
campaign_status   : draft | pending_review | approved | rejected | active | paused | ended
payment_provider  : fake | notchpay | fapshi | mesomb | flutterwave   (agrégateurs ; voir §11.5)
payment_status    : pending | successful | failed | expired
payment_channel   : mtn_momo | orange_money
billing_period    : monthly | annual
invoice_status    : draft | open | paid | void
reminder_kind     : trial_end | renewal | grace | read_only | deletion
subscription_status: trialing | active | past_due | read_only | suspended | cancelled
```

### 3.2 Identité, tenants, personnel

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `full_name`, `phone_e164`, `locale`, `avatar_path` | créé par trigger sur `auth.users` (sauf anonymes) |
| `platform_admins` | `user_id` PK, `granted_by`, `granted_at` | non modifiable par l'app (service role uniquement) |
| `organizations` | `name`, `slug` unique, `type org_type`, `status org_status` (défaut **`active`** : aucune validation manuelle, §11 ; `suspended` = suspension de modération par Wintek), `logo_path`, `country` (`CM`), `currency` (`XAF`), `default_locale` (`fr`), `data_retention_days` (défaut **30**, 7-365), `validated_at`, `validated_by` | idx `status` |
| `memberships` | `organization_id`, `user_id`, `role member_role`, `branch_id` (NULL = toutes agences), `active` | unique (`organization_id`,`user_id`,`branch_id`) ; idx (`user_id`) |
| `invitations` | `organization_id`, `email`/`phone_e164`, `role`, `branch_id`, `token_hash`, `expires_at`, `accepted_at` | unique `token_hash` |

### 3.3 Structure : agences, services, guichets

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `branches` | `organization_id`, `name`, `address`, `city`, `location geography(Point,4326)`, `timezone` (`Africa/Douala`), `phone`, `active` | GIST (`location`) ; idx (`organization_id`) |
| `branch_settings` (1:1) | `branch_id` PK, `remote_tickets_enabled` **false**, `remote_confirm_threshold` 3, `remote_penalty_places` 3, `remote_max_delays` 2, `remote_max_distance_km`, `priorities_enabled` true, `almost_turn_threshold` 3, `max_active_tickets_per_customer` 1, `rating_enabled` true | |
| `announcement_settings` (1:1) | `branch_id` PK, `languages text[]` (`{fr,en}`), `volume` 0-100, `repeat_count` 1-3, `chime_enabled`, `quiet_hours jsonb` (`[{from,to}]`) | |
| `opening_hours` | `branch_id`, `weekday` 0-6, `opens_at time`, `closes_at time` | unique (`branch_id`,`weekday`,`opens_at`) |
| `branch_closures` | `branch_id`, `date`, `reason` | unique (`branch_id`,`date`) |
| `specialties` | `organization_id`, `name`, `name_en`, `active` | unique (`organization_id`, lower(`name`)) — spécialités médicales ou métiers de guichet (ex. Pédiatrie, Réclamations) |
| `practitioners` | `organization_id`, `branch_id`, `user_id` (NULL si le praticien n'a pas de compte), `title` (Dr, Pr…), `display_name`, `specialty_id`, `active` | idx (`branch_id`,`specialty_id`) — base de la réorientation automatique (§12.2) et des rendez-vous (§12.3) |
| `services` | `organization_id`, `branch_id`, `specialty_id` (facultatif), `name`, `name_en`, `prefix` (1-2 lettres A-Z), `color`, `description`, `default_service_seconds` (**obligatoire, saisi par le directeur** à la création du service, 60-7200 s), `allow_priority`, `allow_remote`, `max_daily_tickets`, `active`, `sort_order` | unique (`branch_id`,`prefix`) |
| `counters` | `organization_id`, `branch_id`, `name`, `kind counter_kind`, `number`, `default_practitioner_id` (cabinet attitré), `status counter_status`, `current_agent_id`, `status_changed_at` | unique (`branch_id`,`kind`,`number`) |
| `counter_services` | `counter_id`, `service_id`, `weight` | PK (`counter_id`,`service_id`) |
| `counter_sessions` | `counter_id`, `agent_id`, `started_at`, `ended_at` | idx (`counter_id`,`started_at`) |
| `counter_pauses` | `session_id`, `started_at`, `ended_at`, `reason` | |
| `qr_codes` | `organization_id`, `branch_id`, `service_id` (NULL = agence), `token` (22 car. base62) unique, `short_code` (6 car. sans 0/O/1/I) unique, `active`, `revoked_at` | régénération = révocation + nouvelle ligne ; idx partiel actifs |

### 3.4 Moteur de file

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `daily_sequences` | `service_id`, `service_day date`, `last_number` | PK (`service_id`,`service_day`) — incrément atomique `INSERT … ON CONFLICT DO UPDATE … RETURNING` ; jour calculé dans le fuseau de l'agence |
| `tickets` | `organization_id`, `branch_id`, `service_id`, `service_day`, `number`, `display_code` (ex. `C-047`, format `formatTicketCode`), `public_token` unique (NULL après purge), `customer_user_id` (anonyme ou compte), `source`, `priority_level` smallint (0 normal, 1 prioritaire), `priority_reason`, `status`, `sort_key bigint`, `counter_id` (guichet qui appelle/sert), `preferred_counter_id` (RDV avec un praticien), `appointment_id`, `created_by` (staff), `called_at`, `serving_started_at`, `finished_at`, `recall_count`, `transferred_from_id`, **distance** : `is_remote`, `presence_confirmed_at`, `delay_count`, **note** : `rating` 1-5, `rating_comment`, `rated_at` | unique (`service_id`,`service_day`,`number`) ; **idx partiel** (`service_id`,`priority_level` DESC,`sort_key`) WHERE `status='waiting'` ; idx (`branch_id`,`service_day`,`status`) ; idx (`customer_user_id`) ; idx (`counter_id`) WHERE `status IN ('called','serving')` |
| `ticket_events` | `ticket_id`, `organization_id`, `type` (created, called, recalled, serving, served, no_show, transferred, moved_back, cancelled, presence_confirmed, rated), `actor_user_id`, `counter_id`, `payload jsonb` | idx (`ticket_id`) ; idx (`organization_id`,`created_at`) — base des statistiques |
| `appointments` | voir §12.3 (module M5b) | |
| `service_time_stats` | `service_id`, `counter_id` (NULL = moyenne service), `ewma_seconds`, `samples`, `updated_at` | PK (`service_id`, `counter_id` COALESCE) — mis à jour par trigger à chaque `served` |
| `client_ops` | `client_op_id` uuid PK, `user_id`, `counter_id`, `op`, `result jsonb`, `created_at` | idempotence des commandes hors ligne (purge 7 j) |

**Ordre de passage** : `priority_level DESC, sort_key ASC`. `sort_key` = epoch ms à la création ; « reculer de N places » = prendre le `sort_key` du N-ième ticket suivant + 1 (sans renuméroter les autres).

**Position** = nombre de tickets `waiting` du même service avant le ticket (ordre ci-dessus) + 1.

**Estimation** (fonction pure, `packages/shared/queue/estimate.ts` + miroir SQL `estimate_wait_seconds`) :
```
durée(service, guichet) = default_service_seconds tant que samples < 10 (historique insuffisant),
                          puis mélange progressif w·ewma + (1−w)·default avec w = min(1, (samples − 10) / 20) + 0,  (w = 1 dès 30 services)
                          repli guichet sans historique → durée au niveau service
débit = Σ sur les guichets ouverts servant le service : 1 / durée(service, guichet)
attente ≈ (position − 1) / débit + temps restant estimé du service en cours (borne ≥ 0)
EWMA : α = 0,2, valeurs aberrantes écrêtées (< 20 s ou > 4 × moyenne ignorées)
Aucun guichet ouvert → estimation basée sur 1 guichet + statut « service fermé pour le moment »
```

### 3.5 Notifications

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `notification_contacts` | `ticket_id`, `organization_id`, `channel`, `phone_e164`, `wa_id`, `push_subscription jsonb`, `locale`, `consent_source` (`customer_optin` / `reception_with_consent`), `consent_at`, `window_expires_at` (fenêtre 24 h WhatsApp), `opted_out_at` | idx (`ticket_id`) ; idx (`wa_id`) |
| `whatsapp_opt_outs` | `phone_e164` PK, `opted_out_at` | STOP global, respecté par le dispatcher |
| `notification_jobs` | `ticket_id`, `organization_id`, `event notif_event`, `channel`, `status job_status`, `attempt`, `next_attempt_at`, `dedupe_key` unique, `provider_message_id`, `template_name`, `payload jsonb`, `error`, `fallback_of` (job d'origine si bascule SMS) | idx (`status`,`next_attempt_at`) ; idx (`provider_message_id`) |
| `provider_webhook_events` | `provider`, `event_id` unique, `payload jsonb`, `received_at`, `processed_at` | journal brut + idempotence des webhooks |

### 3.6 Écrans TV

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `displays` | `organization_id`, `branch_id`, `name`, `status display_status`, `pairing_code` (6 chiffres, pending uniquement), `pairing_expires_at` (10 min), `device_token_hash` (sha256), `show_ads`, `theme`, `last_seen_at`, `app_version` | unique partiel `pairing_code` WHERE `status='pending'` |
| `display_services` | `display_id`, `service_id` | PK composite |

Flux d'appairage : l'écran `/tv` génère un code à 6 chiffres via `POST /api/tv/pair` (rate-limité) → l'admin saisit le code dans *Écrans* et choisit agence + services → l'écran, qui interroge en long-polling, reçoit son `device_token` (stocké en localStorage, seul le hash est en base).

### 3.7 Publicité

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `advertisers` | `name`, `business_type`, `phone_e164`, `address`, `location geography`, `status` | |
| `advertiser_members` | `advertiser_id`, `user_id`, `role` (owner/editor) | PK composite |
| `ad_campaigns` | `advertiser_id`, `name`, `status campaign_status`, `starts_on`, `ends_on`, `center geography(Point)`, `radius_m`, `org_types org_type[]`, `surfaces text[]` (`tv`,`app`), `package_code`, `price_xaf`, `moderation_note`, `reviewed_by`, `reviewed_at` | idx (`status`,`starts_on`,`ends_on`) |
| `ad_creatives` | `campaign_id`, `kind` (image/video), `storage_path`, `headline`, `offer_text`, `cta_url`, `promo_code`, `duration_seconds` (5-15) | |
| `ad_schedules` | `campaign_id`, `weekday`, `start_time`, `end_time` | |
| `ad_campaign_branches` | `campaign_id`, `branch_id` | ciblage matérialisé à l'approbation (`ST_DWithin`) ; PK composite |
| `ad_events` | `campaign_id`, `creative_id`, `branch_id`, `display_id`, `surface`, `type` (impression/click/visit), `occurred_at` | **partitionnée par mois** ; insertion par lots |
| `ad_daily_stats` | `campaign_id`, `day`, `branch_id`, `impressions`, `clicks`, `visits`, `quiz_plays`, `coupons_issued`, `coupons_redeemed` | rollup pg_cron horaire |
| `ad_sectors` | `code` (ex. `health`, `pharmacy`, `food`, `telecom`, `beauty`, `betting`, `alcohol`), `name`, `name_en`, `requires_health_visa` | référentiel modifiable par le super admin (§12.4) |
| `organization_ad_preferences` | `organization_id` PK, `blocked_sectors text[]`, `quiz_enabled` (défaut true), `house_ads_enabled` | réglage par établissement (§12.4, §12.5) |
| `ad_packages` | `code` (`maison`, `bronze`, `argent`, `or`), `name`, `price_xaf`, `duration_days`, `max_branches`, `share_of_voice`, `surfaces`, `quiz_allowed`, `active` | prix et contenu modifiables par le super admin, jamais en dur |
| `ad_quizzes` | `campaign_id`, `title`, `reward_text`, `coupon_validity_days`, `max_coupons`, `status` (draft / pending_review / approved / rejected), `reviewed_by` | 3 à 5 questions (contrainte vérifiée à la soumission) |
| `ad_quiz_questions` | `quiz_id`, `position`, `question`, `question_en`, `answers jsonb` (2 à 4 réponses, une seule correcte) | |
| `ad_quiz_plays` | `quiz_id`, `branch_id`, `ticket_id`, `score`, `started_at`, `finished_at` | unique (`quiz_id`,`ticket_id`) : une partie par ticket ; aucune donnée personnelle |
| `ad_coupons` | `campaign_id`, `play_id`, `code` (8 car.) unique, `qr_token` unique, `expires_at`, `redeemed_at`, `redeemed_by` (membre annonceur) | |

`advertisers` reçoit `sector` (référence `ad_sectors`) ; `ad_campaigns` reçoit `sector`, `package_code` (référence `ad_packages`), `health_visa_number` et `health_visa_document_path` (obligatoires si le secteur l'exige).

« Visites » : le commerce reçoit un code promo / QR « j'y suis » ; sa saisie ou son scan en magasin crée l'événement `visit`.

### 3.8 Abonnements et paiements (détail du fonctionnement : §11)

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `plans` | `code` unique (`essentiel`, `pro`, `entreprise`), `name`, `base_price_xaf` (prix mensuel), `included_branches`, `extra_branch_price_xaf` (NULL = pas d'agence en plus), `max_counters_per_branch` / `max_displays_per_branch` (NULL = illimité), `features jsonb` (`voice_announcements`, `appointments`, `remote_tickets`, `advanced_stats`, `export`, `dedicated_support`), `whatsapp_quota_per_branch` (messages / mois), `annual_free_months` (défaut 2), `trial_eligible`, `active`, `sort_order` | valeurs initiales insérées par une migration de données, **modifiables par le super admin** (jamais lues depuis le code) |
| `subscriptions` | `organization_id` **unique**, `plan_id`, `billing_period`, `status subscription_status`, `trial_ends_at`, `current_period_start`, `current_period_end`, `grace_ends_at`, `read_only_since`, `suspended_since`, `deletion_due_at`, `pending_status` + `pending_status_after` (changement différé à la fermeture), `discount_id`, `cancelled_at` | idx (`status`, `current_period_end`) ; idx (`pending_status_after`) WHERE `pending_status IS NOT NULL` |
| `subscription_events` | `subscription_id`, `organization_id`, `type` (trial_started, invoice_issued, paid, renewed, grace_started, read_only, suspended, reactivated, days_granted, discount_applied, plan_changed, deleted), `actor_user_id`, `payload jsonb` | historique + base des revenus |
| `trial_claims` | `phone_hash` **unique**, `organization_id` **unique**, `claimed_at` | un seul essai par numéro et par établissement |
| `phone_verifications` | `user_id`, `phone_hash`, `code_hash`, `attempts` (max 5), `expires_at` (10 min), `verified_at` | rate limit 3 codes / heure / numéro |
| `invoice_sequences` | `year`, `last_number` | PK (`year`) — numérotation **continue sans trou** (`FAC-2026-000123`), attribuée à l'émission |
| `invoices` | `number` unique, `organization_id` ou `advertiser_id`, `subscription_id` ou `campaign_id`, `period_start`, `period_end`, `billing_period`, `lines jsonb`, `subtotal_xaf`, `discount_xaf`, `tax_xaf`, `total_xaf`, `status invoice_status`, `due_at`, `paid_at`, `pay_token_hash` (lien de paiement), `pdf_path`, `buyer_snapshot jsonb`, `seller_snapshot jsonb` (raison sociale, RC, NIU, adresse Wintek au moment de l'émission) | CHECK exactement un payeur ; **jamais supprimées** (obligation comptable) |
| `payments` | `invoice_id`, `provider payment_provider`, `channel payment_channel`, `msisdn_masked`, `amount_xaf`, `status payment_status`, `external_id` unique (idempotence), `provider_ref`, `raw jsonb` | idx (`invoice_id`) |
| `discounts` | `organization_id` (NULL = code promo global), `code`, `kind` (`percent` / `fixed_xaf`), `value`, `remaining_invoices`, `expires_at`, `created_by`, `reason` | |
| `billing_reminders` | `subscription_id`, `kind reminder_kind`, `offset_days` (7, 3, 1), `target_date`, `channel`, `sent_at` | unique (`subscription_id`,`kind`,`offset_days`,`target_date`,`channel`) — idempotence |
| `messaging_usage` | `organization_id`, `month`, `whatsapp_sent`, `sms_sent` | PK (`organization_id`,`month`) — quotas |
| `platform_settings` | ligne unique : `company_legal_name`, `company_rc`, `company_niu`, `company_address`, `invoice_footer`, `trial_days` (14), `grace_days` (7), `retention_after_suspension_days` (30), `default_closing_time` (22:00), `vat_rate` | modifiable par le super admin uniquement |

### 3.9 Plateforme

| Table | Colonnes clés |
|---|---|
| `audit_log` | `organization_id`, `actor_user_id`, `action` (ex. `counter.open`, `ticket.priority_change`, `qr.regenerate`, `display.revoke`, `org.suspend`, `campaign.approve`, `member.role_change`), `entity_type`, `entity_id`, `diff jsonb`, `ip_hash`, `created_at` — append-only (aucune policy UPDATE/DELETE) |
| `rate_limits` | `key` (ex. `take_ticket:ip:<hash>`, `take_ticket:uid:<id>`), `window_start`, `count` — PK (`key`,`window_start`), purge pg_cron |

### 3.10 Vues / fonctions d'agrégation (M8)
`v_service_live` (attente, longueur de file, guichets ouverts), `daily_branch_stats` et `daily_counter_stats` (table rollup pg_cron : tickets, temps moyen d'attente/service, absents, notes moyennes, affluence horaire).

---

## 4. Politiques RLS

RLS **activée sur toutes les tables** (`FORCE ROW LEVEL SECURITY` sur les tables sensibles). Fonctions d'aide `SECURITY DEFINER STABLE`, `search_path` figé :

```sql
is_platform_admin()                         -- EXISTS platform_admins WHERE user_id = auth.uid()
has_org_role(org uuid, roles member_role[]) -- membre actif de l'org avec un des rôles (branch_id indifférent)
can_access_branch(branch uuid, roles member_role[])
                                            -- membre de l'org de l'agence avec branch_id NULL ou = branch
is_advertiser_member(adv uuid)
```

| Tables | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `organizations` | membres de l'org ; super admin | INSERT : via `create_organization` / `self_service_signup` uniquement (statut `active`) ; UPDATE : `org_admin` (sauf `status` → super admin uniquement, via trigger de garde) |
| `memberships`, `invitations` | membres de l'org | `org_admin` ; `branch_manager` pour son agence et rôles ≤ au sien |
| `branches`, `branch_settings`, `announcement_settings`, `opening_hours`, `services`, `counters`, `counter_services`, `qr_codes`, `displays`, `display_services` | staff de l'agence | `org_admin` ; `branch_manager` sur son agence |
| `counters.status` / sessions | staff de l'agence | via RPC `open_counter`, `pause_counter`, `close_counter` |
| `tickets` | staff de l'agence ; **client : `customer_user_id = auth.uid()`** | **aucune** policy d'écriture : tout passe par les RPC |
| `ticket_events`, `appointments`, `service_time_stats` | staff de l'agence | RPC / triggers uniquement (`appointments` : réception + manager) |
| `notification_*`, `provider_webhook_events`, `client_ops`, `rate_limits` | staff (contacts : numéro masqué via vue) / aucun | service role uniquement |
| `advertisers`, `ad_campaigns`, `ad_creatives`, `ad_schedules` | membres annonceur ; super admin | membres annonceur tant que `draft`/`rejected` ; transitions de statut par RPC (`submit_campaign`, `approve_campaign` super admin) |
| `ad_events`, `ad_daily_stats` | membres annonceur (stats agrégées) ; super admin | service role |
| `plans`, `platform_settings` | tous (formules actives, mentions légales) | super admin |
| `subscriptions`, `subscription_events`, `invoices`, `payments`, `messaging_usage` | `org_admin` / membres annonceur concernés ; super admin | RPC + Edge Functions `payments-webhook` et `billing-daily` (service role) |
| `trial_claims`, `phone_verifications`, `invoice_sequences`, `billing_reminders`, `discounts` | super admin (sauf `phone_verifications` : aucun) | RPC / service role uniquement |
| `audit_log` | `org_admin` (son org) ; super admin | INSERT par triggers/RPC uniquement |
| `storage` : `voices` (lecture publique), `ad-creatives` (lecture publique si campagne approuvée, écriture membres annonceur), `org-assets` (logos : écriture `org_admin`) | | |
| `realtime.messages` (topics privés `staff:branch:{id}`, `org:{id}`) | `can_access_branch` / `has_org_role` | — |

**Surface publique (anonyme)** — uniquement des RPC `SECURITY DEFINER` qui renvoient des colonnes choisies :
`resolve_entry(qr_token | short_code)` → établissement, agence, services actifs + attente ; `take_ticket(...)` ; `get_ticket(public_token)` ; `cancel_my_ticket` ; `rate_ticket` ; `confirm_presence(public_token, qr_token)` ; `nearby_branches(lat, lng, radius_km)`.

Les tests pgTAP vérifient pour chaque table qu'un membre de l'organisation A ne voit **rien** de l'organisation B, et qu'un client anonyme ne voit que ses propres tickets.

---

## 5. Logique métier critique

### 5.1 RPC du moteur de file (toutes transactionnelles, journalisées dans `ticket_events`)
- `take_ticket(service_id, source, priority_reason?, entry_token?, ip_hash)` : contrôles (service actif, agence ouverte, quota journalier, 1 ticket actif / client / agence, distance autorisée si remote, rate limit 5 tickets / 10 min / IP, 3 / h / uid), numéro via `daily_sequences`, `display_code`, `sort_key`.
- `reception_create_ticket(service_id, priority_reason?, phone_e164?, consent bool, appointment_id?)` : idem + contact SMS/WhatsApp avec consentement tracé.
- `call_next(counter_id, client_op_id)` — bouton **« Alerter le suivant »** (appel en deux temps, §12.1) : sélectionne le prochain ticket parmi les services du guichet (`counter_services`, pondération, `preferred_counter_id` prioritaire pour ce guichet), `FOR UPDATE SKIP LOCKED` → `called`, émet les broadcasts TV + client et les jobs `your_turn` + `almost_turn` pour le ticket situé à `almost_turn_threshold` places.
- `admit_ticket` — bouton **« Admettre »** quand le patient entre : `called` → `serving`, le chrono démarre (`serving_started_at`) ; `finish_ticket`, `recall_ticket` (incrémente `recall_count`, ré-annonce), `mark_no_show`, `transfer_ticket(target_service_id)` (nouveau ticket lié, conserve priorité et ancienneté), `set_priority`, `move_back(ticket, places)`.
- `pause_counter` : le guichet ne tire plus de tickets ; les tickets `preferred_counter_id` de ce guichet repassent en file commune (redistribution naturelle sur les autres guichets) ; `open_counter` / `close_counter`.

### 5.2 Temps réel (topics Broadcast)
| Topic | Public ? | Contenu | Abonnés |
|---|---|---|---|
| `branch:{id}:board` | public | services : longueur de file, attente estimée, derniers appels (`display_code`, guichet) | TV, page client |
| `ticket:{public_token}` | public (jeton non devinable) | statut, position, attente, guichet appelé | page ticket client |
| `staff:branch:{id}` | **privé** | changements de file complets, guichets | réception, agents, dashboard |

Repli : si le WebSocket tombe (3G), la page ticket bascule en polling `get_ticket` toutes les 20 s avec backoff ; l'écran TV affiche un indicateur hors ligne et se reconnecte automatiquement.

### 5.3 Ticket à distance (M9)
Désactivé par défaut (`remote_tickets_enabled = false`). À `remote_confirm_threshold` (3) places : job WhatsApp « confirmez votre présence en scannant le QR ». Worker `remote-sweeper` (pg_cron, chaque minute) : si le ticket arrive en tête sans `presence_confirmed_at` → `move_back(N = remote_penalty_places)`, `delay_count++`, job `ticket_moved_back` ; au 2ᵉ retard (`remote_max_delays`) → `cancelled`. « Quand partir » = attente estimée − temps de trajet (distance à vol d'oiseau, vitesse urbaine paramétrable).

### 5.4 Mode dégradé des postes agent / réception
- Le poste garde en IndexedDB un **snapshot** de la file de ses services (rafraîchi en continu).
- Hors ligne, « Appeler le suivant » prend le premier ticket du snapshot, l'affiche immédiatement et enregistre `call_ticket(ticket_id, client_op_id)` dans l'**outbox** ; terminer/absent/rappel idem.
- Au retour réseau, l'outbox est rejouée dans l'ordre ; chaque RPC est idempotente (`client_ops`). Conflit (ticket déjà appelé par un autre guichet) → le serveur renvoie le ticket réellement disponible et le poste affiche une bannière explicite.
- L'écran TV hors ligne conserve le dernier état + l'audio en cache ; les annonces reprennent au retour.

### 5.5 Notifications (M7)
- Opt-in : bouton « Recevoir mes alertes sur WhatsApp » → `https://wa.me/<numéro>?text=NEXTIN C-047 7K3Q` (code ticket + suffixe du token). Le webhook (`whatsapp-webhook`, signature `X-Hub-Signature-256` vérifiée avec `WHATSAPP_APP_SECRET`) lie `wa_id` au ticket, ouvre `window_expires_at = now() + 24 h`, répond `ticket_confirme`.
- Dans la fenêtre : messages de service ; hors fenêtre : modèles approuvés FR/EN `ticket_confirme`, `bientot_votre_tour`, `cest_votre_tour`, `ticket_recule`.
- `STOP` → `whatsapp_opt_outs` + `opted_out_at`.
- Dispatcher : WhatsApp → web push (si abonnement) → SMS si pas de WhatsApp, échec de remise ou statut `failed` reçu par webhook (délai de garde 2 min sur `your_turn`). Jamais de nom de client dans les messages.

### 5.6 Annonces vocales (M6)
Séquence construite par `packages/shared/announcements` : `chime` → `fr/word-ticket` → `fr/letter-c` → `fr/47` → `fr/word-please-go-to` → `fr/word-cabinet` → `fr/3` → (EN si activé) → `fr/word-thanks`. File séquentielle (une annonce à la fois), répétitions, volume, plages de silence ; segments préchargés (Cache Storage) au démarrage ; segment manquant → Web Speech API pour la phrase entière. Bouton « Activer le son » obligatoire (politique autoplay).

---

## 6. Design system Apple (M1)

Tokens dans `packages/config/tailwind` (CSS variables, clair/sombre via `prefers-color-scheme` + bascule) :
- **Typo** : `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui` ; échelle Large Title 34/41 bold, Title 28/34, Title2 22, Headline 17 semibold, Body 17/22, Callout 16, Subheadline 15, Footnote 13, Caption 12 — en `rem` pour respecter la taille de texte utilisateur.
- **Couleurs** : fond groupé `#F2F2F7` (sombre `#000`), cartes `#FFF` (sombre `#1C1C1E`), labels iOS (primary/secondary/tertiary), séparateur 0,5 px `rgba(60,60,67,.29)` ; accents Wintek : Navy `#0D2C54`, Blue `#1A6BB5` (action), Orange `#F58B1F` (attention), Green `#2EC04E` (succès) — contrastes AA vérifiés (texte sur Blue en blanc ; Orange/Green réservés aux pastilles et icônes, pas au texte courant sur fond blanc).
- **Formes** : rayons continus 12/16/22 px (`border-radius` + `corner-shape: squircle` en amélioration progressive), ombres très douces.
- **Composants de la page `/design`** : typographie, palette clair/sombre, Button (filled/tinted/gray/plain/destructive, tailles, état pressé), GroupedList (encart, chevrons, détails, swipe), Card, Toggle (switch iOS), SegmentedControl, TabBar translucide, NavigationBar à grand titre réductible + bouton retour, Sheet (vaul, détentes), ActionSheet, Alert, TextField / SearchField, Stepper, Badge, ProgressRing, SkeletonList, **TicketHero** (numéro + attente en héros), Toast.
- **Mouvement** : ressorts CSS (`linear()` généré), 200-350 ms, `prefers-reduced-motion` respecté ; retour tactile immédiat (`:active` scale 0.97 / opacité).
- **Accessibilité** : cibles ≥ 44 px, focus visible, `aria-label` sur toutes les icônes-boutons, rôles ARIA Radix, tests axe dans Playwright.
- **Icônes** : lucide (trait 1,5 px), jamais d'emoji.

---

## 7. Découpage en modules (livrables et critères de validation)

| # | Module | Livrables | Tests de fin de module |
|---|---|---|---|
| **M1** | Fondations + design system | Monorepo Turborepo/pnpm, Next.js + Tailwind + shadcn re-stylé, Supabase lié (CLI npx), migrations socle (profiles, organizations, memberships, invitations, platform_admins, audit_log, rate_limits) + fonctions RLS, auth (e-mail OTP + mot de passe, anonyme), garde de rôles, i18n FR/EN, PWA (manifest, SW, installable), `CLAUDE.md`, `.env.example`, CI GitHub Actions (lint, typecheck, Vitest, Playwright). **Page `/design` → arrêt pour validation avant tout écran.** | Vitest (helpers), pgTAP RLS socle, Playwright : `/design` rendu clair/sombre + axe |
| **M2** | Structure établissement + QR | Tables §3.3 (dont spécialités et praticiens), écrans admin (agences, services, guichets, horaires, personnel/invitations, praticiens), QR par agence/service + code court, régénération, PDF chevalet A5 + affiche A4 | pgTAP isolation, Playwright : créer agence → service → guichet → télécharger PDF |
| **M3** | Moteur de file + estimation + temps réel | Tables §3.4, RPC §5.1, triggers broadcast §5.2, EWMA, `packages/shared/queue` | Vitest estimation + parité SQL, pgTAP concurrence `call_next` (pas de double appel), numérotation journalière |
| **M4** | Parcours client web | `/q/[token]`, `/c` (code), choix service + priorité, ticket héros (numéro + attente), suivi temps réel, pubs placeholders, notation | Playwright 3G simulée : scan → ticket → appel → note ; budget < 200 Ko vérifié en CI |
| **M5** | Postes réception et agent | Réception (créer ticket, impression thermique 58/80 mm via CSS print, priorités, RDV, réorientation, vue live, ouvrir un guichet), Agent : appel en deux temps « Alerter le suivant » puis « Admettre » (chrono à l'admission), terminer/rappeler/transférer/absent/pause ; absence ou retard d'un praticien avec réorientation automatique (§12.1, §12.2) ; hors ligne §5.4 | Playwright : parcours complets + coupure réseau / resync |
| **M5b** | Rendez-vous | Créneaux par praticien, prise de RDV (accueil, puis client au M9), arrivée et intégration dans la file selon la règle d'équité, absents, états en attente / reprogrammé (§12.3) | Vitest règle d'équité, pgTAP créneaux et chevauchements, Playwright RDV → arrivée → appel |
| **M6** | Écran TV + voix | `/tv`, appairage 6 chiffres, menu Écrans (révocation), affichage appels + QR + carrousel, audio §5.6, `scripts/generate-voices.ts` | Vitest séquence audio, Playwright appairage → appel → affichage, révocation |
| **M7** | Notifications | Abstraction fournisseurs, `whatsapp-webhook`, `notify-dispatcher`, web push (VAPID), SMS secours, STOP | Vitest signature + bascule, tests d'intégration avec faux fournisseur |
| **M8** | Tableau de bord | Affluence horaire, attentes, performance par praticien, absents, notes, export CSV, temps réel | Vitest agrégats, Playwright dashboard |
| **M9** | Distance | Établissements à proximité (PostGIS), ticket à distance, « quand partir », confirmation de présence, recul/annulation | pgTAP sweeper, Playwright parcours distance |
| **M10a** | Abonnements automatiques + paiements + super admin | Inscription en libre-service (téléphone vérifié par WhatsApp, Turnstile), essai Pro 14 j, assistant de démarrage, rappels J-7/J-3/J-1, paiement MTN MoMo / Orange Money via agrégateur, webhook signé et idempotent, factures PDF numérotées, grâce → lecture seule → suspension → suppression, limites des formules côté serveur, super admin (abonnements, revenus, jours offerts, remises, formules) — détail §11 | Vitest tarification + machine d'états, pgTAP limites / transitions différées / idempotence, Playwright inscription → essai → paiement simulé → activation → facture |
| **M10b** | Publicité | Espace annonceur, ciblage, modération (visa santé obligatoire pour santé et pharmacie), secteurs bloqués par établissement, formules Maison / Bronze / Argent / Or, quiz sponsorisé avec bon de réduction à QR code, diffusion TV/app, stats ; paiement des campagnes avec le même agrégateur (§12.4, §12.5) | Playwright campagne → modération → paiement simulé → diffusion |
| **M11** | App Expo | Client + agent, réutilise `packages/shared` | Tests Jest/Detox de base |

### 7.1 Tables créées par module (migrations progressives)

| Module | Tables / objets créés |
|---|---|
| M1 | `profiles`, `platform_admins`, `organizations`, `memberships`, `invitations`, `audit_log`, `rate_limits`, fonctions RLS, purge des anonymes (pg_cron) |
| M2 | `branches`, `branch_settings`, `opening_hours`, `branch_closures`, `specialties`, `practitioners`, `services`, `counters`, `counter_services`, `qr_codes`, PostGIS |
| M3 | `daily_sequences`, `tickets`, `ticket_events`, `service_time_stats`, `client_ops`, RPC de file, triggers Realtime, `purge_personal_data()` |
| M5 | `counter_sessions`, `counter_pauses`, `practitioner_absences` |
| M5b | `practitioner_schedules`, `appointments`, réglages d'équité dans `branch_settings` |
| M6 | `displays`, `display_services`, `announcement_settings`, bucket `voices` |
| M7 | `notification_contacts`, `notification_jobs`, `provider_webhook_events`, `whatsapp_opt_outs` |
| M8 | `daily_branch_stats`, `daily_counter_stats`, vues `v_service_live` |
| M10a | `plans`, `subscriptions`, `subscription_events`, `trial_claims`, `phone_verifications`, `invoice_sequences`, `invoices`, `payments`, `discounts`, `billing_reminders`, `messaging_usage`, `platform_settings`, bucket privé `invoices`, bucket `org-assets` |
| M10b | `advertisers`, `advertiser_members`, `ad_*` (dont `ad_sectors`, `ad_packages`, `ad_quizzes`, `ad_quiz_questions`, `ad_quiz_plays`, `ad_coupons`), `organization_ad_preferences`, buckets `ad-creatives` et privé `ad-documents` |

**Données de démo** (script idempotent, enrichi à chaque module) : **DOUALA CLINIC** (Akwa, Douala — Consultation générale `C`, Pédiatrie `P`, Laboratoire `L`, Caisse `K` ; cabinets 1-4, labo 1, caisse 1) et **Eneo — Agence Bonanjo, Douala** (Réclamations `R`, Abonnements `A`, Paiement facture `F` ; guichets 1-5).

---

## 8. Variables d'environnement

| Variable | Module | Où la trouver |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` | M1 | ✅ présentes dans la session |
| `APP_URL` | M1 (lue par les QR, liens et PDF dès M2) | domaine de production Vercel (en local : `http://localhost:3000`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | M1 (config) / M4 (usage) | Cloudflare → Turnstile → Add widget (mode *Invisible*) ; la clé secrète est aussi à saisir dans Supabase → Authentication → Attack Protection → Captcha (Turnstile). En dev : clés de test officielles Cloudflare |
| `IP_HASH_SALT` | M3 | chaîne aléatoire que je peux générer, à stocker dans l'environnement |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | M7 | `npx web-push generate-vapid-keys` |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_FR`, `ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_MODEL_ID` | M6 | elevenlabs.io → Profile → API Keys / Voice Library |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | M7 | Meta for Developers → app → WhatsApp → API Setup / App Settings → Basic |
| `SMS_PROVIDER` + clés du fournisseur | M7 | faux fournisseur `console` en attendant le choix au M7 |
| `PAYMENT_PROVIDER` (`fake` par défaut) + clés de l'agrégateur retenu (ex. `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_PRIVATE_KEY`, `NOTCHPAY_WEBHOOK_SECRET`) | M10a | tableau de bord de l'agrégateur choisi (§11.5) |
| `EMAIL_PROVIDER` + clés (ex. `RESEND_API_KEY`, `EMAIL_FROM`) | M10a (rappels, factures) | fournisseur d'e-mails transactionnels à choisir (§11.10) |

---

## 9. Décisions prises (ex-questions ouvertes)

1. **Maquette** : écrans exportés en PNG rangés dans `design/mockups/`, à suivre fidèlement.
2. **Hébergement** : Vercel ; domaine communiqué avant M2, `APP_URL` en attendant.
3. **SMS** : faux fournisseur `console` jusqu'au M7.
4. **Imprimante** : impression navigateur 80 mm (CSS print) pour la V1.
5. **Tarifs et abonnements** : parcours automatique sans validation manuelle, formules et prix en base (§11).

## 10. Ajustements validés

1. **Connexion anonyme protégée** : Turnstile invisible à la création de la session anonyme (captcha Supabase Auth) et à chaque prise de ticket (vérification serveur dans le route handler) ; pg_cron `purge_inactive_anonymous_users()` quotidien.
2. **Migrations progressives** : chaque module ne crée que ses tables.
3. **Durée de service par défaut** saisie par le directeur pour chaque service (champ obligatoire), utilisée tant que l'historique est insuffisant (< 10 services), puis fondue progressivement dans la moyenne réelle (§3.4).
4. **Protection des données** : `organizations.data_retention_days` (défaut 30). pg_cron quotidien `purge_personal_data()` : passé ce délai, suppression des `notification_contacts`, mise à NULL de `tickets.public_token`, `tickets.customer_user_id`, `tickets.rating_comment`, `appointments.phone_e164`/`customer_label`, et des numéros dans `notification_jobs.payload` / `provider_webhook_events.payload`. Seules restent les données anonymisées (numéros de ticket, horodatages, durées, notes chiffrées) qui alimentent les statistiques. `whatsapp_opt_outs` conserve le numéro (obligation de respecter le STOP), haché en SHA-256.
5. **`APP_URL`** : variable serveur unique, lue par un helper `getAppUrl()` (validé par Zod au démarrage) ; jamais d'URL en dur dans le code.

---

## 11. Abonnements automatiques (M10a)

Objectif : un établissement s'inscrit, essaie, paie et renouvelle **sans aucune intervention de Wintek**. Le super admin supervise et peut suspendre un compte (fraude, abus), mais ne valide plus rien.

### 11.1 Inscription en libre-service (`/signup`)
1. Compte du directeur : e-mail (confirmé par Supabase Auth) + mot de passe, Turnstile invisible.
2. Établissement : nom, secteur (`org_type`), téléphone camerounais (`normalizeCameroonPhone`).
3. Vérification du téléphone par **code WhatsApp à 6 chiffres** (modèle d'authentification Meta `code_verification` FR/EN, envoyé par la couche WhatsApp du M7 ; repli SMS si non remis). Code haché, 10 min, 5 essais, 3 envois / heure / numéro.
4. RPC `self_service_signup` (transaction) : crée l'organisation (`active`), l'`org_admin`, la `trial_claim`, l'abonnement `trialing` sur Pro, et journalise l'action. Rate limit : 3 inscriptions / jour / IP.

### 11.2 Essai gratuit
- 14 jours (`platform_settings.trial_days`) sur la formule Pro, sans moyen de paiement.
- **Un seul essai par numéro** (`trial_claims.phone_hash` unique, SHA-256 salé du numéro E.164) **et par établissement** (`organization_id` unique). Un numéro déjà utilisé peut créer un établissement, mais sans essai : il doit payer directement.

### 11.3 Assistant de démarrage
Écran plein après l'inscription, une étape à la fois, reprenable : 1) services (préfixe, couleur, durée par défaut), 2) guichets et cabinets, 3) QR code et supports PDF à imprimer (M2), 4) appairage de l'écran TV (M6), 5) récapitulatif. Il réutilise les écrans de M2 et M6 ; la progression est stockée sur l'organisation (`onboarding_step`).

### 11.4 Cycle de vie et machine d'états
```
trialing ──paiement──▶ active ──fin de période sans paiement──▶ past_due (grâce 7 j)
   │                     ▲                                          │
   └─fin d'essai─────────┼──────────────────────────────────────────┤
                         │ paiement (immédiat, à toute heure)       ▼
                         └───────────────── read_only ◀─────────────┘
                                               │ fin de grâce + 7 j
                                               ▼
                                           suspended ──30 j──▶ suppression des données
```
- **past_due** : tout fonctionne, bandeau « paiement en attente » pour le personnel.
- **read_only** : plus d'émission de tickets (`take_ticket` et `reception_create_ticket` refusés, page client « temporairement indisponible »). Le personnel consulte l'historique et les statistiques, et peut payer.
- **suspended** : accès du personnel limité à la page Abonnement ; écrans TV et pages publiques en message neutre ; QR codes inactifs.
- **Suppression** : 30 jours après la suspension (`retention_after_suspension_days`), avec rappels à J-7 et J-1 ; l'organisation et ses données sont supprimées en cascade. **Les factures et paiements sont conservés** (obligation comptable), avec l'identité de l'acheteur figée dans `buyer_snapshot`.
- **Jamais de coupure en pleine journée** : toute dégradation (→ past_due, → read_only, → suspended) est inscrite dans `pending_status`, et `pending_status_after` est calculé comme la plus tardive des heures de fermeture du jour de toutes les agences (`opening_hours`, fuseau Africa/Douala ; repli : `default_closing_time` 22:00). Le job `apply_pending_transitions` (pg_cron, toutes les 15 min) n'applique le changement qu'une fois cette heure passée **et** si aucune agence n'est ouverte. Les **réactivations** (paiement reçu) sont appliquées immédiatement.

### 11.5 Paiement : agrégateur Mobile Money
- Couche `packages/payments` : interface `PaymentProvider` (`createCheckout(invoice, msisdn, channel)`, `verifyWebhook(headers, rawBody)`, `parseEvent(body)`, `fetchStatus(ref)`), un adaptateur par agrégateur, plus un **faux fournisseur** (`fake`) qui simule succès, échec et délai pour le développement et les tests.
- Premier adaptateur à brancher **à choisir** parmi Notch Pay, Fapshi, MeSomb et Flutterwave, selon les frais, le KYC exigé, la qualité des webhooks signés et les délais de reversement (à comparer sur leurs offres actuelles avant de trancher).
- Lien de paiement `{APP_URL}/pay/{token}` (jeton à usage limité, haché en base) : page publique légère sans connexion (le payeur peut être le comptable) — montant, période, choix MTN MoMo / Orange Money, numéro à débiter.
- **Webhook** `payments-webhook/{provider}` (Edge Function) : signature vérifiée (HMAC du corps brut), événement enregistré dans `provider_webhook_events` (unique par fournisseur et identifiant) → traitement **idempotent** ; en cas de doute, le statut est revérifié auprès de l'agrégateur (`fetchStatus`) avant toute activation. Un paiement confirmé déclenche, dans une transaction : facture `paid`, prolongation de la période, statut `active`, `subscription_events`, puis génération de la facture PDF et envoi.
- Rattrapage : un job relance `fetchStatus` sur les paiements `pending` de plus de 10 minutes (webhook perdu).

### 11.6 Facturation
- Facture émise à J-7 de l'échéance (ou à la demande depuis la page Abonnement), numérotée `FAC-AAAA-NNNNNN` sans trou (`invoice_sequences`, verrou transactionnel).
- PDF (`@react-pdf/renderer`, gabarit Apple sobre, FR/EN) : raison sociale, **RC** et NIU de Wintek, adresse, client, période, lignes, remise, total en FCFA, mention « payée le … via MTN MoMo / Orange Money ». Mentions légales lues dans `platform_settings`, jamais en dur. Stocké dans le bucket privé `invoices`, envoyé par WhatsApp (document) et e-mail, téléchargeable depuis la page Abonnement.

### 11.7 Renouvellement et rappels (pas de prélèvement automatique)
- Période mensuelle ou annuelle, choisie au paiement ; renouvellement uniquement sur rappel et lien de paiement.
- Job quotidien `billing-daily` (Edge Function, pg_cron 08:00 Douala) : rappels à **J-7, J-3, J-1** avant la fin de l'essai ou de la période, puis pendant la grâce (J+1, J+4, J+6) et avant la suppression, par **WhatsApp** (modèles `rappel_abonnement`, `paiement_confirme`, `facture_disponible`, FR/EN) **et e-mail**, chacun avec le lien de paiement. Idempotence par `billing_reminders`.

### 11.8 Formules et calcul du prix
Valeurs initiales (migration de données, **modifiables par le super admin**, jamais lues depuis le code) :

| Formule | Prix mensuel | Agences | Guichets / agence | Écrans / agence | Fonctions |
|---|---|---|---|---|---|
| Essentiel | 25 000 FCFA par agence | 1 incluse, +25 000 / agence | 3 | 1 | statistiques de base |
| Pro | 45 000 FCFA par agence | 1 incluse, +45 000 / agence | 10 | 3 | annonces vocales, rendez-vous, ticket à distance, statistiques avancées |
| Entreprise | à partir de 120 000 FCFA | 3 incluses, +35 000 / agence | illimités | illimités | tout Pro + export, support dédié |

- Prix mensuel = `base_price_xaf` + max(0, agences − `included_branches`) × `extra_branch_price_xaf`. Prix annuel = prix mensuel × (12 − `annual_free_months`), soit **2 mois offerts**. Remise appliquée ensuite. Fonction pure `computeSubscriptionPrice` (`packages/shared`) et miroir SQL `subscription_price()` utilisé pour facturer, avec test de parité.
- **Limites vérifiées côté serveur** : fonction `org_entitlements(org)` (formule, statut, limites, fonctions) appelée par des triggers sur `branches`, `counters`, `displays` et par les RPC concernées (`take_ticket` à distance, rendez-vous, annonces vocales). Un dépassement renvoie une erreur explicite, traduite à l'écran avec un lien « Changer de formule ». Pendant l'essai : limites Pro.
- **Quotas WhatsApp** par formule (`whatsapp_quota_per_branch` × agences, par mois), comptés dans `messaging_usage`. Alerte au directeur à 80 % ; au-delà, les alertes passent par web push. Le message « c'est votre tour » reste prioritaire et toujours envoyé.
- Changement de formule : montée immédiate (prorata facturé), descente à la prochaine échéance si les limites de la nouvelle formule sont respectées.

### 11.9 Super admin
- Tableau des abonnements filtrable : essais, actifs, en retard (past_due), lecture seule, suspendus, avec échéance, formule, nombre d'agences et dernier paiement.
- Revenus : MRR (paiements annuels lissés sur 12 mois), encaissements du mois, répartition par formule, essais convertis.
- Actions journalisées dans l'audit : **offrir des jours** (prolonge l'essai ou la période), **appliquer une remise** (pourcentage ou montant, sur N factures), changer de formule, suspendre ou réactiver (modération), éditer les formules, quotas et mentions légales (`platform_settings`).

### 11.10 Points à trancher
1. **Agrégateur** : Notch Pay, Fapshi, MeSomb ou Flutterwave ? Le faux fournisseur suffit jusqu'à ce choix.
2. **Prix HT ou TTC**, et Wintek est-elle assujettie à la TVA (19,25 % au Cameroun) ? Cela détermine les lignes de la facture (`tax_xaf`, `vat_rate`).
3. **Interprétation des prix** : Essentiel et Pro sont facturés par agence (2 agences en Pro = 90 000 FCFA par mois), avec des limites de guichets et d'écrans par agence. À confirmer.
4. **Quotas WhatsApp** : valeurs par formule à fixer (proposition : Essentiel 1 500, Pro 4 000, Entreprise 6 000 messages par agence et par mois, à ajuster selon le coût Meta par conversation).
5. **Fournisseur d'e-mails transactionnels** (rappels, factures) : par exemple Resend ou Brevo.
6. **Mentions légales de Wintek** pour les factures : raison sociale, RC, NIU, adresse (saisies dans `platform_settings`).

### 11.11 Effets sur les modules précédents
- **M1** : `organizations.status` passe à `active` par défaut et `create_organization` n'attend plus de validation ; le super admin garde la suspension. Le changement est appliqué par une nouvelle migration lors de la fin du M1 (écran de création d'établissement), sans modifier les migrations déjà poussées.
- **Avant M10a**, les établissements créés (démo, pilotes) n'ont pas d'abonnement : `org_entitlements` les traite comme « pilote » avec les limites Pro, et le passage en production exige le M10a.
- La vérification du téléphone par WhatsApp dépend du M7 : le M10a vient donc après le M7, comme prévu.

---

## 12. Fonctionnalités ajoutées du cahier des charges (27/10/2026)

### 12.1 Appel en deux temps (M5)
1. **« Alerter le suivant »** (`call_next`) : le ticket passe `called` ; affichage sur l'écran TV, annonce vocale et alerte WhatsApp « c'est votre tour : cabinet X ».
2. **« Admettre »** (`admit_ticket`) quand le patient entre : `serving`, le chrono démarre à cet instant. La durée de service (EWMA §3.4) est mesurée de l'admission à la fin, jamais depuis l'alerte.
- Entre les deux : « Rappeler » (nouvelle annonce, `recall_count`), « Absent » (`no_show`) ; l'attente entre alerte et admission est mesurée à part (`called_at` → `serving_started_at`) pour les statistiques.
- Le poste reste utilisable d'une main : un seul bouton principal qui change de rôle (« Alerter le suivant » → « Admettre » → « Terminer et alerter le suivant »).

### 12.2 Absence ou retard d'un praticien (M5)
- Déclaration par le praticien lui-même ou par l'accueil : `declare_practitioner_absence(practitioner, kind absent|late, until, reason)` → table `practitioner_absences` (`practitioner_id`, `kind`, `starts_at`, `ends_at` ou `expected_at`, `reason`, `declared_by`).
- **Réorientation automatique** : ses tickets en attente (`preferred_counter_id` ou rendez-vous) sont réaffectés à un collègue **de la même spécialité** (`practitioners.specialty_id`) présent dans la même agence, en conservant leur ancienneté et leur priorité ; à défaut de collègue, ils rejoignent la file commune du service.
- **Retard** : les tickets restent rattachés au praticien, l'estimation d'attente intègre l'heure de retour prévue, et les patients sont prévenus.
- Notification WhatsApp au patient (modèle `praticien_reoriente` / `praticien_en_retard`, FR/EN) avec la nouvelle attente estimée. Action journalisée dans l'audit.

### 12.3 Rendez-vous (module M5b, après M5)
- **Créneaux par praticien** : `practitioner_schedules` (`practitioner_id`, `weekday`, `starts_at`, `ends_at`, `slot_minutes`, `service_id`) ; les créneaux libres sont calculés à la volée (horaires − rendez-vous − absences − fermetures).
- `appointments` : `organization_id`, `branch_id`, `practitioner_id`, `service_id`, `starts_at`, `ends_at`, `customer_label` (initiales, jamais annoncé), `phone_e164` (purgé avec les données personnelles), `status` (`scheduled`, `checked_in`, `waiting`, `rescheduled`, `completed`, `no_show`, `cancelled`), `rescheduled_from_id`, `ticket_id`. Exclusion des chevauchements par praticien (contrainte `EXCLUDE` sur la plage horaire).
- **Arrivée** : scan du QR ou accueil → ticket lié au rendez-vous (`priority_reason = appointment`).
- **Règle d'équité configurable** par agence (`branch_settings`) : `appointment_walkin_ratio` (après un rendez-vous, au moins N clients sans rendez-vous sont servis, défaut 2), `appointment_early_minutes` (priorité seulement à partir de X minutes avant l'heure, défaut 15), `appointment_late_grace_minutes` (au-delà, le rendez-vous perd sa priorité et devient un ticket ordinaire, défaut 10). Fonction pure partagée + miroir SQL dans `call_next`, avec test de parité.
- **Absents** : sans arrivée après la tolérance → `no_show` (statistiques par praticien). **Reprogrammé** : nouveau rendez-vous lié à l'ancien. **En attente** : rendez-vous arrivé mais dont le praticien est absent ou en retard (§12.2).

### 12.4 Publicité : secteurs, formules et visa santé (M10b)
- **Secteurs bloqués par établissement** (`organization_ad_preferences.blocked_sectors`) : une clinique peut refuser, par exemple, les paris ou l'alcool ; le ciblage (`ad_campaign_branches`) exclut ces établissements.
- **Formules** `ad_packages` : **Maison** (annonces de l'établissement pour ses propres services, sur ses écrans et pages, gratuites), **Bronze**, **Argent**, **Or** (part de diffusion, nombre d'établissements, surfaces TV/app, quiz autorisé ou non, durée). Prix et contenu en base, paramétrés par le super admin.
- **Visa du ministère de la Santé** : une campagne d'un secteur `requires_health_visa` (santé, pharmacie) ne peut être approuvée (`approve_campaign`) sans numéro de visa et justificatif (bucket privé `ad-documents`) ; contrôle côté serveur, pas seulement dans l'interface.

### 12.5 Quiz sponsorisé pendant l'attente (M10b)
- Carte **« Jouer en attendant »** sur Mon ticket, sous la carte du ticket et le bouton WhatsApp. Le jeu s'ouvre dans une feuille modale dont l'en-tête garde **toujours visibles le numéro et l'attente estimée** ; il ne remplace jamais la carte du ticket.
- Quiz de **3 à 5 questions** rattaché à une campagne ; questions créées par l'annonceur, **validées par le super admin** avec la campagne.
- En fin de partie : **bon de réduction à QR code** (code court + QR, durée de validité). Le commerçant le scanne avec son compte annonceur (`redeem_coupon`) ; parties, bons émis et bons utilisés alimentent les statistiques de l'annonceur.
- L'alerte **« c'est votre tour » interrompt toujours le jeu** : la feuille se ferme et l'état « appelé » s'affiche (événement temps réel du ticket).
- **Aucune donnée personnelle** : la partie est liée au ticket (une partie par ticket), sans nom ni téléphone.
- **Désactivable par établissement** (`organization_ad_preferences.quiz_enabled`).
- **Léger (3G)** : chargé uniquement à l'ouverture (JSON de quelques Ko, sans image lourde), aucun JS ajouté au premier chargement de Mon ticket.

