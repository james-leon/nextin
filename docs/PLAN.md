# NextIn by Wintek — Plan d'architecture (étape 1)

> Statut : **en attente de validation**. Aucun code applicatif n'est écrit avant le feu vert.
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
| Identité client | **Supabase Anonymous Sign-in** au premier ticket + `public_token` (128 bits) par ticket | Aucun compte, aucune install ; RLS par `auth.uid()` ; lien WhatsApp `/t/{token}` pour rouvrir le ticket sur un autre appareil ; conversion en compte possible plus tard (M11) |
| Écritures sensibles | **Uniquement via RPC Postgres `SECURITY DEFINER`** (`take_ticket`, `call_next`, `finish_ticket`…) — aucune policy INSERT/UPDATE directe sur `tickets` | Le moteur de file est transactionnel (verrous `FOR UPDATE SKIP LOCKED`), atomique et non contournable |
| Source de vérité de la file | SQL (position, numérotation, appel) ; **formule d'estimation** dupliquée en TS (`packages/shared`) et SQL, avec un **test de parité** | L'estimation doit être calculable côté serveur (établissements à proximité) et côté client (affichage optimiste hors ligne) |
| Temps réel | **Realtime Broadcast émis par triggers DB** (`realtime.send`) plutôt que Postgres Changes | Pas de fuite de colonnes ; topics publics sans données personnelles pour client/TV ; topics privés (RLS sur `realtime.messages`) pour le staff |
| Écran TV | Pas de compte utilisateur : appairage → `device_token` (hash en base) ; config/pubs via route handler ; flux d'appels via topic public de l'agence | Numéros de ticket = information publique (affichée en salle) ; révocation = token invalidé → écran repasse en mode appairage |
| API | Route handlers Next.js pour l'app ; **Edge Functions** pour webhooks et workers | URL de webhook stable, indépendante de l'hébergement web |
| Notifications | Table **outbox** `notification_jobs` alimentée par triggers → `notify-dispatcher` (pg_net + pg_cron chaque minute) → fournisseurs `whatsapp` → `webpush` → `sms` | Retries, déduplication, bascule SMS, statuts tracés |
| i18n | `next-intl` **sans préfixe d'URL** (cookie + Accept-Language) ; dictionnaires dans `packages/shared/i18n` | Les URL des QR codes imprimés restent stables quelle que soit la langue |
| PWA | **Serwist** (`@serwist/next`) : precache, runtime cache, Background Sync, web push | Maintenu, compatible App Router |
| Poids client | Pages client en RSC, JS client minimal, **pas de framer-motion** sur le parcours client (ressorts en CSS `linear()`), polices système | Budget < 200 Ko, 3G |
| UI | shadcn/ui (Radix) **re-stylé intégralement** selon les tokens iOS ; `vaul` pour les sheets | Accessibilité Radix + rendu Apple HIG |
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

### 3.1 Énumérations

```
org_type          : clinic | hospital | telecom | bank | utility | administration | other
org_status        : pending | active | suspended
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
payment_provider  : mtn_momo | orange_money
payment_status    : pending | successful | failed | expired
subscription_status: trialing | active | past_due | suspended | cancelled
```

### 3.2 Identité, tenants, personnel

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `full_name`, `phone_e164`, `locale`, `avatar_path` | créé par trigger sur `auth.users` (sauf anonymes) |
| `platform_admins` | `user_id` PK, `granted_by`, `granted_at` | non modifiable par l'app (service role uniquement) |
| `organizations` | `name`, `slug` unique, `type org_type`, `status org_status` (défaut `pending`), `logo_path`, `country` (`CM`), `currency` (`XAF`), `default_locale` (`fr`), `validated_at`, `validated_by` | idx `status` |
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
| `services` | `organization_id`, `branch_id`, `name`, `name_en`, `prefix` (1-2 lettres A-Z), `color`, `description`, `default_service_seconds` (600), `allow_priority`, `allow_remote`, `max_daily_tickets`, `active`, `sort_order` | unique (`branch_id`,`prefix`) |
| `counters` | `organization_id`, `branch_id`, `name`, `kind counter_kind`, `number`, `status counter_status`, `current_agent_id`, `status_changed_at` | unique (`branch_id`,`kind`,`number`) |
| `counter_services` | `counter_id`, `service_id`, `weight` | PK (`counter_id`,`service_id`) |
| `counter_sessions` | `counter_id`, `agent_id`, `started_at`, `ended_at` | idx (`counter_id`,`started_at`) |
| `counter_pauses` | `session_id`, `started_at`, `ended_at`, `reason` | |
| `qr_codes` | `organization_id`, `branch_id`, `service_id` (NULL = agence), `token` (22 car. base62) unique, `short_code` (6 car. sans 0/O/1/I) unique, `active`, `revoked_at` | régénération = révocation + nouvelle ligne ; idx partiel actifs |

### 3.4 Moteur de file

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `daily_sequences` | `service_id`, `service_day date`, `last_number` | PK (`service_id`,`service_day`) — incrément atomique `INSERT … ON CONFLICT DO UPDATE … RETURNING` ; jour calculé dans le fuseau de l'agence |
| `tickets` | `organization_id`, `branch_id`, `service_id`, `service_day`, `number`, `display_code` (ex. `C047`), `public_token` unique, `customer_user_id` (anonyme ou compte), `source`, `priority_level` smallint (0 normal, 1 prioritaire), `priority_reason`, `status`, `sort_key bigint`, `counter_id` (guichet qui appelle/sert), `preferred_counter_id` (RDV avec un praticien), `appointment_id`, `created_by` (staff), `called_at`, `serving_started_at`, `finished_at`, `recall_count`, `transferred_from_id`, **distance** : `is_remote`, `presence_confirmed_at`, `delay_count`, **note** : `rating` 1-5, `rating_comment`, `rated_at` | unique (`service_id`,`service_day`,`number`) ; **idx partiel** (`service_id`,`priority_level` DESC,`sort_key`) WHERE `status='waiting'` ; idx (`branch_id`,`service_day`,`status`) ; idx (`customer_user_id`) ; idx (`counter_id`) WHERE `status IN ('called','serving')` |
| `ticket_events` | `ticket_id`, `organization_id`, `type` (created, called, recalled, serving, served, no_show, transferred, moved_back, cancelled, presence_confirmed, rated), `actor_user_id`, `counter_id`, `payload jsonb` | idx (`ticket_id`) ; idx (`organization_id`,`created_at`) — base des statistiques |
| `appointments` | `organization_id`, `branch_id`, `service_id`, `counter_id`, `scheduled_at`, `customer_label` (initiales, jamais annoncé), `phone_e164`, `status`, `ticket_id` | idx (`branch_id`,`scheduled_at`) |
| `service_time_stats` | `service_id`, `counter_id` (NULL = moyenne service), `ewma_seconds`, `samples`, `updated_at` | PK (`service_id`, `counter_id` COALESCE) — mis à jour par trigger à chaque `served` |
| `client_ops` | `client_op_id` uuid PK, `user_id`, `counter_id`, `op`, `result jsonb`, `created_at` | idempotence des commandes hors ligne (purge 7 j) |

**Ordre de passage** : `priority_level DESC, sort_key ASC`. `sort_key` = epoch ms à la création ; « reculer de N places » = prendre le `sort_key` du N-ième ticket suivant + 1 (sans renuméroter les autres).

**Position** = nombre de tickets `waiting` du même service avant le ticket (ordre ci-dessus) + 1.

**Estimation** (fonction pure, `packages/shared/queue/estimate.ts` + miroir SQL `estimate_wait_seconds`) :
```
débit = Σ sur les guichets ouverts servant le service : 1 / ewma(service, guichet)   (repli : ewma service, puis default_service_seconds)
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
| `ad_daily_stats` | `campaign_id`, `day`, `branch_id`, `impressions`, `clicks`, `visits` | rollup pg_cron horaire |

« Visites » : le commerce reçoit un code promo / QR « j'y suis » ; sa saisie ou son scan en magasin crée l'événement `visit`.

### 3.8 Abonnements et paiements

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `plans` | `code` unique, `name`, `price_xaf_monthly`, `limits jsonb` (agences, guichets, écrans, tickets/mois), `features jsonb` (remote, ads_free, sms_quota), `active` | |
| `subscriptions` | `organization_id`, `plan_id`, `status`, `current_period_start`, `current_period_end`, `assigned_by` | unique partiel 1 active / org |
| `invoices` | `number` unique, `organization_id` ou `advertiser_id`, `subscription_id` ou `campaign_id`, `amount_xaf`, `status`, `due_at`, `paid_at` | CHECK exactement un payeur |
| `payments` | `invoice_id`, `provider payment_provider`, `msisdn`, `amount_xaf`, `status`, `external_id` unique (idempotence), `provider_ref`, `raw jsonb` | idx (`invoice_id`) |

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
| `organizations` | membres de l'org ; super admin | INSERT : utilisateur authentifié non anonyme (statut forcé `pending`) ; UPDATE : `org_admin` (sauf `status`, `validated_*` → super admin uniquement, via trigger de garde) |
| `memberships`, `invitations` | membres de l'org | `org_admin` ; `branch_manager` pour son agence et rôles ≤ au sien |
| `branches`, `branch_settings`, `announcement_settings`, `opening_hours`, `services`, `counters`, `counter_services`, `qr_codes`, `displays`, `display_services` | staff de l'agence | `org_admin` ; `branch_manager` sur son agence |
| `counters.status` / sessions | staff de l'agence | via RPC `open_counter`, `pause_counter`, `close_counter` |
| `tickets` | staff de l'agence ; **client : `customer_user_id = auth.uid()`** | **aucune** policy d'écriture : tout passe par les RPC |
| `ticket_events`, `appointments`, `service_time_stats` | staff de l'agence | RPC / triggers uniquement (`appointments` : réception + manager) |
| `notification_*`, `provider_webhook_events`, `client_ops`, `rate_limits` | staff (contacts : numéro masqué via vue) / aucun | service role uniquement |
| `advertisers`, `ad_campaigns`, `ad_creatives`, `ad_schedules` | membres annonceur ; super admin | membres annonceur tant que `draft`/`rejected` ; transitions de statut par RPC (`submit_campaign`, `approve_campaign` super admin) |
| `ad_events`, `ad_daily_stats` | membres annonceur (stats agrégées) ; super admin | service role |
| `plans` | tous (actifs) | super admin |
| `subscriptions`, `invoices`, `payments` | `org_admin` / membres annonceur concernés ; super admin | RPC + Edge Function `payments-callback` |
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
- `call_next(counter_id, client_op_id)` : sélectionne le prochain ticket parmi les services du guichet (`counter_services`, pondération, `preferred_counter_id` prioritaire pour ce guichet), `FOR UPDATE SKIP LOCKED` → `called`, émet les broadcasts TV + client et les jobs `your_turn` + `almost_turn` pour le ticket situé à `almost_turn_threshold` places.
- `start_serving`, `finish_ticket`, `recall_ticket` (incrémente `recall_count`, ré-annonce), `mark_no_show`, `transfer_ticket(target_service_id)` (nouveau ticket lié, conserve priorité et ancienneté), `set_priority`, `move_back(ticket, places)`.
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
- Opt-in : bouton « Recevoir mes alertes sur WhatsApp » → `https://wa.me/<numéro>?text=NEXTIN C047-7K3Q` (code ticket + suffixe du token). Le webhook (`whatsapp-webhook`, signature `X-Hub-Signature-256` vérifiée avec `WHATSAPP_APP_SECRET`) lie `wa_id` au ticket, ouvre `window_expires_at = now() + 24 h`, répond `ticket_confirme`.
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
| **M2** | Structure établissement + QR | Tables §3.3, écrans admin (agences, services, guichets, horaires, personnel/invitations), QR par agence/service + code court, régénération, PDF chevalet A5 + affiche A4 | pgTAP isolation, Playwright : créer agence → service → guichet → télécharger PDF |
| **M3** | Moteur de file + estimation + temps réel | Tables §3.4, RPC §5.1, triggers broadcast §5.2, EWMA, `packages/shared/queue` | Vitest estimation + parité SQL, pgTAP concurrence `call_next` (pas de double appel), numérotation journalière |
| **M4** | Parcours client web | `/q/[token]`, `/c` (code), choix service + priorité, ticket héros (numéro + attente), suivi temps réel, pubs placeholders, notation | Playwright 3G simulée : scan → ticket → appel → note ; budget < 200 Ko vérifié en CI |
| **M5** | Postes réception et agent | Réception (créer ticket, impression thermique 58/80 mm via CSS print, priorités, RDV, réorientation, vue live, ouvrir un guichet), Agent (« Appeler le suivant » une main, chrono, terminer/rappeler/transférer/absent/pause), hors ligne §5.4 | Playwright : parcours complets + coupure réseau / resync |
| **M6** | Écran TV + voix | `/tv`, appairage 6 chiffres, menu Écrans (révocation), affichage appels + QR + carrousel, audio §5.6, `scripts/generate-voices.ts` | Vitest séquence audio, Playwright appairage → appel → affichage, révocation |
| **M7** | Notifications | Abstraction fournisseurs, `whatsapp-webhook`, `notify-dispatcher`, web push (VAPID), SMS secours, STOP | Vitest signature + bascule, tests d'intégration avec faux fournisseur |
| **M8** | Tableau de bord | Affluence horaire, attentes, performance par praticien, absents, notes, export CSV, temps réel | Vitest agrégats, Playwright dashboard |
| **M9** | Distance | Établissements à proximité (PostGIS), ticket à distance, « quand partir », confirmation de présence, recul/annulation | pgTAP sweeper, Playwright parcours distance |
| **M10** | Pub + abonnements + super admin | Espace annonceur, ciblage, modération, diffusion TV/app, stats ; plans, abonnements, MTN MoMo / Orange Money ; super admin (validation, plans, revenus, suspension) | Paiements en sandbox, Playwright campagne → modération → diffusion |
| **M11** | App Expo | Client + agent, réutilise `packages/shared` | Tests Jest/Detox de base |

**Données de démo** (script idempotent, enrichi à chaque module) : **DOUALA CLINIC** (Akwa, Douala — Consultation générale `C`, Pédiatrie `P`, Laboratoire `L`, Caisse `K` ; cabinets 1-4, labo 1, caisse 1) et **Eneo — Agence Bonanjo, Douala** (Réclamations `R`, Abonnements `A`, Paiement facture `F` ; guichets 1-5).

---

## 8. Variables d'environnement

| Variable | Module | Où la trouver |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` | M1 | ✅ présentes dans la session |
| `NEXT_PUBLIC_APP_URL` | M2 (URL encodée dans les QR) | domaine de production |
| `IP_HASH_SALT` | M3 | chaîne aléatoire que je peux générer, à stocker dans l'environnement |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | M7 | `npx web-push generate-vapid-keys` |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_FR`, `ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_MODEL_ID` | M6 | elevenlabs.io → Profile → API Keys / Voice Library |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | M7 | Meta for Developers → app → WhatsApp → API Setup / App Settings → Basic |
| `SMS_PROVIDER` + clés du fournisseur | M7 | selon le fournisseur retenu |
| `MTN_MOMO_*`, `ORANGE_MONEY_*` | M10 | momodeveloper.mtn.com ; developer.orange.com |

---

## 9. Questions ouvertes (à trancher avant / pendant M1)

1. **Maquette Claude Design** : je n'y ai pas accès depuis cette session. Merci d'exporter les écrans (PNG ou HTML) dans `design/mockups/` du dépôt, ou de m'en donner le lien de partage. Sans elle, je m'appuierai strictement sur les HIG et sur la description fournie.
2. **Hébergement web** : Vercel (recommandé, compatible Next.js/edge) ? Et le **domaine** de production (ex. `nextin.cm`) — il est encodé dans les QR imprimés.
3. **SMS de secours** : quel fournisseur (agrégateur local camerounais, Twilio, Infobip…) ? Je livre l'abstraction + un fournisseur « console » de test en attendant.
4. **Grille tarifaire** des plans et des packs publicitaires (XAF) — nécessaire en M10 seulement.
5. **Imprimante thermique** : impression navigateur 80 mm (CSS print, fonctionne avec la plupart des pilotes) par défaut ; ESC/POS via WebUSB en option si vous avez un modèle précis.
