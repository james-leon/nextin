-- M10b — Publicité : espace annonceur, formules Maison / Bronze / Argent / Or, secteurs (visa santé), ciblage,
-- modération, rotation pondérée (TV, app, jeux), quiz sponsorisé, Sky Catch, bons de réduction à QR code, statistiques
-- anonymes, paiement des campagnes par le même agrégateur que les abonnements (M10a).
-- Aucune donnée personnelle des patients : parties et bons sont liés au ticket, jamais à un nom ou un numéro.

-- ═════════════════════════════════════════════════════════════════════════════
-- Référentiels (modifiables par le super admin)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.ad_sectors (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  name_en text not null check (char_length(name_en) between 2 and 60),
  -- Santé, pharmacie : visa du ministère de la Santé obligatoire avant toute approbation (§12.4).
  requires_health_visa boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0
);
insert into public.ad_sectors (code, name, name_en, requires_health_visa, sort_order) values
  ('health', 'Santé', 'Health', true, 1),
  ('pharmacy', 'Pharmacie', 'Pharmacy', true, 2),
  ('food', 'Alimentation', 'Food', false, 3),
  ('telecom', 'Télécoms', 'Telecoms', false, 4),
  ('banking', 'Banque et assurance', 'Banking and insurance', false, 5),
  ('beauty', 'Beauté', 'Beauty', false, 6),
  ('retail', 'Commerce', 'Retail', false, 7),
  ('education', 'Éducation', 'Education', false, 8),
  ('transport', 'Transport', 'Transport', false, 9),
  ('betting', 'Paris et jeux d''argent', 'Betting', false, 10),
  ('alcohol', 'Boissons alcoolisées', 'Alcohol', false, 11),
  ('other', 'Autre', 'Other', false, 12);

create table public.ad_packages (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  name_en text not null check (char_length(name_en) between 2 and 60),
  description text check (char_length(description) <= 240),
  description_en text check (char_length(description_en) <= 240),
  -- Prix forfaitaire de la campagne (FCFA hors taxe) pour `duration_days` jours.
  price_xaf integer not null check (price_xaf >= 0),
  duration_days smallint not null check (duration_days between 1 and 365),
  -- Agences diffusant la campagne au plus (null : illimité).
  max_branches integer check (max_branches >= 1),
  -- Poids de rotation (part de diffusion) partagé entre les campagnes de la formule (§12.4).
  share_of_voice smallint not null check (share_of_voice between 0 and 100),
  surfaces public.ad_surface[] not null check (cardinality(surfaces) >= 1),
  quiz_allowed boolean not null default false,
  game_skin_allowed boolean not null default false,
  -- Maison : annonces d'un établissement pour ses propres services, gratuites, sans modération.
  house boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);
create trigger ad_packages_set_updated_at before update on public.ad_packages for each row execute function public.set_updated_at();
-- Valeurs initiales (proposition, §12.4) : prix et contenu modifiables par le super admin.
insert into public.ad_packages (code, name, name_en, description, description_en, price_xaf, duration_days, max_branches, share_of_voice,
  surfaces, quiz_allowed, game_skin_allowed, house, sort_order) values
  ('maison', 'Maison', 'House', 'Vos propres services sur vos écrans et pages, gratuitement.', 'Your own services on your screens and pages, free.',
   0, 365, null, 10, '{tv,app}', false, false, true, 0),
  ('bronze', 'Bronze', 'Bronze', 'Écrans TV des salles d''attente, jusqu''à 5 agences.', 'Waiting-room TV screens, up to 5 branches.',
   15000, 7, 5, 20, '{tv}', false, false, false, 1),
  ('argent', 'Argent', 'Silver', 'Écrans TV, application et jeux, quiz sponsorisé, jusqu''à 15 agences.', 'TV screens, app and games, sponsored quiz, up to 15 branches.',
   40000, 14, 15, 30, '{tv,app,game}', true, false, false, 2),
  ('or', 'Or', 'Gold', 'Partout, toutes les agences ciblées, quiz et habillage de Sky Catch.', 'Everywhere, all targeted branches, quiz and Sky Catch skin.',
   90000, 30, null, 50, '{tv,app,game}', true, true, false, 3);

-- Pubs interstitielles des jeux (§12.7).
alter table public.platform_settings
  add column interstitial_skip_after_seconds smallint not null default 5 check (interstitial_skip_after_seconds between 0 and 15),
  add column interstitial_min_gap_seconds smallint not null default 60 check (interstitial_min_gap_seconds between 0 and 600);

-- ═════════════════════════════════════════════════════════════════════════════
-- Annonceurs et campagnes
-- ═════════════════════════════════════════════════════════════════════════════

create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  sector text not null references public.ad_sectors (code),
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  city text check (char_length(city) <= 80),
  address text check (char_length(address) <= 240),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger advertisers_set_updated_at before update on public.advertisers for each row execute function public.set_updated_at();

create table public.advertiser_members (
  advertiser_id uuid not null references public.advertisers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (advertiser_id, user_id)
);
create index advertiser_members_user_idx on public.advertiser_members (user_id);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  -- Campagne d'un annonceur, ou annonce « Maison » d'un établissement (un seul des deux).
  advertiser_id uuid references public.advertisers (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  sector text not null references public.ad_sectors (code),
  package_code text not null references public.ad_packages (code),
  status public.campaign_status not null default 'draft',
  starts_on date not null,
  ends_on date not null,
  -- Ciblage : villes des agences (vide : tout le pays) et types d'établissement (vide : tous).
  target_cities text[] not null default '{}',
  target_org_types public.org_type[] not null default '{}',
  surfaces public.ad_surface[] not null check (cardinality(surfaces) >= 1),
  price_xaf integer not null default 0 check (price_xaf >= 0),
  health_visa_number text check (char_length(health_visa_number) <= 60),
  -- Justificatif dans le bucket privé `ad-documents` (<annonceur>/<campagne>/…).
  health_visa_document_path text check (char_length(health_visa_document_path) <= 300),
  moderation_note text check (char_length(moderation_note) <= 500),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((advertiser_id is null) <> (organization_id is null)),
  check (ends_on >= starts_on)
);
create index ad_campaigns_status_idx on public.ad_campaigns (status, starts_on, ends_on);
create index ad_campaigns_advertiser_idx on public.ad_campaigns (advertiser_id, created_at desc);
create index ad_campaigns_org_idx on public.ad_campaigns (organization_id) where organization_id is not null;
create trigger ad_campaigns_set_updated_at before update on public.ad_campaigns for each row execute function public.set_updated_at();

create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  kind public.ad_creative_kind not null default 'image',
  -- Bucket public `ad-creatives` (<annonceur ou org-<établissement>>/<campagne>/…).
  storage_path text not null check (char_length(storage_path) <= 300),
  headline text not null check (char_length(headline) between 2 and 80),
  offer_text text check (char_length(offer_text) <= 140),
  cta_url text check (cta_url ~ '^https://' and char_length(cta_url) <= 300),
  duration_seconds smallint not null default 8 check (duration_seconds between 5 and 15),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index ad_creatives_campaign_idx on public.ad_creatives (campaign_id, sort_order);

-- Plages de diffusion (heure de l'agence) ; aucune ligne : toute la journée.
create table public.ad_schedules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index ad_schedules_campaign_idx on public.ad_schedules (campaign_id);

-- Ciblage matérialisé à l'approbation (agences diffusant la campagne).
create table public.ad_campaign_branches (
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  primary key (campaign_id, branch_id)
);
create index ad_campaign_branches_branch_idx on public.ad_campaign_branches (branch_id);

-- Réglages publicitaires d'un établissement (§12.4, §12.5, §12.7).
create table public.organization_ad_preferences (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  blocked_sectors text[] not null default '{}',
  quiz_enabled boolean not null default true,
  sky_catch_enabled boolean not null default true,
  house_ads_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger organization_ad_preferences_set_updated_at before update on public.organization_ad_preferences
  for each row execute function public.set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- Quiz, Sky Catch, bons de réduction
-- ═════════════════════════════════════════════════════════════════════════════

create table public.ad_quizzes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.ad_campaigns (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  title_en text check (char_length(title_en) <= 80),
  reward_text text not null check (char_length(reward_text) between 2 and 120),
  reward_text_en text check (char_length(reward_text_en) <= 120),
  coupon_validity_days smallint not null default 30 check (coupon_validity_days between 1 and 365),
  max_coupons integer check (max_coupons >= 1),
  -- Suit la campagne : approuvé avec elle.
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected'))
);

create table public.ad_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.ad_quizzes (id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  question text not null check (char_length(question) between 3 and 160),
  question_en text check (char_length(question_en) <= 160),
  -- [{ "text": "...", "text_en": "...", "correct": true }] : 2 à 4 réponses, une seule correcte.
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) between 2 and 4),
  unique (quiz_id, position)
);

create table public.ad_game_skins (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.ad_campaigns (id) on delete cascade,
  plane_primary text not null check (plane_primary ~ '^#[0-9A-Fa-f]{6}$'),
  plane_secondary text not null check (plane_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  -- Petit logo (≤ 20 Ko) dans le bucket public `ad-creatives`, dessiné sur les pièces.
  coin_logo_path text check (char_length(coin_logo_path) <= 300),
  end_title text not null check (char_length(end_title) between 2 and 80),
  end_title_en text check (char_length(end_title_en) <= 80),
  reward_text text not null check (char_length(reward_text) between 2 and 120),
  reward_text_en text check (char_length(reward_text_en) <= 120),
  coupon_validity_days smallint not null default 30 check (coupon_validity_days between 1 and 365),
  max_coupons integer check (max_coupons >= 1),
  -- Niveaux à réussir pour gagner le bon.
  min_levels smallint not null default 2 check (min_levels between 1 and 10),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected'))
);

create table public.ad_quiz_plays (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.ad_quizzes (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  -- Aucune donnée personnelle : seulement le ticket (effacé avec lui).
  ticket_id uuid references public.tickets (id) on delete set null,
  score smallint,
  total smallint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (quiz_id, ticket_id)
);
create index ad_quiz_plays_campaign_idx on public.ad_quiz_plays (campaign_id, started_at);

create table public.ad_game_plays (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'sky_catch' check (game in ('sky_catch')),
  skin_id uuid references public.ad_game_skins (id) on delete set null,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete set null,
  levels_completed smallint not null default 0 check (levels_completed between 0 and 100),
  score integer not null default 0 check (score between 0 and 10000000),
  interstitials_shown smallint not null default 0 check (interstitials_shown between 0 and 200),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ad_game_plays_ticket_idx on public.ad_game_plays (ticket_id);
create index ad_game_plays_campaign_idx on public.ad_game_plays (campaign_id, started_at);

create table public.ad_coupons (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  quiz_play_id uuid references public.ad_quiz_plays (id) on delete set null,
  game_play_id uuid references public.ad_game_plays (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  -- Code court lisible (8 caractères, sans 0/O/1/I) et jeton du QR code.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  qr_token text not null unique check (qr_token ~ '^[A-Za-z0-9]{22}$'),
  reward_text text not null,
  reward_text_en text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  -- Un seul bon par ticket et par campagne (§12.7).
  unique (campaign_id, ticket_id)
);
create index ad_coupons_campaign_idx on public.ad_coupons (campaign_id, issued_at);

-- ═════════════════════════════════════════════════════════════════════════════
-- Événements et statistiques (anonymes)
-- ═════════════════════════════════════════════════════════════════════════════

-- Partitionnée par mois ; `client_event_id` rend l'envoi par lots idempotent (rejeu hors ligne).
create table public.ad_events (
  id bigint generated always as identity,
  client_event_id uuid not null,
  campaign_id uuid not null,
  creative_id uuid,
  branch_id uuid,
  display_id uuid,
  surface public.ad_surface not null,
  type public.ad_event_type not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (id, occurred_at),
  unique (client_event_id, occurred_at)
) partition by range (occurred_at);
create table public.ad_events_default partition of public.ad_events default;
create index ad_events_campaign_idx on public.ad_events (campaign_id, occurred_at);

/** Partitions mensuelles du mois courant et des deux suivants (tâche mensuelle, idempotente). */
create or replace function public.ensure_ad_event_partitions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_from date;
  v_name text;
begin
  for i in 0..2 loop
    v_from := (v_month + make_interval(months => i))::date;
    v_name := 'ad_events_' || to_char(v_from, 'YYYYMM');
    if to_regclass('public.' || v_name) is null then
      execute format('create table public.%I partition of public.ad_events for values from (%L) to (%L)',
        v_name, v_from, (v_from + interval '1 month')::date);
      execute format('alter table public.%I enable row level security', v_name);
    end if;
  end loop;
end;
$$;
select public.ensure_ad_event_partitions();
select cron.schedule('nextin-ad-partitions', '0 3 1 * *', $$select public.ensure_ad_event_partitions()$$);

create table public.ad_daily_stats (
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  day date not null,
  branch_id uuid not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  skips integer not null default 0,
  visits integer not null default 0,
  quiz_plays integer not null default 0,
  game_plays integer not null default 0,
  interstitial_impressions integer not null default 0,
  interstitial_skips integer not null default 0,
  coupons_issued integer not null default 0,
  coupons_redeemed integer not null default 0,
  primary key (campaign_id, day, branch_id)
);

-- ═════════════════════════════════════════════════════════════════════════════
-- Droits
-- ═════════════════════════════════════════════════════════════════════════════

/** Membre (non anonyme) d'un annonceur, avec l'un des rôles (null : n'importe lequel). */
create or replace function public.is_advertiser_member(p_advertiser uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_anonymous() and exists (
    select 1 from public.advertiser_members m
    where m.advertiser_id = p_advertiser and m.user_id = (select auth.uid()) and (p_roles is null or m.role = any (p_roles))
  );
$$;

/** Lecture d'une campagne : membres de l'annonceur, administrateurs de l'établissement (Maison), super admin. */
create or replace function public.can_view_campaign(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ad_campaigns c
    where c.id = p_campaign and (
      (c.advertiser_id is not null and public.is_advertiser_member(c.advertiser_id))
      or (c.organization_id is not null and not public.is_anonymous()
          and public.has_org_role(c.organization_id, array['org_admin']::public.member_role[]))
      or public.is_platform_admin())
  );
$$;

/** Modification d'une campagne (verrouillée) : propriétaires et éditeurs de l'annonceur, ou administrateurs (Maison). */
create or replace function public.lock_campaign_for_edit(p_campaign uuid)
returns public.ad_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
begin
  select * into v_c from public.ad_campaigns where id = p_campaign for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not ((v_c.advertiser_id is not null and public.is_advertiser_member(v_c.advertiser_id))
          or (v_c.organization_id is not null and not public.is_anonymous()
              and public.has_org_role(v_c.organization_id, array['org_admin']::public.member_role[]))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Campagne d'annonceur : modifiable seulement en brouillon ou après un refus (la version approuvée ne change pas).
  if v_c.advertiser_id is not null and v_c.status not in ('draft', 'rejected') then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  return v_c;
end;
$$;

/** Date du jour à Douala. */
create or replace function public.douala_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Douala')::date;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Espace annonceur
-- ═════════════════════════════════════════════════════════════════════════════

/** Ouverture d'un compte annonceur : l'utilisateur connecté en devient propriétaire. */
create or replace function public.create_advertiser(p_name text, p_sector text, p_phone text, p_city text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null or public.is_anonymous() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not public.check_rate_limit('advertiser:uid:' || (select auth.uid()), 3, interval '1 day') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  if not exists (select 1 from public.ad_sectors where code = p_sector and active) then raise exception 'not_found' using errcode = 'P0404'; end if;
  if p_phone is not null and p_phone !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  insert into public.advertisers (name, sector, phone_e164, city, created_by)
  values (trim(p_name), p_sector, p_phone, nullif(trim(p_city), ''), (select auth.uid()))
  returning id into v_id;
  insert into public.advertiser_members (advertiser_id, user_id, role) values (v_id, (select auth.uid()), 'owner');
  perform public.audit(null, 'advertiser.create', 'advertiser', v_id, jsonb_build_object('name', p_name, 'sector', p_sector));
  return v_id;
end;
$$;

/**
 * Création ou modification d'une campagne (brouillon) : formule, secteur, dates (la fin suit la durée de la formule),
 * ciblage, surfaces (comprises dans la formule), visa santé, plages horaires. Annonce « Maison » : `p_organization`
 * (administrateur de l'établissement) et formule Maison uniquement. Renvoie l'identifiant.
 */
create or replace function public.save_campaign(p_campaign uuid, p_advertiser uuid, p_organization uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
  v_pkg public.ad_packages;
  v_starts date := (p_fields ->> 'starts_on')::date;
  v_surfaces public.ad_surface[] := array(select jsonb_array_elements_text(coalesce(p_fields -> 'surfaces', '[]'::jsonb)))::public.ad_surface[];
  v_cities text[] := array(select trim(x) from jsonb_array_elements_text(coalesce(p_fields -> 'target_cities', '[]'::jsonb)) x where trim(x) <> '');
  v_types public.org_type[] := array(select jsonb_array_elements_text(coalesce(p_fields -> 'target_org_types', '[]'::jsonb)))::public.org_type[];
  v_id uuid;
  v_s jsonb;
begin
  if p_campaign is null then
    if (p_advertiser is null) = (p_organization is null) then raise exception 'invalid_state' using errcode = 'P0409'; end if;
    if p_advertiser is not null and not public.is_advertiser_member(p_advertiser) then raise exception 'not_allowed' using errcode = '42501'; end if;
    if p_organization is not null and (public.is_anonymous()
       or not public.has_org_role(p_organization, array['org_admin']::public.member_role[])) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  else
    v_c := public.lock_campaign_for_edit(p_campaign);
  end if;

  select * into v_pkg from public.ad_packages where code = p_fields ->> 'package_code' and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_pkg.house <> (coalesce(v_c.organization_id, p_organization) is not null) then
    raise exception 'invalid_state' using errcode = 'P0409', detail = 'package';
  end if;
  if not exists (select 1 from public.ad_sectors where code = p_fields ->> 'sector' and active) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if v_starts is null or (v_starts < public.douala_today() and coalesce(v_c.starts_on, v_starts) <> v_starts) then
    raise exception 'invalid_state' using errcode = 'P0409', detail = 'starts_on';
  end if;
  if v_starts < public.douala_today() and p_campaign is null then
    raise exception 'invalid_state' using errcode = 'P0409', detail = 'starts_on';
  end if;
  if cardinality(v_surfaces) = 0 or not (v_surfaces <@ v_pkg.surfaces) then
    raise exception 'surface_not_in_package' using errcode = 'P0422';
  end if;

  if p_campaign is null then
    insert into public.ad_campaigns (advertiser_id, organization_id, name, sector, package_code, starts_on, ends_on, target_cities,
      target_org_types, surfaces, health_visa_number, health_visa_document_path, created_by)
    values (p_advertiser, p_organization, trim(p_fields ->> 'name'), p_fields ->> 'sector', v_pkg.code, v_starts,
      v_starts + v_pkg.duration_days - 1, v_cities, v_types, v_surfaces, nullif(trim(p_fields ->> 'health_visa_number'), ''),
      nullif(p_fields ->> 'health_visa_document_path', ''), (select auth.uid()))
    returning id into v_id;
  else
    update public.ad_campaigns set
      name = trim(p_fields ->> 'name'), sector = p_fields ->> 'sector', package_code = v_pkg.code,
      starts_on = v_starts, ends_on = v_starts + v_pkg.duration_days - 1,
      target_cities = v_cities, target_org_types = v_types, surfaces = v_surfaces,
      health_visa_number = nullif(trim(p_fields ->> 'health_visa_number'), ''),
      health_visa_document_path = coalesce(nullif(p_fields ->> 'health_visa_document_path', ''), health_visa_document_path),
      -- Une campagne refusée redevient un brouillon dès qu'elle est modifiée.
      status = case when status = 'rejected' then 'draft' else status end
    where id = p_campaign returning id into v_id;
  end if;

  delete from public.ad_schedules where campaign_id = v_id;
  for v_s in select * from jsonb_array_elements(coalesce(p_fields -> 'schedules', '[]'::jsonb)) loop
    insert into public.ad_schedules (campaign_id, weekday, start_time, end_time)
    values (v_id, (v_s ->> 'weekday')::smallint, (v_s ->> 'start_time')::time, (v_s ->> 'end_time')::time);
  end loop;
  -- Annonce Maison déjà diffusée : ciblage mis à jour aussitôt (pas de modération).
  if v_pkg.house and exists (select 1 from public.ad_campaigns where id = v_id and status = 'active') then
    perform public.target_campaign_branches(v_id);
  end if;
  return v_id;
end;
$$;

/** Visuel d'une campagne (création ou modification). `p_fields` : storage_path, kind, headline, offer_text, cta_url, duration_seconds. */
create or replace function public.save_creative(p_campaign uuid, p_creative uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns := public.lock_campaign_for_edit(p_campaign);
  v_prefix text := coalesce(v_c.advertiser_id::text, 'org-' || v_c.organization_id);
  v_id uuid;
begin
  -- Le fichier doit être dans le dossier de l'annonceur (ou de l'établissement) et de la campagne.
  if coalesce(p_fields ->> 'storage_path', '') not like v_prefix || '/' || v_c.id || '/%' then
    raise exception 'not_allowed' using errcode = '42501', detail = 'storage_path';
  end if;
  -- Pages client légères (3G) : image de 250 Ko au plus (les vidéos ne vont que sur les écrans TV).
  if coalesce(p_fields ->> 'kind', 'image') = 'image' and public.ad_file_size(p_fields ->> 'storage_path') > 256000 then
    raise exception 'file_too_large' using errcode = 'P0422';
  end if;
  if (select count(*) from public.ad_creatives where campaign_id = v_c.id) >= 5 and p_creative is null then
    raise exception 'invalid_state' using errcode = 'P0409', detail = 'creatives';
  end if;
  if p_creative is null then
    insert into public.ad_creatives (campaign_id, kind, storage_path, headline, offer_text, cta_url, duration_seconds, sort_order)
    values (v_c.id, coalesce(p_fields ->> 'kind', 'image')::public.ad_creative_kind, p_fields ->> 'storage_path', trim(p_fields ->> 'headline'),
      nullif(trim(p_fields ->> 'offer_text'), ''), nullif(trim(p_fields ->> 'cta_url'), ''),
      coalesce((p_fields ->> 'duration_seconds')::smallint, 8),
      (select coalesce(max(sort_order), 0) + 1 from public.ad_creatives where campaign_id = v_c.id))
    returning id into v_id;
  else
    update public.ad_creatives set
      kind = coalesce(p_fields ->> 'kind', kind::text)::public.ad_creative_kind, storage_path = p_fields ->> 'storage_path',
      headline = trim(p_fields ->> 'headline'), offer_text = nullif(trim(p_fields ->> 'offer_text'), ''),
      cta_url = nullif(trim(p_fields ->> 'cta_url'), ''), duration_seconds = coalesce((p_fields ->> 'duration_seconds')::smallint, duration_seconds)
    where id = p_creative and campaign_id = v_c.id returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_creative(p_creative uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign uuid;
begin
  select campaign_id into v_campaign from public.ad_creatives where id = p_creative;
  if v_campaign is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.lock_campaign_for_edit(v_campaign);
  delete from public.ad_creatives where id = p_creative;
end;
$$;

/**
 * Quiz sponsorisé d'une campagne (formule `quiz_allowed`) : 3 à 5 questions, 2 à 4 réponses, une seule correcte.
 * `p_fields` : title, title_en, reward_text, reward_text_en, coupon_validity_days, max_coupons, questions[].
 */
create or replace function public.save_quiz(p_campaign uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns := public.lock_campaign_for_edit(p_campaign);
  v_id uuid;
  v_q jsonb;
  v_pos smallint := 0;
begin
  if not (select quiz_allowed from public.ad_packages where code = v_c.package_code) then
    raise exception 'feature_unavailable' using errcode = 'P0403', detail = 'quiz';
  end if;
  if jsonb_array_length(coalesce(p_fields -> 'questions', '[]'::jsonb)) not between 3 and 5 then
    raise exception 'quiz_invalid' using errcode = 'P0422';
  end if;
  for v_q in select * from jsonb_array_elements(p_fields -> 'questions') loop
    if jsonb_typeof(v_q -> 'answers') <> 'array' or jsonb_array_length(v_q -> 'answers') not between 2 and 4
       or (select count(*) from jsonb_array_elements(v_q -> 'answers') a where (a ->> 'correct')::boolean) <> 1
       or exists (select 1 from jsonb_array_elements(v_q -> 'answers') a where char_length(trim(coalesce(a ->> 'text', ''))) not between 1 and 80) then
      raise exception 'quiz_invalid' using errcode = 'P0422';
    end if;
  end loop;
  insert into public.ad_quizzes (campaign_id, title, title_en, reward_text, reward_text_en, coupon_validity_days, max_coupons)
  values (v_c.id, trim(p_fields ->> 'title'), nullif(trim(p_fields ->> 'title_en'), ''), trim(p_fields ->> 'reward_text'),
    nullif(trim(p_fields ->> 'reward_text_en'), ''), coalesce((p_fields ->> 'coupon_validity_days')::smallint, 30), (p_fields ->> 'max_coupons')::integer)
  on conflict (campaign_id) do update set title = excluded.title, title_en = excluded.title_en, reward_text = excluded.reward_text,
    reward_text_en = excluded.reward_text_en, coupon_validity_days = excluded.coupon_validity_days, max_coupons = excluded.max_coupons,
    status = 'draft'
  returning id into v_id;
  delete from public.ad_quiz_questions where quiz_id = v_id;
  for v_q in select * from jsonb_array_elements(p_fields -> 'questions') loop
    v_pos := v_pos + 1;
    insert into public.ad_quiz_questions (quiz_id, position, question, question_en, answers)
    values (v_id, v_pos, trim(v_q ->> 'question'), nullif(trim(v_q ->> 'question_en'), ''),
      (select jsonb_agg(jsonb_build_object('text', trim(a ->> 'text'), 'text_en', nullif(trim(a ->> 'text_en'), ''),
         'correct', coalesce((a ->> 'correct')::boolean, false))) from jsonb_array_elements(v_q -> 'answers') a));
  end loop;
  return v_id;
end;
$$;

create or replace function public.delete_quiz(p_campaign uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_campaign_for_edit(p_campaign);
  delete from public.ad_quizzes where campaign_id = p_campaign;
end;
$$;

/** Habillage de Sky Catch (formule `game_skin_allowed`, Or par défaut). */
create or replace function public.save_game_skin(p_campaign uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns := public.lock_campaign_for_edit(p_campaign);
  v_prefix text := coalesce(v_c.advertiser_id::text, 'org-' || v_c.organization_id);
  v_id uuid;
begin
  if not (select game_skin_allowed from public.ad_packages where code = v_c.package_code) then
    raise exception 'feature_unavailable' using errcode = 'P0403', detail = 'game_skin';
  end if;
  if nullif(p_fields ->> 'coin_logo_path', '') is not null and p_fields ->> 'coin_logo_path' not like v_prefix || '/' || v_c.id || '/%' then
    raise exception 'not_allowed' using errcode = '42501', detail = 'storage_path';
  end if;
  if public.ad_file_size(nullif(p_fields ->> 'coin_logo_path', '')) > 20480 then raise exception 'file_too_large' using errcode = 'P0422'; end if;
  insert into public.ad_game_skins (campaign_id, plane_primary, plane_secondary, coin_logo_path, end_title, end_title_en, reward_text,
    reward_text_en, coupon_validity_days, max_coupons, min_levels)
  values (v_c.id, p_fields ->> 'plane_primary', p_fields ->> 'plane_secondary', nullif(p_fields ->> 'coin_logo_path', ''),
    trim(p_fields ->> 'end_title'), nullif(trim(p_fields ->> 'end_title_en'), ''), trim(p_fields ->> 'reward_text'),
    nullif(trim(p_fields ->> 'reward_text_en'), ''), coalesce((p_fields ->> 'coupon_validity_days')::smallint, 30),
    (p_fields ->> 'max_coupons')::integer, coalesce((p_fields ->> 'min_levels')::smallint, 2))
  on conflict (campaign_id) do update set plane_primary = excluded.plane_primary, plane_secondary = excluded.plane_secondary,
    coin_logo_path = coalesce(excluded.coin_logo_path, public.ad_game_skins.coin_logo_path), end_title = excluded.end_title,
    end_title_en = excluded.end_title_en, reward_text = excluded.reward_text, reward_text_en = excluded.reward_text_en,
    coupon_validity_days = excluded.coupon_validity_days, max_coupons = excluded.max_coupons, min_levels = excluded.min_levels,
    status = 'draft'
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_game_skin(p_campaign uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_campaign_for_edit(p_campaign);
  delete from public.ad_game_skins where campaign_id = p_campaign;
end;
$$;

/**
 * Ciblage matérialisé : agences actives des établissements actifs, dans les villes et types visés, hors
 * établissements qui bloquent le secteur, dans la limite d'agences de la formule. Maison : agences de l'établissement.
 */
create or replace function public.target_campaign_branches(p_campaign uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
  v_max integer;
  v_n integer;
begin
  select * into v_c from public.ad_campaigns where id = p_campaign;
  select max_branches into v_max from public.ad_packages where code = v_c.package_code;
  delete from public.ad_campaign_branches where campaign_id = p_campaign;
  insert into public.ad_campaign_branches (campaign_id, branch_id)
  select p_campaign, b.id
  from public.branches b
  join public.organizations o on o.id = b.organization_id
  left join public.organization_ad_preferences p on p.organization_id = o.id
  where b.active and o.status = 'active'
    and (case when v_c.organization_id is not null then o.id = v_c.organization_id
         else (cardinality(v_c.target_cities) = 0 or lower(b.city) = any (array(select lower(x) from unnest(v_c.target_cities) x)))
          and (cardinality(v_c.target_org_types) = 0 or o.type = any (v_c.target_org_types))
          and not (v_c.sector = any (coalesce(p.blocked_sectors, '{}'))) end)
  order by b.created_at
  limit v_max;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

/**
 * Soumission à la modération : au moins un visuel, visa santé si le secteur l'exige, quiz complet. Prix figé (formule).
 * Annonce Maison : diffusée tout de suite (contenu de l'établissement lui-même).
 */
create or replace function public.submit_campaign(p_campaign uuid)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns := public.lock_campaign_for_edit(p_campaign);
  v_pkg public.ad_packages;
begin
  select * into v_pkg from public.ad_packages where code = v_c.package_code;
  if not exists (select 1 from public.ad_creatives where campaign_id = v_c.id) then
    raise exception 'creative_required' using errcode = 'P0422';
  end if;
  if exists (select 1 from public.ad_creatives where campaign_id = v_c.id and kind = 'video')
     and not exists (select 1 from public.ad_creatives where campaign_id = v_c.id and kind = 'image')
     and v_c.surfaces && array['app', 'game']::public.ad_surface[] then
    -- Application et jeux : images seulement (pages légères en 3G).
    raise exception 'creative_required' using errcode = 'P0422', detail = 'image';
  end if;
  -- Annonce Maison exemptée : information de l'établissement à ses propres patients, sur ses propres écrans.
  if not v_pkg.house and (select requires_health_visa from public.ad_sectors where code = v_c.sector)
     and (v_c.health_visa_number is null or v_c.health_visa_document_path is null) then
    raise exception 'health_visa_required' using errcode = 'P0422';
  end if;
  if exists (select 1 from public.ad_quizzes q where q.campaign_id = v_c.id
             and (select count(*) from public.ad_quiz_questions where quiz_id = q.id) not between 3 and 5) then
    raise exception 'quiz_invalid' using errcode = 'P0422';
  end if;
  if v_c.ends_on < public.douala_today() then raise exception 'invalid_state' using errcode = 'P0409', detail = 'ends_on'; end if;

  if v_pkg.house then
    update public.ad_campaigns set status = 'active', submitted_at = now(), price_xaf = 0 where id = v_c.id;
    perform public.target_campaign_branches(v_c.id);
    return 'active';
  end if;
  update public.ad_campaigns set status = 'pending_review', submitted_at = now(), price_xaf = v_pkg.price_xaf, moderation_note = null
  where id = v_c.id;
  update public.ad_quizzes set status = 'pending_review' where campaign_id = v_c.id;
  update public.ad_game_skins set status = 'pending_review' where campaign_id = v_c.id;
  perform public.audit(null, 'campaign.submit', 'ad_campaign', v_c.id, jsonb_build_object('package', v_c.package_code));
  return 'pending_review';
end;
$$;

/**
 * Modération (super admin) : approuvée → à payer (ou active si gratuite), ciblage matérialisé ; refusée → motif
 * obligatoire. Secteur santé ou pharmacie : approbation impossible sans numéro de visa et justificatif (§12.4).
 */
create or replace function public.review_campaign(p_campaign uuid, p_approve boolean, p_note text)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
  v_status public.campaign_status;
begin
  perform public.assert_platform_admin();
  select * into v_c from public.ad_campaigns where id = p_campaign for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_c.status <> 'pending_review' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  if p_approve then
    if (select requires_health_visa from public.ad_sectors where code = v_c.sector)
       and (v_c.health_visa_number is null or v_c.health_visa_document_path is null) then
      raise exception 'health_visa_required' using errcode = 'P0422';
    end if;
    v_status := case when v_c.price_xaf > 0 then 'awaiting_payment' else 'active' end;
    update public.ad_campaigns set status = v_status, reviewed_by = (select auth.uid()), reviewed_at = now(),
      moderation_note = nullif(trim(p_note), ''), paid_at = case when v_status = 'active' then now() end
    where id = v_c.id;
    update public.ad_quizzes set status = 'approved' where campaign_id = v_c.id;
    update public.ad_game_skins set status = 'approved' where campaign_id = v_c.id;
    perform public.target_campaign_branches(v_c.id);
  else
    if char_length(coalesce(trim(p_note), '')) < 3 then raise exception 'reason_required' using errcode = 'P0422'; end if;
    v_status := 'rejected';
    update public.ad_campaigns set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), moderation_note = trim(p_note)
    where id = v_c.id;
    update public.ad_quizzes set status = 'rejected' where campaign_id = v_c.id;
    update public.ad_game_skins set status = 'rejected' where campaign_id = v_c.id;
  end if;
  perform public.audit(null, case when p_approve then 'campaign.approve' else 'campaign.reject' end, 'ad_campaign', v_c.id,
    jsonb_build_object('note', p_note, 'sector', v_c.sector));
  return v_status;
end;
$$;

/** Pause ou reprise d'une campagne active (super admin, modération). */
create or replace function public.admin_set_campaign_paused(p_campaign uuid, p_paused boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  if char_length(coalesce(trim(p_reason), '')) < 3 then raise exception 'reason_required' using errcode = 'P0422'; end if;
  update public.ad_campaigns set status = case when p_paused then 'paused' else 'active' end::public.campaign_status,
    moderation_note = trim(p_reason)
  where id = p_campaign and status = case when p_paused then 'active' else 'paused' end::public.campaign_status;
  if not found then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  perform public.audit(null, case when p_paused then 'campaign.pause' else 'campaign.resume' end, 'ad_campaign', p_campaign,
    jsonb_build_object('reason', p_reason));
end;
$$;

/** Formule publicitaire (super admin) : prix, durée, agences, part de diffusion, surfaces, quiz, habillage. */
create or replace function public.admin_update_ad_package(p_code text, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  update public.ad_packages set
    name = coalesce(p_fields ->> 'name', name),
    name_en = coalesce(p_fields ->> 'name_en', name_en),
    description = coalesce(p_fields ->> 'description', description),
    price_xaf = coalesce((p_fields ->> 'price_xaf')::integer, price_xaf),
    duration_days = coalesce((p_fields ->> 'duration_days')::smallint, duration_days),
    max_branches = case when p_fields ? 'max_branches' then (p_fields ->> 'max_branches')::integer else max_branches end,
    share_of_voice = coalesce((p_fields ->> 'share_of_voice')::smallint, share_of_voice),
    surfaces = case when p_fields ? 'surfaces' then array(select jsonb_array_elements_text(p_fields -> 'surfaces'))::public.ad_surface[] else surfaces end,
    quiz_allowed = coalesce((p_fields ->> 'quiz_allowed')::boolean, quiz_allowed),
    game_skin_allowed = coalesce((p_fields ->> 'game_skin_allowed')::boolean, game_skin_allowed),
    active = coalesce((p_fields ->> 'active')::boolean, active)
  where code = p_code;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.audit(null, 'ad_package.update', 'ad_package', null, p_fields || jsonb_build_object('code', p_code));
end;
$$;

/** Secteur (super admin) : création ou modification, dont l'obligation de visa santé. */
create or replace function public.admin_upsert_ad_sector(p_code text, p_name text, p_name_en text, p_requires_visa boolean, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  insert into public.ad_sectors (code, name, name_en, requires_health_visa, active, sort_order)
  values (p_code, trim(p_name), trim(p_name_en), p_requires_visa, p_active, (select coalesce(max(sort_order), 0) + 1 from public.ad_sectors))
  on conflict (code) do update set name = excluded.name, name_en = excluded.name_en,
    requires_health_visa = excluded.requires_health_visa, active = excluded.active;
  perform public.audit(null, 'ad_sector.upsert', 'ad_sector', null,
    jsonb_build_object('code', p_code, 'requires_health_visa', p_requires_visa, 'active', p_active));
end;
$$;

/**
 * Réglages publicitaires d'un établissement (administrateur) : secteurs bloqués, quiz, Sky Catch, annonces Maison.
 * Les campagnes d'un secteur nouvellement bloqué quittent aussitôt les agences de l'établissement.
 */
create or replace function public.set_ad_preferences(p_org uuid, p_blocked text[], p_quiz boolean, p_sky_catch boolean, p_house boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_org_admin(p_org);
  if exists (select 1 from unnest(coalesce(p_blocked, '{}')) s where not exists (select 1 from public.ad_sectors where code = s)) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  insert into public.organization_ad_preferences (organization_id, blocked_sectors, quiz_enabled, sky_catch_enabled, house_ads_enabled)
  values (p_org, coalesce(p_blocked, '{}'), p_quiz, p_sky_catch, p_house)
  on conflict (organization_id) do update set blocked_sectors = excluded.blocked_sectors, quiz_enabled = excluded.quiz_enabled,
    sky_catch_enabled = excluded.sky_catch_enabled, house_ads_enabled = excluded.house_ads_enabled;
  delete from public.ad_campaign_branches cb
  using public.ad_campaigns c, public.branches b
  where cb.campaign_id = c.id and cb.branch_id = b.id and b.organization_id = p_org
    and c.advertiser_id is not null and c.sector = any (coalesce(p_blocked, '{}'));
  perform public.audit(p_org, 'ad_preferences.update', 'organization', p_org,
    jsonb_build_object('blocked_sectors', p_blocked, 'quiz', p_quiz, 'sky_catch', p_sky_catch, 'house', p_house));
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Diffusion : campagnes éligibles et rotation pondérée (§12.4)
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Visuels diffusables dans une agence, sur une surface, à un instant : campagnes actives, dans leurs dates et
 * plages (heure de l'agence), ciblant l'agence, hors secteurs bloqués par l'établissement. Poids : part de diffusion
 * de la formule partagée entre ses campagnes ; les annonces Maison prennent la part laissée libre (« comblent les
 * trous »), si l'établissement les active. Application et jeux : images seulement.
 */
create or replace function public.ad_candidates(p_branch uuid, p_surface public.ad_surface, p_at timestamptz default now())
returns table (
  campaign_id uuid, creative_id uuid, kind public.ad_creative_kind, storage_path text, headline text, offer_text text, cta_url text,
  duration_seconds smallint, advertiser text, package_code text, weight numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select br.id, br.organization_id, br.timezone, (p_at at time zone br.timezone) as local
    from public.branches br join public.organizations o on o.id = br.organization_id
    where br.id = p_branch and br.active and o.status = 'active'
  ),
  prefs as (
    select coalesce(p.blocked_sectors, '{}') as blocked, coalesce(p.house_ads_enabled, true) as house_enabled
    from b left join public.organization_ad_preferences p on p.organization_id = b.organization_id
  ),
  eligible as (
    select c.id, c.package_code, pk.share_of_voice, pk.house,
      coalesce(a.name, o.name) as advertiser
    from public.ad_campaigns c
    join public.ad_packages pk on pk.code = c.package_code
    join public.ad_campaign_branches cb on cb.campaign_id = c.id and cb.branch_id = p_branch
    left join public.advertisers a on a.id = c.advertiser_id
    left join public.organizations o on o.id = c.organization_id
    cross join b cross join prefs
    where c.status = 'active'
      and b.local::date between c.starts_on and c.ends_on
      and p_surface = any (c.surfaces)
      and (a.id is null or a.status = 'active')
      and (case when pk.house then prefs.house_enabled else not (c.sector = any (prefs.blocked)) end)
      and (not exists (select 1 from public.ad_schedules s where s.campaign_id = c.id)
           or exists (select 1 from public.ad_schedules s where s.campaign_id = c.id
                      and s.weekday = extract(isodow from b.local)::smallint
                      and b.local::time >= s.start_time and b.local::time < s.end_time))
      and exists (select 1 from public.ad_creatives cr where cr.campaign_id = c.id
                  and (p_surface = 'tv' or cr.kind = 'image'))
  ),
  paid_packages as (
    select package_code, max(share_of_voice) as share, count(*) as campaigns from eligible where not house group by package_code
  ),
  weights as (
    select e.id, e.advertiser, e.package_code,
      case when e.house
        then greatest(0, 100 - coalesce((select sum(share) from paid_packages), 0))::numeric
             / (select count(*) from eligible where house)
        else e.share_of_voice::numeric / (select campaigns from paid_packages p where p.package_code = e.package_code)
      end as weight
    from eligible e
  )
  select w.id, cr.id, cr.kind, cr.storage_path, cr.headline, cr.offer_text, cr.cta_url, cr.duration_seconds, w.advertiser, w.package_code,
    round(w.weight / count(*) over (partition by w.id), 6)
  from weights w
  join public.ad_creatives cr on cr.campaign_id = w.id and (p_surface = 'tv' or cr.kind = 'image')
  where w.weight > 0;
$$;

/**
 * Tirage pondéré de `p_count` visuels parmi `p_candidates` ([{creative_id, weight}]), sans répéter le même visuel deux
 * fois de suite quand une alternative existe. Renvoie la suite des identifiants.
 */
create or replace function public.ad_weighted_draw(p_candidates jsonb, p_count integer)
returns uuid[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_out uuid[] := '{}';
  v_last uuid;
  v_total numeric;
  v_r numeric;
  v_acc numeric;
  v_c jsonb;
  v_pick uuid;
begin
  if p_candidates is null or jsonb_array_length(p_candidates) = 0 then return v_out; end if;
  for i in 1..least(greatest(p_count, 0), 200) loop
    select sum((c ->> 'weight')::numeric) into v_total from jsonb_array_elements(p_candidates) c
    where jsonb_array_length(p_candidates) = 1 or (c ->> 'creative_id')::uuid is distinct from v_last;
    v_r := random() * v_total;
    v_acc := 0;
    v_pick := null;
    for v_c in select c from jsonb_array_elements(p_candidates) c
               where jsonb_array_length(p_candidates) = 1 or (c ->> 'creative_id')::uuid is distinct from v_last loop
      v_acc := v_acc + (v_c ->> 'weight')::numeric;
      v_pick := (v_c ->> 'creative_id')::uuid;
      exit when v_r < v_acc;
    end loop;
    v_out := v_out || v_pick;
    v_last := v_pick;
  end loop;
  return v_out;
end;
$$;

/** Visuels d'une surface en JSON (pour les pages et l'écran TV). */
create or replace function public.ad_candidates_json(p_branch uuid, p_surface public.ad_surface)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'campaign_id', campaign_id, 'creative_id', creative_id, 'kind', kind, 'path', storage_path, 'headline', headline,
    'offer', offer_text, 'cta_url', cta_url, 'duration', duration_seconds, 'advertiser', advertiser, 'weight', weight)
    order by campaign_id, creative_id), '[]'::jsonb)
  from public.ad_candidates(p_branch, p_surface);
$$;

/** Ticket actif d'un jeton public (jeux, pub de l'application). */
create or replace function public.ticket_by_token(p_token text)
returns public.tickets
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.tickets
  where p_token ~ '^[A-Za-z0-9]{22}$' and public_token = p_token and status in ('waiting', 'called', 'serving');
$$;

/** Pub de l'application sous « Mon ticket » : un visuel tiré au sort pour l'agence du ticket (null s'il n'y en a pas). */
create or replace function public.app_ad(p_ticket_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_c jsonb;
  v_pick uuid[];
begin
  if v_t.id is null then return null; end if;
  v_c := public.ad_candidates_json(v_t.branch_id, 'app');
  v_pick := public.ad_weighted_draw(v_c, 1);
  if cardinality(v_pick) = 0 then return null; end if;
  return (select c from jsonb_array_elements(v_c) c where (c ->> 'creative_id')::uuid = v_pick[1]);
end;
$$;

/** Pubs de l'écran TV (service role, jeton d'appareil) : visuels pondérés, si l'écran affiche la publicité. */
create or replace function public.tv_ad_rotation(p_device_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when d.show_ads then public.ad_candidates_json(d.branch_id, 'tv') else '[]'::jsonb end
  from public.displays d
  where d.device_token_hash = public.sha256_hex(p_device_token) and d.status = 'active';
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Jeux pendant l'attente : quiz sponsorisé et Sky Catch (§12.5, §12.7)
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Ouverture de la feuille « Jouer en attendant » : jeux proposés (selon l'établissement et le contenu), habillage
 * Or tiré au sort, réglages des interstitielles et lot de pubs pondérées déjà tiré (`sequence`). Aucun nom.
 */
create or replace function public.game_session(p_ticket_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_prefs public.organization_ad_preferences;
  v_settings public.platform_settings;
  v_ads jsonb;
  v_quiz jsonb;
  v_skin jsonb;
  v_skins jsonb;
  v_pick uuid[];
begin
  if v_t.id is null then return null; end if;
  select * into v_prefs from public.organization_ad_preferences where organization_id = v_t.organization_id;
  select * into v_settings from public.platform_settings;
  v_ads := public.ad_candidates_json(v_t.branch_id, 'game');

  -- Quiz d'une campagne éligible (approuvé, au moins 3 questions, bons encore disponibles).
  if coalesce(v_prefs.quiz_enabled, true) then
    select jsonb_build_object('id', q.id, 'title', q.title, 'title_en', q.title_en, 'reward', q.reward_text, 'reward_en', q.reward_text_en,
      'advertiser', c.advertiser, 'played', exists (select 1 from public.ad_quiz_plays p where p.quiz_id = q.id and p.ticket_id = v_t.id))
    into v_quiz
    from public.ad_quizzes q
    join (select distinct campaign_id, advertiser from public.ad_candidates(v_t.branch_id, 'game')) c on c.campaign_id = q.campaign_id
    where q.status = 'approved' and (select count(*) from public.ad_quiz_questions where quiz_id = q.id) >= 3
    order by random() limit 1;
  end if;

  if coalesce(v_prefs.sky_catch_enabled, true) then
    select coalesce(jsonb_agg(jsonb_build_object('creative_id', s.id, 'weight', c.weight)), '[]'::jsonb) into v_skins
    from public.ad_game_skins s
    join (select campaign_id, sum(weight) as weight, max(advertiser) as advertiser from public.ad_candidates(v_t.branch_id, 'game') group by campaign_id) c
      on c.campaign_id = s.campaign_id
    where s.status = 'approved';
    v_pick := public.ad_weighted_draw(v_skins, 1);
    if cardinality(v_pick) > 0 then
      select jsonb_build_object('id', s.id, 'campaign_id', s.campaign_id, 'plane_primary', s.plane_primary, 'plane_secondary', s.plane_secondary,
        'coin_logo_path', s.coin_logo_path, 'end_title', s.end_title, 'end_title_en', s.end_title_en, 'reward', s.reward_text,
        'reward_en', s.reward_text_en, 'min_levels', s.min_levels,
        'advertiser', (select coalesce(a.name, o.name) from public.ad_campaigns c left join public.advertisers a on a.id = c.advertiser_id
                       left join public.organizations o on o.id = c.organization_id where c.id = s.campaign_id))
      into v_skin from public.ad_game_skins s where s.id = v_pick[1];
    end if;
  end if;

  return jsonb_build_object(
    'quiz', v_quiz,
    'sky_catch', case when coalesce(v_prefs.sky_catch_enabled, true) then jsonb_build_object('skin', v_skin) end,
    'interstitial', jsonb_build_object('skip_after', v_settings.interstitial_skip_after_seconds, 'min_gap', v_settings.interstitial_min_gap_seconds),
    'ads', v_ads,
    'sequence', to_jsonb(public.ad_weighted_draw(v_ads, 12)),
    'branch_id', v_t.branch_id
  );
end;
$$;

/** Bon de réduction (interne) : un par ticket et par campagne, dans la limite de la campagne. Null s'il n'y en a plus. */
create or replace function public.issue_coupon(
  p_campaign uuid, p_ticket uuid, p_branch uuid, p_reward text, p_reward_en text, p_validity integer, p_max integer,
  p_quiz_play uuid, p_game_play uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_coupons;
begin
  select * into v_c from public.ad_coupons where campaign_id = p_campaign and ticket_id = p_ticket;
  if found then
    return jsonb_build_object('code', v_c.code, 'qr_token', v_c.qr_token, 'reward', v_c.reward_text, 'reward_en', v_c.reward_text_en,
      'expires_at', v_c.expires_at, 'already', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('ad_coupons:' || p_campaign));
  if p_max is not null and (select count(*) from public.ad_coupons where campaign_id = p_campaign) >= p_max then return null; end if;
  insert into public.ad_coupons (campaign_id, quiz_play_id, game_play_id, ticket_id, branch_id, code, qr_token, reward_text, reward_text_en, expires_at)
  values (p_campaign, p_quiz_play, p_game_play, p_ticket, p_branch, public.random_string(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
    public.random_string(22, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'), p_reward, p_reward_en,
    ((public.douala_today() + p_validity + 1)::timestamp at time zone 'Africa/Douala'))
  returning * into v_c;
  return jsonb_build_object('code', v_c.code, 'qr_token', v_c.qr_token, 'reward', v_c.reward_text, 'reward_en', v_c.reward_text_en,
    'expires_at', v_c.expires_at, 'already', false);
end;
$$;

/** Début du quiz (une partie par ticket) : questions sans les bonnes réponses. */
create or replace function public.start_quiz(p_ticket_token text, p_quiz uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_q public.ad_quizzes;
  v_play public.ad_quiz_plays;
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  select q.* into v_q from public.ad_quizzes q
  where q.id = p_quiz and q.status = 'approved'
    and exists (select 1 from public.ad_candidates(v_t.branch_id, 'game') c where c.campaign_id = q.campaign_id)
    and coalesce((select quiz_enabled from public.organization_ad_preferences where organization_id = v_t.organization_id), true);
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  insert into public.ad_quiz_plays (quiz_id, campaign_id, branch_id, ticket_id, total)
  values (v_q.id, v_q.campaign_id, v_t.branch_id, v_t.id, (select count(*) from public.ad_quiz_questions where quiz_id = v_q.id))
  on conflict (quiz_id, ticket_id) do update set quiz_id = excluded.quiz_id
  returning * into v_play;
  return jsonb_build_object('play_id', v_play.id, 'finished', v_play.finished_at is not null, 'score', v_play.score, 'total', v_play.total,
    'questions', (select jsonb_agg(jsonb_build_object('id', qq.id, 'question', qq.question, 'question_en', qq.question_en,
                    'answers', (select jsonb_agg(jsonb_build_object('text', a ->> 'text', 'text_en', a ->> 'text_en')) from jsonb_array_elements(qq.answers) a))
                    order by qq.position) from public.ad_quiz_questions qq where qq.quiz_id = v_q.id));
end;
$$;

/** Fin du quiz : score, bonnes réponses, et bon de réduction (une fois par ticket). `p_answers` : index choisis, dans l'ordre. */
create or replace function public.finish_quiz(p_ticket_token text, p_play uuid, p_answers smallint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_play public.ad_quiz_plays;
  v_q public.ad_quizzes;
  v_correct smallint[];
  v_score smallint := 0;
  v_coupon jsonb;
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_play from public.ad_quiz_plays where id = p_play and ticket_id = v_t.id for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_q from public.ad_quizzes where id = v_play.quiz_id;
  select array_agg((select (o.ordinality - 1)::smallint from jsonb_array_elements(qq.answers) with ordinality o(a, ordinality)
                    where (o.a ->> 'correct')::boolean) order by qq.position)
  into v_correct from public.ad_quiz_questions qq where qq.quiz_id = v_q.id;
  if v_play.finished_at is null then
    for i in 1..cardinality(v_correct) loop
      if p_answers[i] is not distinct from v_correct[i] then v_score := v_score + 1; end if;
    end loop;
    update public.ad_quiz_plays set score = v_score, finished_at = now() where id = v_play.id;
  else
    v_score := v_play.score;
  end if;
  v_coupon := public.issue_coupon(v_q.campaign_id, v_t.id, v_t.branch_id, v_q.reward_text, v_q.reward_text_en, v_q.coupon_validity_days,
    v_q.max_coupons, v_play.id, null);
  return jsonb_build_object('score', v_score, 'total', cardinality(v_correct), 'correct', to_jsonb(v_correct), 'coupon', v_coupon);
end;
$$;

/** Début d'une partie de Sky Catch (habillage facultatif, s'il est diffusable dans l'agence). */
create or replace function public.start_sky_catch(p_ticket_token text, p_skin uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_skin public.ad_game_skins;
  v_id uuid;
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not coalesce((select sky_catch_enabled from public.organization_ad_preferences where organization_id = v_t.organization_id), true) then
    raise exception 'feature_unavailable' using errcode = 'P0403', detail = 'sky_catch';
  end if;
  if not public.check_rate_limit('sky_catch:' || v_t.id, 60, interval '1 hour') then raise exception 'rate_limited' using errcode = 'P0429'; end if;
  if p_skin is not null then
    select s.* into v_skin from public.ad_game_skins s
    where s.id = p_skin and s.status = 'approved'
      and exists (select 1 from public.ad_candidates(v_t.branch_id, 'game') c where c.campaign_id = s.campaign_id);
  end if;
  insert into public.ad_game_plays (skin_id, campaign_id, branch_id, ticket_id)
  values (v_skin.id, v_skin.campaign_id, v_t.branch_id, v_t.id) returning id into v_id;
  return v_id;
end;
$$;

/** Fin d'une partie : score et niveaux ; bon de réduction de l'habillage si assez de niveaux réussis (un par ticket). */
create or replace function public.finish_sky_catch(p_ticket_token text, p_play uuid, p_levels integer, p_score integer, p_interstitials integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_play public.ad_game_plays;
  v_skin public.ad_game_skins;
  v_coupon jsonb;
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_play from public.ad_game_plays where id = p_play and ticket_id = v_t.id for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_play.finished_at is null then
    update public.ad_game_plays set levels_completed = least(greatest(coalesce(p_levels, 0), 0), 100),
      score = least(greatest(coalesce(p_score, 0), 0), 10000000), interstitials_shown = least(greatest(coalesce(p_interstitials, 0), 0), 200),
      finished_at = now()
    where id = v_play.id returning * into v_play;
  end if;
  select * into v_skin from public.ad_game_skins where id = v_play.skin_id and status = 'approved';
  if v_skin.id is not null and v_play.levels_completed >= v_skin.min_levels then
    v_coupon := public.issue_coupon(v_skin.campaign_id, v_t.id, v_t.branch_id, v_skin.reward_text, v_skin.reward_text_en,
      v_skin.coupon_validity_days, v_skin.max_coupons, null, v_play.id);
  end if;
  return jsonb_build_object('levels', v_play.levels_completed, 'score', v_play.score, 'coupon', v_coupon);
end;
$$;

/** Bon présenté par le client (`/coupon/<jeton>`) : offre, code, validité ; jamais de donnée personnelle. */
create or replace function public.coupon_view(p_qr_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('code', k.code, 'reward', k.reward_text, 'reward_en', k.reward_text_en, 'expires_at', k.expires_at,
    'redeemed_at', k.redeemed_at, 'advertiser', coalesce(a.name, o.name), 'campaign_id', c.id)
  from public.ad_coupons k
  join public.ad_campaigns c on c.id = k.campaign_id
  left join public.advertisers a on a.id = c.advertiser_id
  left join public.organizations o on o.id = c.organization_id
  where p_qr_token ~ '^[A-Za-z0-9]{22}$' and k.qr_token = p_qr_token;
$$;

/**
 * Validation d'un bon en caisse par le commerçant (membre de l'annonceur, ou administrateur pour une annonce Maison),
 * par le QR code ou le code court. `p_confirm = false` : consultation avant validation.
 */
create or replace function public.redeem_coupon(p_code text, p_confirm boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.ad_coupons;
  v_c public.ad_campaigns;
begin
  select * into v_k from public.ad_coupons
  where (char_length(p_code) = 22 and qr_token = p_code) or (char_length(p_code) = 8 and code = upper(p_code))
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_c from public.ad_campaigns where id = v_k.campaign_id;
  if not ((v_c.advertiser_id is not null and public.is_advertiser_member(v_c.advertiser_id))
          or (v_c.organization_id is not null and not public.is_anonymous()
              and public.has_org_role(v_c.organization_id, array['org_admin', 'branch_manager', 'receptionist']::public.member_role[]))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_confirm then
    if v_k.redeemed_at is not null then raise exception 'coupon_redeemed' using errcode = 'P0409'; end if;
    if v_k.expires_at < now() then raise exception 'coupon_expired' using errcode = 'P0410'; end if;
    update public.ad_coupons set redeemed_at = now(), redeemed_by = (select auth.uid()) where id = v_k.id returning * into v_k;
  end if;
  return jsonb_build_object('code', v_k.code, 'reward', v_k.reward_text, 'reward_en', v_k.reward_text_en, 'expires_at', v_k.expires_at,
    'redeemed_at', v_k.redeemed_at, 'campaign', v_c.name, 'expired', v_k.expires_at < now());
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Événements (lots idempotents) et statistiques
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Lot d'événements (serveur : `POST /api/ads/events`, après contrôle du ticket ou de l'écran) : seuls les visuels des
 * campagnes ciblant l'agence sont retenus ; rejouer un lot ne compte rien deux fois. Renvoie le nombre retenu.
 */
create or replace function public.record_ad_events(p_branch uuid, p_display uuid, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  insert into public.ad_events (client_event_id, campaign_id, creative_id, branch_id, display_id, surface, type, occurred_at)
  select (e ->> 'id')::uuid, cr.campaign_id, cr.id, p_branch, p_display, (e ->> 'surface')::public.ad_surface, (e ->> 'type')::public.ad_event_type,
    -- Heure du client, bornée : jamais dans le futur, au plus 7 jours en arrière (file hors ligne).
    least(now(), greatest(now() - interval '7 days', (e ->> 'at')::timestamptz))
  from jsonb_array_elements(p_events) e
  join public.ad_creatives cr on cr.id = (e ->> 'creative_id')::uuid
  join public.ad_campaign_branches cb on cb.campaign_id = cr.campaign_id and cb.branch_id = p_branch
  where (e ->> 'id') ~ '^[0-9a-f-]{36}$'
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

/** Cumuls quotidiens (tâche horaire, idempotente) : les `p_days` derniers jours sont recalculés en entier. */
create or replace function public.rollup_ad_stats(p_days integer default 2)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date := public.douala_today() - greatest(p_days, 1) + 1;
  v_n integer;
begin
  delete from public.ad_daily_stats where day >= v_from;
  insert into public.ad_daily_stats (campaign_id, day, branch_id, impressions, clicks, skips, visits, quiz_plays, game_plays,
    interstitial_impressions, interstitial_skips, coupons_issued, coupons_redeemed)
  select campaign_id, day, branch_id, sum(impressions), sum(clicks), sum(skips), sum(visits), sum(quiz_plays), sum(game_plays),
    sum(interstitial_impressions), sum(interstitial_skips), sum(coupons_issued), sum(coupons_redeemed)
  from (
    select e.campaign_id, (e.occurred_at at time zone 'Africa/Douala')::date as day, coalesce(e.branch_id, '00000000-0000-0000-0000-000000000000') as branch_id,
      count(*) filter (where e.type = 'impression' and e.surface <> 'game') as impressions,
      count(*) filter (where e.type = 'click') as clicks,
      count(*) filter (where e.type = 'skip' and e.surface <> 'game') as skips,
      count(*) filter (where e.type = 'visit') as visits,
      0 as quiz_plays, 0 as game_plays,
      count(*) filter (where e.type = 'impression' and e.surface = 'game') as interstitial_impressions,
      count(*) filter (where e.type = 'skip' and e.surface = 'game') as interstitial_skips,
      0 as coupons_issued, 0 as coupons_redeemed
    from public.ad_events e where e.occurred_at >= (v_from::timestamp at time zone 'Africa/Douala')
    group by 1, 2, 3
    union all
    select p.campaign_id, (p.started_at at time zone 'Africa/Douala')::date, coalesce(p.branch_id, '00000000-0000-0000-0000-000000000000'),
      0, 0, 0, 0, count(*), 0, 0, 0, 0, 0
    from public.ad_quiz_plays p where p.started_at >= (v_from::timestamp at time zone 'Africa/Douala') group by 1, 2, 3
    union all
    select p.campaign_id, (p.started_at at time zone 'Africa/Douala')::date, coalesce(p.branch_id, '00000000-0000-0000-0000-000000000000'),
      0, 0, 0, 0, 0, count(*), 0, 0, 0, 0
    from public.ad_game_plays p where p.campaign_id is not null and p.started_at >= (v_from::timestamp at time zone 'Africa/Douala') group by 1, 2, 3
    union all
    select k.campaign_id, (k.issued_at at time zone 'Africa/Douala')::date, coalesce(k.branch_id, '00000000-0000-0000-0000-000000000000'),
      0, 0, 0, 0, 0, 0, 0, 0, count(*), 0
    from public.ad_coupons k where k.issued_at >= (v_from::timestamp at time zone 'Africa/Douala') group by 1, 2, 3
    union all
    select k.campaign_id, (k.redeemed_at at time zone 'Africa/Douala')::date, coalesce(k.branch_id, '00000000-0000-0000-0000-000000000000'),
      0, 0, 0, 0, 0, 0, 0, 0, 0, count(*)
    from public.ad_coupons k where k.redeemed_at >= (v_from::timestamp at time zone 'Africa/Douala') group by 1, 2, 3
  ) x
  where exists (select 1 from public.ad_campaigns c where c.id = x.campaign_id)
  group by campaign_id, day, branch_id;
  get diagnostics v_n = row_count;
  -- Campagnes terminées.
  update public.ad_campaigns set status = 'ended' where status in ('active', 'paused', 'awaiting_payment') and ends_on < public.douala_today();
  return v_n;
end;
$$;
select cron.schedule('nextin-ad-stats', '7 * * * *', $$select public.rollup_ad_stats(2)$$);

/** Statistiques d'une campagne (annonceur, établissement pour une annonce Maison, super admin) : totaux et jours. */
create or replace function public.campaign_stats(p_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_view_campaign(p_campaign) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object('impressions', coalesce(sum(impressions), 0), 'clicks', coalesce(sum(clicks), 0),
      'skips', coalesce(sum(skips), 0), 'quiz_plays', coalesce(sum(quiz_plays), 0), 'game_plays', coalesce(sum(game_plays), 0),
      'interstitial_impressions', coalesce(sum(interstitial_impressions), 0), 'interstitial_skips', coalesce(sum(interstitial_skips), 0),
      'coupons_issued', coalesce(sum(coupons_issued), 0), 'coupons_redeemed', coalesce(sum(coupons_redeemed), 0))
      from public.ad_daily_stats where campaign_id = p_campaign),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'impressions', impressions + interstitial_impressions,
      'clicks', clicks, 'plays', quiz_plays + game_plays, 'coupons_issued', coupons_issued, 'coupons_redeemed', coupons_redeemed) order by day)
      from (select day, sum(impressions) as impressions, sum(interstitial_impressions) as interstitial_impressions, sum(clicks) as clicks,
              sum(quiz_plays) as quiz_plays, sum(game_plays) as game_plays, sum(coupons_issued) as coupons_issued,
              sum(coupons_redeemed) as coupons_redeemed
            from public.ad_daily_stats where campaign_id = p_campaign group by day) d), '[]'::jsonb),
    'branches', (select count(*) from public.ad_campaign_branches where campaign_id = p_campaign)
  );
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Paiement des campagnes (même agrégateur, mêmes factures que les abonnements)
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.invoices
  add column advertiser_id uuid references public.advertisers (id) on delete set null,
  add column campaign_id uuid references public.ad_campaigns (id) on delete set null;
alter table public.invoices drop constraint invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('renewal', 'upgrade', 'campaign'));
create index invoices_campaign_idx on public.invoices (campaign_id) where campaign_id is not null;

/** Facture d'une campagne approuvée (réutilisée tant qu'elle est ouverte). Numérotation commune, sans trou. */
create or replace function public.issue_campaign_invoice(p_campaign uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
  v_a public.advertisers;
  v_pkg public.ad_packages;
  v_settings public.platform_settings;
  v_inv public.invoices;
  v_year smallint;
  v_number integer;
  v_tax integer;
begin
  select * into v_c from public.ad_campaigns where id = p_campaign for update;
  if not found or v_c.advertiser_id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_c.status <> 'awaiting_payment' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  select * into v_inv from public.invoices where campaign_id = v_c.id and status = 'open' order by issued_at desc limit 1;
  if found then return v_inv; end if;
  select * into v_a from public.advertisers where id = v_c.advertiser_id;
  select * into v_pkg from public.ad_packages where code = v_c.package_code;
  select * into v_settings from public.platform_settings;
  v_tax := round(v_c.price_xaf * v_settings.vat_rate / 100.0);
  v_year := extract(year from now() at time zone 'Africa/Douala')::smallint;
  insert into public.invoice_sequences as q (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = q.last_number + 1
  returning last_number into v_number;
  insert into public.invoices (number, advertiser_id, campaign_id, kind, billing_period, period_start, period_end, lines, subtotal_xaf,
    discount_xaf, vat_rate, tax_xaf, total_xaf, due_at, buyer_snapshot, seller_snapshot)
  values (format('FAC-%s-%s', v_year, lpad(v_number::text, 6, '0')), v_a.id, v_c.id, 'campaign', 'monthly',
    (v_c.starts_on::timestamp at time zone 'Africa/Douala'), ((v_c.ends_on + 1)::timestamp at time zone 'Africa/Douala'),
    jsonb_build_array(jsonb_build_object('kind', 'campaign', 'label', format('Campagne « %s » · formule %s', v_c.name, v_pkg.name),
      'label_en', format('Campaign “%s” · %s package', v_c.name, v_pkg.name_en), 'quantity', 1, 'unit_xaf', v_c.price_xaf, 'amount_xaf', v_c.price_xaf)),
    v_c.price_xaf, 0, v_settings.vat_rate, v_tax, v_c.price_xaf + v_tax, now() + interval '1 day',
    jsonb_build_object('name', v_a.name, 'phone', v_a.phone_e164, 'email', (select email from auth.users where id = v_a.created_by), 'city', v_a.city),
    jsonb_build_object('legal_name', v_settings.company_legal_name, 'rc', v_settings.company_rc, 'niu', v_settings.company_niu,
      'address', v_settings.company_address, 'phone', v_settings.company_phone, 'email', v_settings.company_email,
      'footer', v_settings.invoice_footer))
  returning * into v_inv;
  return v_inv;
end;
$$;

/** Paiement d'une campagne approuvée (membre de l'annonceur) : facture puis lien `/pay/<jeton>`. */
create or replace function public.campaign_checkout(p_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
  v_inv public.invoices;
begin
  select * into v_c from public.ad_campaigns where id = p_campaign;
  if not found or v_c.advertiser_id is null or not public.is_advertiser_member(v_c.advertiser_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_inv := public.issue_campaign_invoice(v_c.id);
  perform public.audit(null, 'campaign.checkout', 'invoice', v_inv.id, jsonb_build_object('campaign', v_c.id, 'total_xaf', v_inv.total_xaf));
  return jsonb_build_object('invoice', v_inv.number, 'pay_token', public.create_pay_link(v_inv.id), 'total_xaf', v_inv.total_xaf);
end;
$$;


/** Résultat d'un paiement (M10a), plus l'activation des campagnes publicitaires payées (M10b). */
create or replace function public.confirm_payment(
  p_external_id text, p_status public.payment_status, p_provider_ref text default null, p_raw jsonb default null,
  p_failure text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payments;
  v_i public.invoices;
  v_s public.subscriptions;
  v_was public.subscription_status;
begin
  select * into v_p from public.payments where external_id = p_external_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_p.status <> 'pending' then
    return jsonb_build_object('status', v_p.status, 'already', true);
  end if;
  if p_status = 'pending' then
    -- Encore en attente : on garde seulement la référence du fournisseur (renvoyée au début du paiement).
    update public.payments set last_checked_at = now(), provider_ref = coalesce(p_provider_ref, provider_ref) where id = v_p.id;
    return jsonb_build_object('status', 'pending');
  end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref), raw = coalesce(p_raw, raw),
    failure_reason = left(p_failure, 200), confirmed_at = case when p_status = 'succeeded' then now() end, last_checked_at = now()
  where id = v_p.id returning * into v_p;
  if p_status <> 'succeeded' then
    return jsonb_build_object('status', p_status);
  end if;

  select * into v_i from public.invoices where id = v_p.invoice_id for update;
  if v_i.status = 'paid' then
    -- Facture déjà réglée par un autre paiement : à rembourser (rare), signalé au super admin par l'audit.
    perform public.audit(v_i.organization_id, 'payment.duplicate', 'payment', v_p.id, jsonb_build_object('invoice', v_i.number));
    return jsonb_build_object('status', 'succeeded', 'duplicate', true);
  end if;
  update public.invoices set status = 'paid', paid_at = now(), paid_channel = v_p.channel where id = v_i.id returning * into v_i;
  -- M10b : campagne publicitaire payée → diffusée (dans ses dates).
  if v_i.campaign_id is not null then
    update public.ad_campaigns set status = 'active', paid_at = now() where id = v_i.campaign_id and status = 'awaiting_payment';
    perform public.audit(null, 'campaign.paid', 'ad_campaign', v_i.campaign_id,
      jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', v_p.provider));
    return jsonb_build_object('status', 'succeeded', 'invoice', v_i.number);
  end if;
  select * into v_s from public.subscriptions where id = v_i.subscription_id for update;
  if found then
    v_was := v_s.status;
    update public.subscriptions set
      status = 'active', plan_id = v_i.plan_id, billing_period = v_i.billing_period,
      next_plan_id = case when next_plan_id = v_i.plan_id then null else next_plan_id end,
      current_period_start = v_i.period_start,
      current_period_end = greatest(v_i.period_end, coalesce(case when v_i.kind = 'renewal' then current_period_end end, v_i.period_end)),
      trial_ends_at = case when status = 'trialing' then trial_ends_at end,
      grace_ends_at = null, read_only_since = null, suspended_since = null, deletion_due_at = null,
      pending_status = null, pending_status_after = null
    where id = v_s.id returning * into v_s;
    -- Réactivation : un établissement suspendu pour impayé redevient visible.
    update public.organizations set status = 'active', suspended_reason = null
    where id = v_s.organization_id and status = 'suspended' and suspended_reason = 'subscription';
    insert into public.subscription_events (subscription_id, organization_id, type, payload) values
      (v_s.id, v_s.organization_id, 'paid', jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'channel', v_p.channel,
        'provider', v_p.provider, 'billing_period', v_i.billing_period));
    if v_was <> 'active' then
      insert into public.subscription_events (subscription_id, organization_id, type, payload)
      values (v_s.id, v_s.organization_id, 'reactivated', jsonb_build_object('from', v_was));
    end if;
    perform public.enqueue_account_message(v_s.organization_id, 'payment_confirmed', 'paid:' || v_i.id,
      jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'invoice_id', v_i.id, 'organization', v_i.buyer_snapshot ->> 'name',
        'period_end', (v_s.current_period_end at time zone 'Africa/Douala')::date),
      v_s.billing_phone_e164, v_s.billing_email, v_s.locale);
  end if;
  perform public.audit(v_i.organization_id, 'payment.succeeded', 'invoice', v_i.id,
    jsonb_build_object('number', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', v_p.provider));
  return jsonb_build_object('status', 'succeeded', 'invoice', v_i.number);
end;
$$;

/** Facture publique d'un lien de paiement (M10a), plus la campagne publicitaire (M10b). */
create or replace function public.pay_invoice_view(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'invoice_id', i.id,
    'number', i.number,
    'status', i.status,
    'total_xaf', i.total_xaf,
    'billing_period', i.billing_period,
    'period_start', i.period_start,
    'period_end', i.period_end,
    'paid_at', i.paid_at,
    'organization', i.buyer_snapshot ->> 'name',
    'plan', (select jsonb_build_object('name', p.name, 'name_en', p.name_en) from public.plans p where p.id = i.plan_id),
    -- M10b : facture d'une campagne publicitaire.
    'campaign', (select jsonb_build_object('name', c.name, 'package', pk.name, 'package_en', pk.name_en)
                 from public.ad_campaigns c join public.ad_packages pk on pk.code = c.package_code where c.id = i.campaign_id),
    'lines', i.lines,
    'expired', l.expires_at < now(),
    'payment', (select jsonb_build_object('status', y.status, 'channel', y.channel, 'external_id', y.external_id,
                  'failure_reason', y.failure_reason)
                from public.payments y where y.invoice_id = i.id order by y.created_at desc limit 1)
  )
  from public.pay_links l join public.invoices i on i.id = l.invoice_id
  where p_token ~ '^[A-Za-z0-9]{32}$' and l.token_hash = public.sha256_hex(p_token);
$$;

/** Facture complète pour le PDF (M10a), aussi pour les membres de l'annonceur (M10b). */
create or replace function public.invoice_document(p_invoice uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
begin
  select * into v_i from public.invoices where id = p_invoice;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.is_platform_admin() then
    -- M10b : facture d'une campagne, pour les membres de l'annonceur.
    if v_i.advertiser_id is not null then
      if not public.is_advertiser_member(v_i.advertiser_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
    else
      if v_i.organization_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
      perform public.assert_org_admin(v_i.organization_id);
    end if;
  end if;
  return to_jsonb(v_i) || jsonb_build_object('plan', (select jsonb_build_object('name', name, 'name_en', name_en) from public.plans where id = v_i.plan_id));
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage : visuels (public) et justificatifs de visa (privé)
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Dépôt d'un fichier `<annonceur | org-<établissement>>/<campagne>/<fichier>` : membres de l'annonceur (ou
 * administrateurs de l'établissement pour une annonce Maison), dans le dossier d'une de leurs campagnes.
 */
create or replace function public.can_write_ad_file(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_owner text := v_parts[1];
  v_campaign uuid;
begin
  if cardinality(v_parts) <> 3 or v_parts[2] !~ '^[0-9a-f-]{36}$' or public.is_anonymous() then return false; end if;
  v_campaign := v_parts[2]::uuid;
  if v_owner like 'org-%' then
    return exists (select 1 from public.ad_campaigns c where c.id = v_campaign and c.organization_id::text = substr(v_owner, 5)
                   and public.has_org_role(c.organization_id, array['org_admin']::public.member_role[]));
  end if;
  return exists (select 1 from public.ad_campaigns c where c.id = v_campaign and c.advertiser_id::text = v_owner
                 and public.is_advertiser_member(c.advertiser_id));
end;
$$;

/** Lecture d'un justificatif de visa : membres de l'annonceur et super admin (modération). */
create or replace function public.can_read_ad_document(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or public.can_write_ad_file(p_name);
$$;

do $$
begin
  -- Le schéma storage existe dès que l'API de stockage est démarrée (Supabase local et distant).
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('ad-creatives', 'ad-creatives', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
      ('ad-documents', 'ad-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
    execute $p$create policy ad_creatives_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'ad-creatives' and public.can_write_ad_file(name))$p$;
    execute $p$create policy ad_creatives_update on storage.objects for update to authenticated
      using (bucket_id = 'ad-creatives' and public.can_write_ad_file(name))$p$;
    execute $p$create policy ad_creatives_delete on storage.objects for delete to authenticated
      using (bucket_id = 'ad-creatives' and public.can_write_ad_file(name))$p$;
    execute $p$create policy ad_documents_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'ad-documents' and public.can_write_ad_file(name))$p$;
    execute $p$create policy ad_documents_select on storage.objects for select to authenticated
      using (bucket_id = 'ad-documents' and public.can_read_ad_document(name))$p$;
  end if;
end;
$$;


/** Taille (octets) d'un fichier du bucket `ad-creatives` ; 0 s'il est inconnu (stockage absent, fichier pas encore lu). */
create or replace function public.ad_file_size(p_path text)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_size bigint;
begin
  if p_path is null or to_regclass('storage.objects') is null then return 0; end if;
  execute 'select (metadata ->> ''size'')::bigint from storage.objects where bucket_id = ''ad-creatives'' and name = $1'
    into v_size using p_path;
  return coalesce(v_size, 0);
end;
$$;

/** Jeux proposés sur « Mon ticket » (vérification légère au chargement ; le contenu vient à l'ouverture). */
create or replace function public.games_available(p_ticket_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select * from public.ticket_by_token(p_ticket_token) where id is not null),
  p as (select p.* from t left join public.organization_ad_preferences p on p.organization_id = t.organization_id)
  select case when not exists (select 1 from t) then null else jsonb_build_object(
    'quiz', coalesce((select quiz_enabled from p), true) and exists (
      select 1 from public.ad_quizzes q
      join (select distinct campaign_id from t, public.ad_candidates(t.branch_id, 'game')) c on c.campaign_id = q.campaign_id
      where q.status = 'approved'),
    'sky_catch', coalesce((select sky_catch_enabled from p), true)
  ) end;
$$;

/** Arrêt d'une annonce Maison par l'établissement. */
create or replace function public.end_house_campaign(p_campaign uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns := public.lock_campaign_for_edit(p_campaign);
begin
  if v_c.organization_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.ad_campaigns set status = 'ended', ends_on = least(ends_on, public.douala_today()) where id = v_c.id;
  delete from public.ad_campaign_branches where campaign_id = v_c.id;
end;
$$;


/** Villes des agences actives (choix du ciblage) : information publique, déjà visible dans « À proximité ». */
create or replace function public.ad_target_cities()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct initcap(trim(b.city)) order by initcap(trim(b.city))), '{}')
  from public.branches b join public.organizations o on o.id = b.organization_id
  where b.active and o.status = 'active' and nullif(trim(b.city), '') is not null;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Droits et RLS
-- ═════════════════════════════════════════════════════════════════════════════

revoke execute on function
  public.is_advertiser_member(uuid, text[]), public.can_view_campaign(uuid), public.lock_campaign_for_edit(uuid), public.douala_today(),
  public.create_advertiser(text, text, text, text), public.save_campaign(uuid, uuid, uuid, jsonb), public.save_creative(uuid, uuid, jsonb),
  public.delete_creative(uuid), public.save_quiz(uuid, jsonb), public.delete_quiz(uuid), public.save_game_skin(uuid, jsonb),
  public.delete_game_skin(uuid), public.target_campaign_branches(uuid), public.submit_campaign(uuid), public.review_campaign(uuid, boolean, text),
  public.admin_set_campaign_paused(uuid, boolean, text), public.admin_update_ad_package(text, jsonb),
  public.admin_upsert_ad_sector(text, text, text, boolean, boolean), public.set_ad_preferences(uuid, text[], boolean, boolean, boolean),
  public.ad_candidates(uuid, public.ad_surface, timestamptz), public.ad_weighted_draw(jsonb, integer), public.ad_candidates_json(uuid, public.ad_surface),
  public.ticket_by_token(text), public.app_ad(text), public.tv_ad_rotation(text), public.game_session(text),
  public.issue_coupon(uuid, uuid, uuid, text, text, integer, integer, uuid, uuid), public.start_quiz(text, uuid),
  public.finish_quiz(text, uuid, smallint[]), public.start_sky_catch(text, uuid), public.finish_sky_catch(text, uuid, integer, integer, integer),
  public.coupon_view(text), public.redeem_coupon(text, boolean), public.record_ad_events(uuid, uuid, jsonb), public.rollup_ad_stats(integer),
  public.campaign_stats(uuid), public.issue_campaign_invoice(uuid), public.campaign_checkout(uuid), public.ensure_ad_event_partitions(),
  public.can_write_ad_file(text), public.can_read_ad_document(text), public.ad_file_size(text), public.games_available(text),
  public.end_house_campaign(uuid), public.ad_target_cities()
from public, anon, authenticated;

-- Fonctions des politiques RLS et de stockage (évaluées pour le rôle de la requête ; lecture seule).
grant execute on function public.can_write_ad_file(text), public.can_read_ad_document(text), public.is_advertiser_member(uuid, text[]),
  public.can_view_campaign(uuid) to authenticated;
-- Pages client (jeton du ticket, sans compte) : jeux, pub de l'application, bon de réduction.
grant execute on function public.app_ad(text), public.game_session(text), public.games_available(text), public.start_quiz(text, uuid), public.finish_quiz(text, uuid, smallint[]),
  public.start_sky_catch(text, uuid), public.finish_sky_catch(text, uuid, integer, integer, integer), public.coupon_view(text)
to anon, authenticated;
-- Annonceurs, établissements, super admin (droits vérifiés dans chaque fonction).
grant execute on function public.create_advertiser(text, text, text, text), public.save_campaign(uuid, uuid, uuid, jsonb),
  public.save_creative(uuid, uuid, jsonb), public.delete_creative(uuid), public.save_quiz(uuid, jsonb), public.delete_quiz(uuid),
  public.save_game_skin(uuid, jsonb), public.delete_game_skin(uuid), public.submit_campaign(uuid), public.review_campaign(uuid, boolean, text),
  public.admin_set_campaign_paused(uuid, boolean, text), public.admin_update_ad_package(text, jsonb),
  public.admin_upsert_ad_sector(text, text, text, boolean, boolean), public.set_ad_preferences(uuid, text[], boolean, boolean, boolean),
  public.redeem_coupon(text, boolean), public.campaign_stats(uuid), public.campaign_checkout(uuid), public.end_house_campaign(uuid),
  public.ad_target_cities()
to authenticated;
-- Serveur de l'application (écrans TV, lots d'événements).
grant execute on function public.tv_ad_rotation(text), public.record_ad_events(uuid, uuid, jsonb), public.ticket_by_token(text),
  public.ad_candidates_json(uuid, public.ad_surface)
to service_role;

alter table public.ad_sectors enable row level security;
alter table public.ad_packages enable row level security;
alter table public.advertisers enable row level security;
alter table public.advertiser_members enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_schedules enable row level security;
alter table public.ad_campaign_branches enable row level security;
alter table public.organization_ad_preferences enable row level security;
alter table public.ad_quizzes enable row level security;
alter table public.ad_quiz_questions enable row level security;
alter table public.ad_game_skins enable row level security;
alter table public.ad_quiz_plays enable row level security;
alter table public.ad_game_plays enable row level security;
alter table public.ad_coupons enable row level security;
alter table public.ad_events enable row level security;
alter table public.ad_events_default enable row level security;
alter table public.ad_daily_stats enable row level security;

revoke all on public.ad_sectors, public.ad_packages, public.advertisers, public.advertiser_members, public.ad_campaigns, public.ad_creatives,
  public.ad_schedules, public.ad_campaign_branches, public.organization_ad_preferences, public.ad_quizzes, public.ad_quiz_questions,
  public.ad_game_skins, public.ad_quiz_plays, public.ad_game_plays, public.ad_coupons, public.ad_events, public.ad_events_default,
  public.ad_daily_stats
from anon, authenticated;
-- Lecture seule ; toute écriture passe par les RPC ci-dessus.
grant select on public.ad_sectors, public.ad_packages to anon, authenticated;
grant select on public.advertisers, public.advertiser_members, public.ad_campaigns, public.ad_creatives, public.ad_schedules,
  public.ad_campaign_branches, public.organization_ad_preferences, public.ad_quizzes, public.ad_quiz_questions, public.ad_game_skins,
  public.ad_coupons, public.ad_daily_stats
to authenticated;

create policy ad_sectors_select on public.ad_sectors for select to anon, authenticated using (active or public.is_platform_admin());
create policy ad_packages_select on public.ad_packages for select to anon, authenticated using (active or public.is_platform_admin());
create policy advertisers_select on public.advertisers for select to authenticated
  using (public.is_advertiser_member(id) or public.is_platform_admin());
create policy advertiser_members_select on public.advertiser_members for select to authenticated
  using (public.is_advertiser_member(advertiser_id) or public.is_platform_admin());
create policy ad_campaigns_select on public.ad_campaigns for select to authenticated using (public.can_view_campaign(id));
create policy ad_creatives_select on public.ad_creatives for select to authenticated using (public.can_view_campaign(campaign_id));
create policy ad_schedules_select on public.ad_schedules for select to authenticated using (public.can_view_campaign(campaign_id));
create policy ad_campaign_branches_select on public.ad_campaign_branches for select to authenticated using (public.can_view_campaign(campaign_id));
create policy ad_quizzes_select on public.ad_quizzes for select to authenticated using (public.can_view_campaign(campaign_id));
create policy ad_quiz_questions_select on public.ad_quiz_questions for select to authenticated
  using (exists (select 1 from public.ad_quizzes q where q.id = quiz_id and public.can_view_campaign(q.campaign_id)));
create policy ad_game_skins_select on public.ad_game_skins for select to authenticated using (public.can_view_campaign(campaign_id));
create policy ad_coupons_select on public.ad_coupons for select to authenticated using (public.can_view_campaign(campaign_id));
create policy ad_daily_stats_select on public.ad_daily_stats for select to authenticated using (public.can_view_campaign(campaign_id));
create policy organization_ad_preferences_select on public.organization_ad_preferences for select to authenticated
  using ((public.has_org_role(organization_id) and not public.is_anonymous()) or public.is_platform_admin());
-- Factures des campagnes : membres de l'annonceur.
create policy invoices_advertiser_select on public.invoices for select to authenticated
  using (advertiser_id is not null and public.is_advertiser_member(advertiser_id));
create policy payments_advertiser_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and i.advertiser_id is not null
                 and public.is_advertiser_member(i.advertiser_id)));
