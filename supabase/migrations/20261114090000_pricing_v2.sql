-- Grille tarifaire v2 (Starter, Business, Premium, Enterprise sur devis) : limites par établissement (agences, services,
-- guichets, écrans, utilisateurs), tickets et messages WhatsApp par mois avec alertes à 80 % et 100 %, journée de grâce
-- (jamais de blocage d'une file en cours : blocage seulement à partir du lendemain), extensions de quota payantes,
-- historique des statistiques limité par la formule (masqué, jamais supprimé), limites sur mesure des clients sur devis.
-- Les valeurs ci-dessous sont des valeurs initiales : le super admin les modifie dans la console Wintek.

-- ═════════════════════════════════════════════════════════════════════════════
-- Formules
-- ═════════════════════════════════════════════════════════════════════════════

-- Limites par établissement (et non plus par agence) ; null : illimité.
alter table public.plans rename column max_counters_per_branch to max_counters;
alter table public.plans rename column max_displays_per_branch to max_displays;
alter table public.plans rename column whatsapp_quota_per_branch to whatsapp_quota;
alter table public.plans alter column whatsapp_quota drop not null;
alter table public.plans alter column whatsapp_quota drop default;
alter table public.plans
  add column max_services smallint check (max_services >= 1),
  add column max_users smallint check (max_users >= 1),
  -- Tickets créés par mois (un ticket créé = une unité ; un changement de statut ne compte jamais).
  add column tickets_per_month integer check (tickets_per_month >= 0),
  -- Statistiques et exports visibles sur N mois (les données plus anciennes sont masquées, pas supprimées).
  add column history_months smallint check (history_months between 1 and 120),
  -- Sur devis : pas de paiement en ligne (« Nous contacter »), limites fixées client par client.
  add column quote_only boolean not null default false;

-- Établissements existants : Essentiel → Starter, Pro → Business, Entreprise → Premium. Mêmes lignes (même identifiant) :
-- les abonnements suivent sans changer d'échéance ; les factures passées gardent leurs lignes figées.
update public.plans set code = 'starter', name = 'Starter', name_en = 'Starter',
  description = 'Une file bien tenue : tickets QR, accueil, postes, écran TV, annonces vocales, alertes.',
  description_en = 'A well-run queue: QR tickets, reception, desks, TV screen, voice announcements, alerts.',
  base_price_xaf = 29900, included_branches = 1, extra_branch_price_xaf = null,
  max_services = 3, max_counters = 3, max_displays = 1, max_users = 5, tickets_per_month = 1500, whatsapp_quota = 500, history_months = 3,
  features = '{"voice_announcements": true, "appointments": false, "remote_tickets": false, "advanced_stats": false, "export": false,
    "multisite": false, "priority_support": false, "dedicated_support": false}',
  trial_eligible = false, sort_order = 1
where code = 'essentiel';
update public.plans set code = 'business', name = 'Business', name_en = 'Business',
  description = 'Starter, plus rendez-vous, ticket à distance, statistiques avancées et export.',
  description_en = 'Starter, plus appointments, remote tickets, advanced statistics and export.',
  base_price_xaf = 59900, included_branches = 1, extra_branch_price_xaf = null,
  max_services = 10, max_counters = 10, max_displays = 3, max_users = 15, tickets_per_month = 6000, whatsapp_quota = 2000, history_months = 12,
  features = '{"voice_announcements": true, "appointments": true, "remote_tickets": true, "advanced_stats": true, "export": true,
    "multisite": false, "priority_support": false, "dedicated_support": false}',
  trial_eligible = true, sort_order = 2
where code = 'pro';
update public.plans set code = 'premium', name = 'Premium', name_en = 'Premium',
  description = 'Business sur plusieurs sites, avec support prioritaire.',
  description_en = 'Business across several sites, with priority support.',
  base_price_xaf = 124900, included_branches = 3, extra_branch_price_xaf = null,
  max_services = 30, max_counters = 30, max_displays = 10, max_users = 50, tickets_per_month = 15000, whatsapp_quota = 6000, history_months = 24,
  features = '{"voice_announcements": true, "appointments": true, "remote_tickets": true, "advanced_stats": true, "export": true,
    "multisite": true, "priority_support": true, "dedicated_support": false}',
  trial_eligible = false, sort_order = 3
where code = 'entreprise';
-- Enterprise : sur devis. Sans limite par défaut (agences en plus comprises : prix d'agence à 0) ; le super admin fixe
-- celles de chaque client (`limit_overrides`).
-- Sert aussi de référence aux établissements pilotes (créés avant les abonnements, tout compris).
insert into public.plans (code, name, name_en, description, description_en, base_price_xaf, included_branches, extra_branch_price_xaf,
  max_services, max_counters, max_displays, max_users, tickets_per_month, whatsapp_quota, history_months, features, trial_eligible,
  quote_only, sort_order)
values ('enterprise', 'Enterprise', 'Enterprise', 'Limites et accompagnement sur mesure, sur devis.',
  'Tailored limits and support, on quotation.', 0, 1, 0, null, null, null, null, null, null, null,
  '{"voice_announcements": true, "appointments": true, "remote_tickets": true, "advanced_stats": true, "export": true,
    "multisite": true, "priority_support": true, "dedicated_support": true}', false, true, 4)
on conflict (code) do nothing;

-- Limites sur mesure d'un client (formule sur devis, ou geste commercial) : clés de `ENTITLEMENT_LIMITS`, valeur entière ou
-- null (illimité) ; une clé absente reprend la valeur de la formule.
alter table public.subscription_events drop constraint subscription_events_type_check;
alter table public.subscription_events add constraint subscription_events_type_check check (type in ('trial_started', 'no_trial',
  'invoice_issued', 'paid', 'renewed', 'grace_started', 'read_only', 'suspended', 'reactivated', 'days_granted', 'discount_applied',
  'plan_changed', 'plan_change_scheduled', 'deleted', 'moderation', 'limits_set'));

alter table public.subscriptions
  add column limit_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(limit_overrides) = 'object');

-- ═════════════════════════════════════════════════════════════════════════════
-- Consommation mensuelle, extensions de quota
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.messaging_usage
  add column tickets_created integer not null default 0,
  -- Jour (Douala) où la limite a été atteinte : la file continue ce jour-là, blocage à partir du lendemain.
  add column tickets_reached_on date,
  add column whatsapp_reached_on date,
  -- Alertes déjà envoyées ce mois-ci (« tickets_80 », « whatsapp_100 »…).
  add column alerts text[] not null default '{}';

/** Extensions de quota vendues à l'unité (pack de tickets, pack WhatsApp) : prix et quantités fixés par le super admin. */
create table public.quota_packs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  kind text not null check (kind in ('tickets', 'whatsapp')),
  quantity integer not null check (quantity > 0),
  price_xaf integer not null check (price_xaf >= 0),
  name text not null check (char_length(name) between 2 and 60),
  name_en text check (char_length(name_en) <= 60),
  active boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);
create trigger quota_packs_set_updated_at before update on public.quota_packs for each row execute function public.set_updated_at();
-- Valeurs provisoires, à confirmer par Wintek dans la console.
insert into public.quota_packs (code, kind, quantity, price_xaf, name, name_en, sort_order) values
  ('tickets_1000', 'tickets', 1000, 10000, 'Pack 1 000 tickets', '1,000 tickets pack', 1),
  ('whatsapp_500', 'whatsapp', 500, 7500, 'Pack 500 messages WhatsApp', '500 WhatsApp messages pack', 2),
  ('whatsapp_2000', 'whatsapp', 2000, 25000, 'Pack 2 000 messages WhatsApp', '2,000 WhatsApp messages pack', 3);

/** Extension payée : s'ajoute à la limite du mois (Douala) au cours duquel elle est réglée. */
create table public.quota_extensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('tickets', 'whatsapp')),
  quantity integer not null check (quantity > 0),
  pack_id uuid references public.quota_packs (id) on delete set null,
  invoice_id uuid unique,
  created_at timestamptz not null default now()
);
create index quota_extensions_org_month_idx on public.quota_extensions (organization_id, month);

alter table public.invoices add column quota_pack_id uuid references public.quota_packs (id) on delete set null;
alter table public.invoices drop constraint invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('renewal', 'upgrade', 'campaign', 'extension'));
alter table public.quota_extensions add constraint quota_extensions_invoice_fk foreign key (invoice_id) references public.invoices (id) on delete set null;

-- ═════════════════════════════════════════════════════════════════════════════
-- Droits
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Droits d'un établissement : formule, statut, limites (formule, sauf limites sur mesure du client) et fonctions.
 * Pendant l'essai : formule d'essai (`trial_eligible`, Business). Établissements pilotes (sans abonnement) : Enterprise,
 * sans limite. Limites : null = illimité.
 */
create or replace function public.org_entitlements(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.subscriptions where organization_id = p_org),
  p as (
    select pl.* from public.plans pl
    where pl.id = coalesce(
      (select case when s.status = 'trialing'
                   then coalesce((select id from public.plans where trial_eligible and active order by sort_order limit 1), s.plan_id)
                   else s.plan_id end from s),
      (select id from public.plans where code = 'enterprise'))
  ),
  o as (select coalesce((select limit_overrides from s), '{}'::jsonb) as v)
  select jsonb_build_object(
    'pilot', not exists (select 1 from s),
    'plan_code', p.code,
    'plan_name', p.name,
    'plan_name_en', p.name_en,
    'subscribed_plan_code', (select pl.code from s join public.plans pl on pl.id = s.plan_id),
    'status', coalesce((select status::text from s), 'active'),
    'can_issue', coalesce((select status not in ('read_only', 'suspended') from s), true),
    'quote_only', p.quote_only,
    'included_branches', case when o.v ? 'included_branches' then (o.v ->> 'included_branches')::integer else p.included_branches end,
    -- Nombre d'agences fixé sur mesure : plus d'agence au-delà.
    'extra_branch_price_xaf', case when o.v ? 'included_branches' then null else p.extra_branch_price_xaf end,
    'max_services', case when o.v ? 'max_services' then (o.v ->> 'max_services')::integer else p.max_services end,
    'max_counters', case when o.v ? 'max_counters' then (o.v ->> 'max_counters')::integer else p.max_counters end,
    'max_displays', case when o.v ? 'max_displays' then (o.v ->> 'max_displays')::integer else p.max_displays end,
    'max_users', case when o.v ? 'max_users' then (o.v ->> 'max_users')::integer else p.max_users end,
    'tickets_per_month', case when o.v ? 'tickets_per_month' then (o.v ->> 'tickets_per_month')::integer else p.tickets_per_month end,
    'whatsapp_quota', case when o.v ? 'whatsapp_quota' then (o.v ->> 'whatsapp_quota')::integer else p.whatsapp_quota end,
    'history_months', case when o.v ? 'history_months' then (o.v ->> 'history_months')::integer else p.history_months end,
    'features', p.features || coalesce(o.v -> 'features', '{}'::jsonb)
  )
  from p, o;
$$;

/** Un quota du mois : consommation, limite (formule + extensions), jour où elle a été atteinte, blocage. */
create or replace function public.quota_item(p_used integer, p_base integer, p_extra integer, p_reached_on date, p_today date)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with x as (select coalesce(p_used, 0) as used, case when p_base is null then null else p_base + coalesce(p_extra, 0) end as lim)
  select jsonb_build_object(
    'used', x.used,
    'base', p_base,
    'extra', coalesce(p_extra, 0),
    'limit', x.lim,
    'percent', case when x.lim > 0 then least(999, floor(x.used * 100.0 / x.lim))::integer end,
    'reached_on', case when x.lim is not null and x.used >= x.lim then p_reached_on end,
    -- Blocage seulement à partir du lendemain du jour où la limite a été atteinte.
    'blocked', coalesce(x.lim is not null and x.used >= x.lim and p_reached_on is not null and p_reached_on < p_today, false)
  )
  from x;
$$;

/** Consommation du mois en cours (Douala) : tickets et messages WhatsApp. */
create or replace function public.quota_status(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with e as (select public.org_entitlements(p_org) as v),
  d as (select (now() at time zone 'Africa/Douala')::date as today),
  m as (select date_trunc('month', d.today)::date as month, d.today from d),
  u as (select x.* from public.messaging_usage x, m where x.organization_id = p_org and x.month = m.month)
  select jsonb_build_object(
    'month', m.month,
    'tickets', public.quota_item((select tickets_created from u), (e.v ->> 'tickets_per_month')::integer,
      (select sum(quantity)::integer from public.quota_extensions x where x.organization_id = p_org and x.month = m.month and x.kind = 'tickets'),
      (select tickets_reached_on from u), m.today),
    'whatsapp', public.quota_item((select whatsapp_sent from u), (e.v ->> 'whatsapp_quota')::integer,
      (select sum(quantity)::integer from public.quota_extensions x where x.organization_id = p_org and x.month = m.month and x.kind = 'whatsapp'),
      (select whatsapp_reached_on from u), m.today)
  )
  from e, m;
$$;

/** Consommation du mois pour le personnel (bandeau d'alerte du back-office) ; `not_allowed` sinon. */
create or replace function public.staff_quota_status(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_anonymous() or not (public.has_org_role(p_org, null) or public.is_platform_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return public.quota_status(p_org);
end;
$$;

/**
 * Progression d'un quota après une unité consommée : jour où la limite est atteinte (grâce jusqu'au soir), alertes au
 * directeur à `quota_alert_percent` (80 %) puis à 100 %, une fois par mois et par seuil.
 */
create or replace function public.quota_progress(p_org uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q jsonb := public.quota_status(p_org) -> p_kind;
  v_used integer := (v_q ->> 'used')::integer;
  v_limit integer := (v_q ->> 'limit')::integer;
  v_today date := (now() at time zone 'Africa/Douala')::date;
  v_month date := date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date;
  v_level integer;
  v_key text;
  v_s public.subscriptions;
begin
  if v_limit is null or v_limit <= 0 then return; end if;
  if v_used >= v_limit then
    if p_kind = 'tickets' then
      update public.messaging_usage set tickets_reached_on = coalesce(tickets_reached_on, v_today) where organization_id = p_org and month = v_month;
    else
      update public.messaging_usage set whatsapp_reached_on = coalesce(whatsapp_reached_on, v_today) where organization_id = p_org and month = v_month;
    end if;
  end if;
  foreach v_level in array array[(select quota_alert_percent from public.platform_settings)::integer, 100] loop
    v_key := p_kind || '_' || v_level;
    if v_used * 100 >= v_limit * v_level
       and not exists (select 1 from public.messaging_usage where organization_id = p_org and month = v_month and v_key = any(alerts)) then
      update public.messaging_usage set alerts = array_append(alerts, v_key) where organization_id = p_org and month = v_month;
      select * into v_s from public.subscriptions where organization_id = p_org;
      if found then
        perform public.enqueue_account_message(p_org, 'quota_alert', format('quota:%s:%s:%s:%s', p_kind, v_level, p_org, v_month),
          jsonb_build_object('resource', p_kind, 'level', v_level, 'used', v_used, 'quota', v_limit,
            'organization', (select name from public.organizations where id = p_org)),
          v_s.billing_phone_e164, v_s.billing_email, v_s.locale);
      end if;
    end if;
  end loop;
end;
$$;

/** Ticket créé (hors réorientation, qui ne crée pas de nouvelle demande) : compté pour le mois. */
create or replace function public.count_ticket_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Mois de création du ticket (le mois en cours en service ; un ticket importé avec sa date compte dans son mois).
  v_month date := date_trunc('month', (coalesce(new.created_at, now()) at time zone 'Africa/Douala')::date)::date;
begin
  if new.transferred_from_id is not null then return null; end if;
  insert into public.messaging_usage as u (organization_id, month, tickets_created)
  values (new.organization_id, v_month, 1)
  on conflict (organization_id, month) do update set tickets_created = u.tickets_created + 1;
  if v_month = date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date then
    perform public.quota_progress(new.organization_id, 'tickets');
  end if;
  return null;
end;
$$;
create trigger tickets_count_usage after insert on public.tickets for each row execute function public.count_ticket_usage();

/** Message WhatsApp ou SMS envoyé : compté pour le mois ; quota WhatsApp (grâce et alertes) comme les tickets. */
create or replace function public.count_messaging_usage(p_org uuid, p_channel public.notif_channel)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channel not in ('whatsapp', 'sms') then return; end if;
  insert into public.messaging_usage as u (organization_id, month, whatsapp_sent, sms_sent)
  values (p_org, date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date, (p_channel = 'whatsapp')::integer, (p_channel = 'sms')::integer)
  on conflict (organization_id, month) do update set
    whatsapp_sent = u.whatsapp_sent + (p_channel = 'whatsapp')::integer,
    sms_sent = u.sms_sent + (p_channel = 'sms')::integer;
  if p_channel = 'whatsapp' then
    perform public.quota_progress(p_org, 'whatsapp');
  end if;
end;
$$;

/** Quota WhatsApp épuisé depuis la veille au moins ? (« c'est votre tour » reste toujours envoyé.) */
create or replace function public.whatsapp_quota_exceeded(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((public.quota_status(p_org) -> 'whatsapp' ->> 'blocked')::boolean, false);
$$;

/**
 * Émission de tickets et rendez-vous selon l'abonnement : rien en lecture seule ou suspendu ; ticket à distance et
 * rendez-vous si la formule les comprend ; tickets du mois : jamais de blocage le jour où la limite est atteinte (la
 * file continue jusqu'à la fermeture), refus (`monthly_quota_reached`) à partir du lendemain. Une réorientation ne
 * crée pas de nouvelle demande : jamais refusée.
 */
create or replace function public.enforce_subscription_on_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e jsonb := public.org_entitlements(new.organization_id);
begin
  if not (v_e ->> 'can_issue')::boolean then
    raise exception 'subscription_read_only' using errcode = 'P0410';
  end if;
  -- Conditions imbriquées : plpgsql évaluerait `new.source` même sur une table qui n'a pas cette colonne.
  if tg_table_name = 'tickets' then
    if new.transferred_from_id is null then
      if coalesce((public.quota_status(new.organization_id) -> 'tickets' ->> 'blocked')::boolean, false) then
        raise exception 'monthly_quota_reached' using errcode = 'P0410', detail = 'tickets';
      end if;
      if new.source = 'remote' then
        perform public.assert_feature(new.organization_id, 'remote_tickets');
      end if;
    end if;
  elsif tg_table_name in ('appointments', 'appointment_requests') then
    perform public.assert_feature(new.organization_id, 'appointments');
  end if;
  return new;
end;
$$;

/** Utilisateurs d'un établissement : comptes actifs distincts. */
create or replace function public.org_user_count(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct user_id)::integer from public.memberships where organization_id = p_org and active;
$$;

/**
 * Limites des formules, vérifiées par la base : agences, services, guichets, écrans et utilisateurs de l'établissement
 * (invitations en attente comprises). Ce qui existe déjà n'est jamais retiré : seul l'ajout est refusé.
 */
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e jsonb;
  v_count integer;
  v_max integer;
begin
  v_e := public.org_entitlements(new.organization_id);
  if tg_table_name = 'branches' then
    if new.active and (tg_op = 'INSERT' or not old.active) and (v_e ->> 'extra_branch_price_xaf') is null then
      select count(*) into v_count from public.branches where organization_id = new.organization_id and active and id <> new.id;
      if v_count >= (v_e ->> 'included_branches')::integer then
        raise exception 'plan_limit' using errcode = 'P0403', detail = 'branches';
      end if;
    end if;
  elsif tg_table_name = 'services' then
    v_max := (v_e ->> 'max_services')::integer;
    if new.active and (tg_op = 'INSERT' or not old.active) and v_max is not null then
      select count(*) into v_count from public.services where organization_id = new.organization_id and active and id <> new.id;
      if v_count >= v_max then raise exception 'plan_limit' using errcode = 'P0403', detail = 'services'; end if;
    end if;
  elsif tg_table_name = 'counters' then
    v_max := (v_e ->> 'max_counters')::integer;
    if new.active and (tg_op = 'INSERT' or not old.active) and v_max is not null then
      select count(*) into v_count from public.counters where organization_id = new.organization_id and active and id <> new.id;
      if v_count >= v_max then raise exception 'plan_limit' using errcode = 'P0403', detail = 'counters'; end if;
    end if;
  elsif tg_table_name = 'displays' then
    v_max := (v_e ->> 'max_displays')::integer;
    if new.status = 'active' and new.branch_id is not null and (tg_op = 'INSERT' or old.status <> 'active') and v_max is not null then
      select count(*) into v_count from public.displays where organization_id = new.organization_id and status = 'active' and id <> new.id;
      if v_count >= v_max then raise exception 'plan_limit' using errcode = 'P0403', detail = 'displays'; end if;
    end if;
  elsif tg_table_name = 'memberships' then
    v_max := (v_e ->> 'max_users')::integer;
    if new.active and (tg_op = 'INSERT' or not old.active) and v_max is not null
       and not exists (select 1 from public.memberships where organization_id = new.organization_id and user_id = new.user_id
                       and active and id <> new.id) then
      if public.org_user_count(new.organization_id) >= v_max then
        raise exception 'plan_limit' using errcode = 'P0403', detail = 'users';
      end if;
    end if;
  elsif tg_table_name = 'invitations' then
    v_max := (v_e ->> 'max_users')::integer;
    if v_max is not null then
      select count(*) into v_count from public.invitations
      where organization_id = new.organization_id and accepted_at is null and expires_at > now() and id <> new.id;
      if public.org_user_count(new.organization_id) + v_count >= v_max then
        raise exception 'plan_limit' using errcode = 'P0403', detail = 'users';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger services_plan_limits before insert or update of active on public.services
  for each row execute function public.enforce_plan_limits();
create trigger memberships_plan_limits before insert or update of active on public.memberships
  for each row execute function public.enforce_plan_limits();
create trigger invitations_plan_limits before insert on public.invitations
  for each row execute function public.enforce_plan_limits();

-- ═════════════════════════════════════════════════════════════════════════════
-- Historique des statistiques
-- ═════════════════════════════════════════════════════════════════════════════

/** Premier jour visible des statistiques selon la formule (null : tout l'historique). */
create or replace function public.stats_history_start(p_org uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select ((now() at time zone 'Africa/Douala')::date
          - make_interval(months => (public.org_entitlements(p_org) ->> 'history_months')::integer))::date + 1;
$$;

/** Lignes de la période (M8), limitées à l'historique de la formule : plus anciennes masquées, jamais supprimées. */
create or replace function public.stats_branch_rows(p_org uuid, p_branch uuid, p_from date, p_to date)
returns setof public.daily_branch_stats
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.daily_branch_stats r
  where r.organization_id = p_org and (p_branch is null or r.branch_id = p_branch)
    and r.day between greatest(p_from, coalesce((select public.stats_history_start(p_org)), p_from)) and p_to
    and r.day < public.branch_service_day(r.branch_id)
  union all
  select c.* from public.branches b
  cross join lateral public.compute_branch_stats(b.id, public.branch_service_day(b.id)) c
  where b.organization_id = p_org and (p_branch is null or b.id = p_branch)
    and public.branch_service_day(b.id) between p_from and p_to
  union all
  -- Veille pas encore cumulée (avant le passage nocturne) : calculée en direct.
  select c.* from public.branches b
  cross join lateral public.compute_branch_stats(b.id, public.branch_service_day(b.id) - 1) c
  where b.organization_id = p_org and (p_branch is null or b.id = p_branch)
    and public.branch_service_day(b.id) - 1 between p_from and p_to
    and not exists (select 1 from public.daily_branch_stats x where x.branch_id = b.id and x.day = public.branch_service_day(b.id) - 1);
$$;

create or replace function public.stats_counter_rows(p_org uuid, p_branch uuid, p_from date, p_to date)
returns setof public.daily_counter_stats
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.daily_counter_stats r
  where r.organization_id = p_org and (p_branch is null or r.branch_id = p_branch)
    and r.day between greatest(p_from, coalesce((select public.stats_history_start(p_org)), p_from)) and p_to
    and r.day < public.branch_service_day(r.branch_id)
  union all
  select c.* from public.branches b
  cross join lateral public.compute_counter_stats(b.id, public.branch_service_day(b.id)) c
  where b.organization_id = p_org and (p_branch is null or b.id = p_branch)
    and public.branch_service_day(b.id) between p_from and p_to
  union all
  -- Veille pas encore cumulée (avant le passage nocturne) : calculée en direct.
  select c.* from public.branches b
  cross join lateral public.compute_counter_stats(b.id, public.branch_service_day(b.id) - 1) c
  where b.organization_id = p_org and (p_branch is null or b.id = p_branch)
    and public.branch_service_day(b.id) - 1 between p_from and p_to
    and not exists (select 1 from public.daily_counter_stats x where x.branch_id = b.id and x.day = public.branch_service_day(b.id) - 1);
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Page Abonnement, paiement des formules et des extensions
-- ═════════════════════════════════════════════════════════════════════════════

/** Tout ce que montre la page Abonnement : abonnement, droits, consommation, formules, extensions, factures. */
create or replace function public.billing_overview(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
  v_branches integer;
  v_d public.discounts;
  v_usage jsonb;
begin
  perform public.assert_org_admin(p_org);
  select * into v_s from public.subscriptions where organization_id = p_org;
  v_branches := public.billable_branches(p_org);
  v_d := public.active_discount(p_org);
  v_usage := jsonb_build_object(
    'branches', v_branches,
    'services', (select count(*) from public.services where organization_id = p_org and active),
    'counters', (select count(*) from public.counters where organization_id = p_org and active),
    'displays', (select count(*) from public.displays where organization_id = p_org and status = 'active'),
    'users', public.org_user_count(p_org),
    'quota', public.quota_status(p_org));
  return jsonb_build_object(
    'subscription', case when v_s.id is not null then to_jsonb(v_s) - 'billing_phone_e164' - 'limit_overrides' || jsonb_build_object(
      'billing_phone_masked', case when v_s.billing_phone_e164 is not null
        then substr(v_s.billing_phone_e164, 1, 5) || '•• •• •• ' || right(v_s.billing_phone_e164, 2) end) end,
    'entitlements', public.org_entitlements(p_org),
    'usage', v_usage,
    'discount', case when v_d.id is not null then jsonb_build_object('kind', v_d.kind, 'value', v_d.value, 'remaining', v_d.remaining_invoices, 'reason', v_d.reason) end,
    'plans', (select jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'name', p.name, 'name_en', p.name_en, 'description', p.description, 'description_en', p.description_en,
        'base_price_xaf', p.base_price_xaf, 'included_branches', p.included_branches, 'extra_branch_price_xaf', p.extra_branch_price_xaf,
        'max_services', p.max_services, 'max_counters', p.max_counters, 'max_displays', p.max_displays, 'max_users', p.max_users,
        'tickets_per_month', p.tickets_per_month, 'whatsapp_quota', p.whatsapp_quota, 'history_months', p.history_months,
        'quote_only', p.quote_only, 'features', p.features, 'annual_free_months', p.annual_free_months,
        'monthly', public.subscription_price(p.base_price_xaf, p.included_branches, p.extra_branch_price_xaf, p.annual_free_months, v_branches, 'monthly', v_d.kind, v_d.value),
        'annual', public.subscription_price(p.base_price_xaf, p.included_branches, p.extra_branch_price_xaf, p.annual_free_months, v_branches, 'annual', v_d.kind, v_d.value),
        -- Formule compatible avec ce qui existe déjà (une formule sur devis est toujours proposée).
        'fits', p.quote_only or ((p.extra_branch_price_xaf is not null or v_branches <= p.included_branches)
          and (p.max_services is null or (v_usage ->> 'services')::integer <= p.max_services)
          and (p.max_counters is null or (v_usage ->> 'counters')::integer <= p.max_counters)
          and (p.max_displays is null or (v_usage ->> 'displays')::integer <= p.max_displays)
          and (p.max_users is null or (v_usage ->> 'users')::integer <= p.max_users))
      ) order by p.sort_order) from public.plans p where p.active),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'code', k.code, 'kind', k.kind, 'quantity', k.quantity,
        'price_xaf', k.price_xaf, 'name', k.name, 'name_en', k.name_en) order by k.sort_order)
      from public.quota_packs k where k.active), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'number', i.number, 'status', i.status, 'total_xaf', i.total_xaf,
        'issued_at', i.issued_at, 'paid_at', i.paid_at, 'period_start', i.period_start, 'period_end', i.period_end,
        'billing_period', i.billing_period, 'kind', i.kind, 'paid_channel', i.paid_channel, 'plan_id', i.plan_id) order by i.issued_at desc)
      from public.invoices i where i.organization_id = p_org), '[]'::jsonb),
    'settings', (select jsonb_build_object('trial_days', trial_days, 'grace_days', grace_days, 'vat_rate', vat_rate,
        'quota_alert_percent', quota_alert_percent, 'contact_email', nullif(company_email, ''), 'contact_phone', nullif(company_phone, ''))
      from public.platform_settings)
  );
end;
$$;

/**
 * Payer ou changer de formule (M10a) ; une formule sur devis ne se paie pas en ligne (`plan_quote_only`).
 */
create or replace function public.billing_checkout(p_org uuid, p_plan uuid, p_period public.billing_period)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
  v_plan public.plans;
  v_current public.plans;
  v_fits boolean;
  v_inv public.invoices;
begin
  perform public.assert_org_admin(p_org);
  select * into v_s from public.subscriptions where organization_id = p_org for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_plan from public.plans where id = p_plan and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_plan.quote_only then raise exception 'plan_quote_only' using errcode = 'P0409'; end if;
  select * into v_current from public.plans where id = v_s.plan_id;
  select (bo -> 'plans') @> jsonb_build_array(jsonb_build_object('id', p_plan, 'fits', true)) into v_fits
  from (select public.billing_overview(p_org) as bo) x;
  if not v_fits then raise exception 'plan_limit' using errcode = 'P0403', detail = 'downgrade'; end if;
  if v_s.status = 'active' and v_plan.base_price_xaf < v_current.base_price_xaf and v_s.current_period_end > now() then
    update public.subscriptions set next_plan_id = v_plan.id, billing_period = p_period where id = v_s.id;
    insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
    values (v_s.id, p_org, 'plan_change_scheduled', (select auth.uid()), jsonb_build_object('plan', v_plan.code, 'at', v_s.current_period_end));
    return jsonb_build_object('scheduled', true, 'at', v_s.current_period_end);
  end if;
  v_inv := public.issue_invoice(v_s.id, v_plan.id, p_period);
  perform public.audit(p_org, 'billing.checkout', 'invoice', v_inv.id, jsonb_build_object('plan', v_plan.code, 'period', p_period));
  return jsonb_build_object('invoice', v_inv.number, 'pay_token', public.create_pay_link(v_inv.id), 'total_xaf', v_inv.total_xaf);
end;
$$;

/** Achat d'une extension de quota : facture (réutilisée tant qu'elle est ouverte) puis lien de paiement. */
create or replace function public.extension_checkout(p_org uuid, p_pack uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.quota_packs;
  v_s public.subscriptions;
  v_org public.organizations;
  v_settings public.platform_settings;
  v_inv public.invoices;
  v_year smallint;
  v_number integer;
  v_tax integer;
  v_month date := date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date;
begin
  perform public.assert_org_admin(p_org);
  select * into v_k from public.quota_packs where id = p_pack and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_inv from public.invoices
  where organization_id = p_org and kind = 'extension' and quota_pack_id = v_k.id and status = 'open' and period_end > now()
  order by issued_at desc limit 1;
  if not found then
    select * into v_s from public.subscriptions where organization_id = p_org;
    select * into v_org from public.organizations where id = p_org;
    select * into v_settings from public.platform_settings;
    v_tax := round(v_k.price_xaf * v_settings.vat_rate / 100.0);
    v_year := extract(year from now() at time zone 'Africa/Douala')::smallint;
    insert into public.invoice_sequences as q (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = q.last_number + 1
    returning last_number into v_number;
    insert into public.invoices (number, organization_id, quota_pack_id, kind, billing_period, period_start, period_end, lines,
      subtotal_xaf, discount_xaf, vat_rate, tax_xaf, total_xaf, due_at, buyer_snapshot, seller_snapshot)
    values (format('FAC-%s-%s', v_year, lpad(v_number::text, 6, '0')), p_org, v_k.id, 'extension', 'monthly',
      now(), (((v_month + interval '1 month')::date)::timestamp at time zone 'Africa/Douala'),
      jsonb_build_array(jsonb_build_object('kind', 'extension', 'label', format('Extension de quota · %s (mois en cours)', v_k.name),
        'label_en', format('Quota extension · %s (current month)', coalesce(v_k.name_en, v_k.name)), 'quantity', 1,
        'unit_xaf', v_k.price_xaf, 'amount_xaf', v_k.price_xaf)),
      v_k.price_xaf, 0, v_settings.vat_rate, v_tax, v_k.price_xaf + v_tax, now() + interval '1 day',
      jsonb_build_object('name', v_org.name, 'phone', v_s.billing_phone_e164, 'email', v_s.billing_email,
        'city', (select city from public.branches where organization_id = p_org order by created_at limit 1)),
      jsonb_build_object('legal_name', v_settings.company_legal_name, 'rc', v_settings.company_rc, 'niu', v_settings.company_niu,
        'address', v_settings.company_address, 'phone', v_settings.company_phone, 'email', v_settings.company_email,
        'footer', v_settings.invoice_footer))
    returning * into v_inv;
  end if;
  perform public.audit(p_org, 'billing.extension_checkout', 'invoice', v_inv.id, jsonb_build_object('pack', v_k.code, 'total_xaf', v_inv.total_xaf));
  return jsonb_build_object('invoice', v_inv.number, 'pay_token', public.create_pay_link(v_inv.id), 'total_xaf', v_inv.total_xaf);
end;
$$;

/** Extension payée : ajoutée au mois en cours ; le blocage du lendemain est levé si la nouvelle limite le permet. */
create or replace function public.apply_quota_extension(p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
  v_k public.quota_packs;
  v_month date := date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date;
  v_q jsonb;
begin
  select * into v_i from public.invoices where id = p_invoice;
  select * into v_k from public.quota_packs where id = v_i.quota_pack_id;
  if v_i.organization_id is null or v_k.id is null then return; end if;
  insert into public.quota_extensions (organization_id, month, kind, quantity, pack_id, invoice_id)
  values (v_i.organization_id, v_month, v_k.kind, v_k.quantity, v_k.id, v_i.id)
  on conflict (invoice_id) do nothing;
  v_q := public.quota_status(v_i.organization_id) -> v_k.kind;
  if (v_q ->> 'used')::integer < (v_q ->> 'limit')::integer then
    update public.messaging_usage set
      tickets_reached_on = case when v_k.kind = 'tickets' then null else tickets_reached_on end,
      whatsapp_reached_on = case when v_k.kind = 'whatsapp' then null else whatsapp_reached_on end
    where organization_id = v_i.organization_id and month = v_month;
  end if;
end;
$$;

/** Résultat d'un paiement : abonnement (M10a), campagne (M10b) ou extension de quota. */
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
    perform public.audit(v_i.organization_id, 'payment.duplicate', 'payment', v_p.id, jsonb_build_object('invoice', v_i.number));
    return jsonb_build_object('status', 'succeeded', 'duplicate', true);
  end if;
  update public.invoices set status = 'paid', paid_at = now(), paid_channel = v_p.channel where id = v_i.id returning * into v_i;
  if v_i.campaign_id is not null then
    update public.ad_campaigns set status = 'active', paid_at = now() where id = v_i.campaign_id and status = 'awaiting_payment';
    perform public.audit(null, 'campaign.paid', 'ad_campaign', v_i.campaign_id,
      jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', v_p.provider));
    return jsonb_build_object('status', 'succeeded', 'invoice', v_i.number);
  end if;
  -- Extension de quota : ajoutée au mois en cours, l'abonnement ne change pas.
  if v_i.kind = 'extension' then
    perform public.apply_quota_extension(v_i.id);
    perform public.audit(v_i.organization_id, 'quota.extension_paid', 'invoice', v_i.id,
      jsonb_build_object('number', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', v_p.provider));
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

/** Facture publique d'un lien de paiement : formule (M10a), campagne (M10b) ou extension de quota. */
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
    'campaign', (select jsonb_build_object('name', c.name, 'package', pk.name, 'package_en', pk.name_en)
                 from public.ad_campaigns c join public.ad_packages pk on pk.code = c.package_code where c.id = i.campaign_id),
    'extension', (select jsonb_build_object('name', k.name, 'name_en', k.name_en, 'kind', k.kind, 'quantity', k.quantity)
                  from public.quota_packs k where k.id = i.quota_pack_id),
    'lines', i.lines,
    'expired', l.expires_at < now(),
    'payment', (select jsonb_build_object('status', y.status, 'channel', y.channel, 'external_id', y.external_id,
                  'failure_reason', y.failure_reason)
                from public.payments y where y.invoice_id = i.id order by y.created_at desc limit 1)
  )
  from public.pay_links l join public.invoices i on i.id = l.invoice_id
  where p_token ~ '^[A-Za-z0-9]{32}$' and l.token_hash = public.sha256_hex(p_token);
$$;

/** Inscription (M10a) : l'essai porte sur la formule d'essai (`trial_eligible`, Business). */
create or replace function public.self_service_signup(
  p_name text, p_slug text, p_type public.org_type, p_default_locale text, p_verification uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_v public.phone_verifications;
  v_org uuid;
  v_settings public.platform_settings;
  v_trial_plan uuid;
  v_trial boolean;
  v_sub uuid;
  v_email text;
begin
  if v_user is null or public.is_anonymous() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_v from public.phone_verifications
  where id = p_verification and user_id = v_user and verified_at is not null and used_at is null
    and verified_at > now() - interval '1 hour'
  for update;
  if not found then raise exception 'phone_not_verified' using errcode = 'P0422'; end if;
  if not public.check_rate_limit('signup:uid:' || v_user, 3, interval '1 day') then
    raise exception 'too_many_organizations' using errcode = 'P0429';
  end if;
  v_org := public.create_organization(p_name, p_slug, p_type, p_default_locale);
  update public.organizations set phone_e164 = v_v.phone_e164 where id = v_org;
  update public.phone_verifications set used_at = now(), phone_e164 = null where id = v_v.id;

  select * into v_settings from public.platform_settings;
  select id into v_trial_plan from public.plans where trial_eligible and active and not quote_only order by sort_order limit 1;
  if v_trial_plan is null then
    select id into v_trial_plan from public.plans where active and not quote_only order by sort_order limit 1;
  end if;
  select email into v_email from auth.users where id = v_user;
  insert into public.trial_claims (phone_hash, organization_id) values (v_v.phone_hash, v_org)
  on conflict (phone_hash) do nothing;
  v_trial := found;
  insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at, read_only_since, billing_phone_e164, billing_email, locale)
  values (v_org, v_trial_plan, case when v_trial then 'trialing' else 'read_only' end::public.subscription_status,
    case when v_trial then now() + make_interval(days => v_settings.trial_days) end,
    case when v_trial then null else now() end,
    v_v.phone_e164, v_email, case when p_default_locale = 'en' then 'en' else 'fr' end)
  returning id into v_sub;
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_sub, v_org, case when v_trial then 'trial_started' else 'no_trial' end, v_user,
    jsonb_build_object('trial_days', case when v_trial then v_settings.trial_days else 0 end));
  perform public.audit(v_org, 'subscription.create', 'subscription', v_sub, jsonb_build_object('trial', v_trial));
  return jsonb_build_object('organization_id', v_org, 'trial', v_trial);
end;
$$;

/** Formule d'essai proposée à l'inscription (nom, pour l'assistant). */
create or replace function public.trial_plan()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('code', code, 'name', name, 'name_en', name_en)
  from public.plans where trial_eligible and active and not quote_only order by sort_order limit 1;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Console Wintek
-- ═════════════════════════════════════════════════════════════════════════════

/** Édition d'une formule (prix, limites, fonctions, quotas, devis). Ne touche pas aux factures déjà émises. */
create or replace function public.admin_update_plan(p_plan uuid, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  update public.plans set
    name = coalesce(p_fields ->> 'name', name),
    name_en = coalesce(p_fields ->> 'name_en', name_en),
    description = coalesce(p_fields ->> 'description', description),
    base_price_xaf = coalesce((p_fields ->> 'base_price_xaf')::integer, base_price_xaf),
    included_branches = coalesce((p_fields ->> 'included_branches')::smallint, included_branches),
    extra_branch_price_xaf = case when p_fields ? 'extra_branch_price_xaf' then (p_fields ->> 'extra_branch_price_xaf')::integer else extra_branch_price_xaf end,
    max_services = case when p_fields ? 'max_services' then (p_fields ->> 'max_services')::smallint else max_services end,
    max_counters = case when p_fields ? 'max_counters' then (p_fields ->> 'max_counters')::smallint else max_counters end,
    max_displays = case when p_fields ? 'max_displays' then (p_fields ->> 'max_displays')::smallint else max_displays end,
    max_users = case when p_fields ? 'max_users' then (p_fields ->> 'max_users')::smallint else max_users end,
    tickets_per_month = case when p_fields ? 'tickets_per_month' then (p_fields ->> 'tickets_per_month')::integer else tickets_per_month end,
    whatsapp_quota = case when p_fields ? 'whatsapp_quota' then (p_fields ->> 'whatsapp_quota')::integer else whatsapp_quota end,
    history_months = case when p_fields ? 'history_months' then (p_fields ->> 'history_months')::smallint else history_months end,
    annual_free_months = coalesce((p_fields ->> 'annual_free_months')::smallint, annual_free_months),
    quote_only = coalesce((p_fields ->> 'quote_only')::boolean, quote_only),
    trial_eligible = coalesce((p_fields ->> 'trial_eligible')::boolean, trial_eligible),
    features = case when p_fields ? 'features' then features || (p_fields -> 'features') else features end,
    active = coalesce((p_fields ->> 'active')::boolean, active)
  where id = p_plan;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.audit(null, 'plan.update', 'plan', p_plan, p_fields);
end;
$$;

/**
 * Limites sur mesure d'un client (formule sur devis) : seules les clés connues sont gardées ; valeur entière ou null
 * (illimité). Motif obligatoire, journalisé.
 */
create or replace function public.admin_set_limits(p_subscription uuid, p_limits jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
  v_clean jsonb;
begin
  perform public.assert_platform_admin();
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  select * into v_s from public.subscriptions where id = p_subscription for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_clean
  from jsonb_each(coalesce(p_limits, '{}'::jsonb))
  where key in ('included_branches', 'max_services', 'max_counters', 'max_displays', 'max_users', 'tickets_per_month', 'whatsapp_quota', 'history_months')
    and (jsonb_typeof(value) = 'null' or (jsonb_typeof(value) = 'number' and (value #>> '{}')::numeric >= 0));
  update public.subscriptions set limit_overrides = v_clean where id = v_s.id;
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_s.id, v_s.organization_id, 'limits_set', (select auth.uid()), jsonb_build_object('limits', v_clean, 'reason', p_reason));
  perform public.audit(v_s.organization_id, 'subscription.limits', 'subscription', v_s.id, jsonb_build_object('limits', v_clean, 'reason', p_reason));
end;
$$;

/** Création ou édition d'une extension de quota (produit vendu à l'unité). */
create or replace function public.admin_save_quota_pack(p_pack uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_platform_admin();
  if p_pack is null then
    insert into public.quota_packs (code, kind, quantity, price_xaf, name, name_en, active, sort_order)
    values (p_fields ->> 'code', p_fields ->> 'kind', (p_fields ->> 'quantity')::integer, (p_fields ->> 'price_xaf')::integer,
      p_fields ->> 'name', p_fields ->> 'name_en', coalesce((p_fields ->> 'active')::boolean, true),
      coalesce((p_fields ->> 'sort_order')::smallint, 0))
    returning id into v_id;
  else
    update public.quota_packs set
      quantity = coalesce((p_fields ->> 'quantity')::integer, quantity),
      price_xaf = coalesce((p_fields ->> 'price_xaf')::integer, price_xaf),
      name = coalesce(p_fields ->> 'name', name),
      name_en = coalesce(p_fields ->> 'name_en', name_en),
      active = coalesce((p_fields ->> 'active')::boolean, active),
      sort_order = coalesce((p_fields ->> 'sort_order')::smallint, sort_order)
    where id = p_pack returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  end if;
  perform public.audit(null, 'quota_pack.save', 'quota_pack', v_id, p_fields);
  return v_id;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Sécurité
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.quota_packs enable row level security;
alter table public.quota_extensions enable row level security;
revoke all on public.quota_packs, public.quota_extensions from anon, authenticated;
grant select on public.quota_packs, public.quota_extensions to authenticated;
-- Extensions vendues : lues par le personnel via les RPC ; le super admin voit tout.
create policy quota_packs_select on public.quota_packs for select to authenticated using (public.is_platform_admin());
create policy quota_extensions_select on public.quota_extensions for select to authenticated
  using (public.has_org_role(organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin());

revoke execute on function public.quota_item(integer, integer, integer, date, date), public.quota_status(uuid),
  public.quota_progress(uuid, text), public.count_ticket_usage(), public.org_user_count(uuid), public.stats_history_start(uuid),
  public.apply_quota_extension(uuid), public.staff_quota_status(uuid), public.extension_checkout(uuid, uuid), public.trial_plan(),
  public.admin_set_limits(uuid, jsonb, text), public.admin_save_quota_pack(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.staff_quota_status(uuid), public.extension_checkout(uuid, uuid), public.trial_plan(),
  public.admin_set_limits(uuid, jsonb, text), public.admin_save_quota_pack(uuid, jsonb) to authenticated;
