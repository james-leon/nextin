-- M10a — Abonnements automatiques (docs/PLAN.md §11) : formules et réglages de la plateforme (modifiables par le super
-- admin, jamais lus depuis le code), abonnements, essai, factures numérotées sans trou, paiements Mobile Money
-- idempotents, cycle de vie avec dégradations différées après la fermeture, limites des formules, messages du compte
-- (code de vérification, rappels, confirmations), console super admin.

-- ═════════════════════════════════════════════════════════════════════════════
-- Réglages de la plateforme et formules
-- ═════════════════════════════════════════════════════════════════════════════

create table public.platform_settings (
  id boolean primary key default true check (id),
  -- Mentions légales de Wintek sur les factures (saisies par le super admin).
  company_legal_name text not null default '' check (char_length(company_legal_name) <= 160),
  company_rc text not null default '' check (char_length(company_rc) <= 60),
  company_niu text not null default '' check (char_length(company_niu) <= 60),
  company_address text not null default '' check (char_length(company_address) <= 240),
  company_phone text not null default '' check (char_length(company_phone) <= 40),
  company_email text not null default '' check (char_length(company_email) <= 120),
  invoice_footer text not null default '' check (char_length(invoice_footer) <= 500),
  trial_days smallint not null default 14 check (trial_days between 0 and 90),
  grace_days smallint not null default 7 check (grace_days between 0 and 60),
  -- Lecture seule pendant N jours, puis suspension.
  read_only_days smallint not null default 7 check (read_only_days between 1 and 60),
  retention_after_suspension_days smallint not null default 30 check (retention_after_suspension_days between 7 and 365),
  default_closing_time time not null default '22:00',
  -- TVA (0 : Wintek non assujettie ; prix des formules hors taxe).
  vat_rate numeric(5, 2) not null default 0 check (vat_rate between 0 and 50),
  -- Facture de renouvellement émise N jours avant l'échéance.
  invoice_lead_days smallint not null default 7 check (invoice_lead_days between 1 and 30),
  quota_alert_percent smallint not null default 80 check (quota_alert_percent between 50 and 100),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  name_en text check (char_length(name_en) <= 60),
  description text check (char_length(description) <= 240),
  description_en text check (char_length(description_en) <= 240),
  -- Prix mensuel (FCFA, hors taxe) pour `included_branches` agences.
  base_price_xaf integer not null check (base_price_xaf >= 0),
  included_branches smallint not null check (included_branches >= 1),
  -- Prix mensuel d'une agence en plus ; null : pas d'agence au-delà des agences incluses.
  extra_branch_price_xaf integer check (extra_branch_price_xaf >= 0),
  -- null : illimité.
  max_counters_per_branch smallint check (max_counters_per_branch >= 1),
  max_displays_per_branch smallint check (max_displays_per_branch >= 0),
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  whatsapp_quota_per_branch integer not null default 0 check (whatsapp_quota_per_branch >= 0),
  annual_free_months smallint not null default 2 check (annual_free_months between 0 and 11),
  trial_eligible boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);
create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();

-- Valeurs initiales (§11.8) : modifiables par le super admin.
insert into public.plans (code, name, name_en, description, description_en, base_price_xaf, included_branches, extra_branch_price_xaf,
  max_counters_per_branch, max_displays_per_branch, features, whatsapp_quota_per_branch, trial_eligible, sort_order)
values
  ('essentiel', 'Essentiel', 'Essential', 'Une file bien tenue : QR code, postes, écran TV, alertes.',
   'A well-run queue: QR code, desks, TV screen, alerts.', 25000, 1, 25000, 3, 1,
   '{"voice_announcements": false, "appointments": false, "remote_tickets": false, "advanced_stats": false, "export": false, "dedicated_support": false}',
   1500, false, 1),
  ('pro', 'Pro', 'Pro', 'Annonces vocales, rendez-vous, ticket à distance, statistiques avancées.',
   'Voice announcements, appointments, remote tickets, advanced statistics.', 45000, 1, 45000, 10, 3,
   '{"voice_announcements": true, "appointments": true, "remote_tickets": true, "advanced_stats": true, "export": false, "dedicated_support": false}',
   4000, true, 2),
  ('entreprise', 'Entreprise', 'Enterprise', 'Tout Pro, guichets et écrans illimités, export, support dédié.',
   'Everything in Pro, unlimited desks and screens, export, dedicated support.', 120000, 3, 35000, null, null,
   '{"voice_announcements": true, "appointments": true, "remote_tickets": true, "advanced_stats": true, "export": true, "dedicated_support": true}',
   6000, false, 3);

-- ═════════════════════════════════════════════════════════════════════════════
-- Abonnements, essais, vérification du téléphone
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.organizations
  -- Téléphone vérifié du compte (rappels, factures) et progression de l'assistant de démarrage (§11.3).
  add column phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  add column onboarding_step smallint not null default 0 check (onboarding_step between 0 and 5);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  -- null : code promo valable pour tout établissement.
  organization_id uuid references public.organizations (id) on delete cascade,
  code text unique check (code ~ '^[A-Z0-9-]{3,30}$'),
  kind text not null check (kind in ('percent', 'fixed_xaf')),
  value integer not null check (value > 0),
  remaining_invoices smallint not null default 1 check (remaining_invoices >= 0),
  expires_at timestamptz,
  reason text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (organization_id is not null or code is not null)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  billing_period public.billing_period not null default 'monthly',
  status public.subscription_status not null,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  read_only_since timestamptz,
  suspended_since timestamptz,
  deletion_due_at timestamptz,
  -- Dégradation différée (§11.4) : appliquée après la fermeture de toutes les agences.
  pending_status public.subscription_status,
  pending_status_after timestamptz,
  -- Changement vers une formule inférieure, appliqué au prochain renouvellement.
  next_plan_id uuid references public.plans (id),
  discount_id uuid references public.discounts (id) on delete set null,
  billing_phone_e164 text check (billing_phone_e164 ~ '^\+237[26][0-9]{8}$'),
  billing_email text check (char_length(billing_email) <= 254),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_status_idx on public.subscriptions (status, current_period_end);
create index subscriptions_pending_idx on public.subscriptions (pending_status_after) where pending_status is not null;
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  type text not null check (type in ('trial_started', 'no_trial', 'invoice_issued', 'paid', 'renewed', 'grace_started', 'read_only',
    'suspended', 'reactivated', 'days_granted', 'discount_applied', 'plan_changed', 'plan_change_scheduled', 'deleted', 'moderation')),
  actor_user_id uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index subscription_events_sub_idx on public.subscription_events (subscription_id, created_at desc);
create index subscription_events_type_idx on public.subscription_events (type, created_at);

-- Un seul essai par numéro (empreinte salée) et par établissement.
create table public.trial_claims (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  organization_id uuid unique references public.organizations (id) on delete set null,
  claimed_at timestamptz not null default now()
);

create table public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Numéro en clair seulement jusqu'à l'utilisation (inscription), puis effacé.
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  code_hash text,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index phone_verifications_user_idx on public.phone_verifications (user_id, created_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- Factures, liens de paiement, paiements
-- ═════════════════════════════════════════════════════════════════════════════

create table public.invoice_sequences (
  year smallint primary key,
  last_number integer not null default 0
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  -- FAC-AAAA-NNNNNN, attribué à l'émission, sans trou.
  number text not null unique check (number ~ '^FAC-[0-9]{4}-[0-9]{6}$'),
  -- Conservées après la suppression d'un établissement (obligation comptable) : identité figée dans buyer_snapshot.
  organization_id uuid references public.organizations (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  plan_id uuid references public.plans (id),
  kind text not null check (kind in ('renewal', 'upgrade')),
  billing_period public.billing_period not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  subtotal_xaf integer not null check (subtotal_xaf >= 0),
  discount_xaf integer not null default 0 check (discount_xaf >= 0),
  vat_rate numeric(5, 2) not null default 0,
  tax_xaf integer not null default 0 check (tax_xaf >= 0),
  total_xaf integer not null check (total_xaf >= 0),
  status public.invoice_status not null default 'open',
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  paid_at timestamptz,
  paid_channel public.payment_channel,
  buyer_snapshot jsonb not null,
  seller_snapshot jsonb not null,
  check (period_end > period_start)
);
create index invoices_org_idx on public.invoices (organization_id, issued_at desc);
create index invoices_open_idx on public.invoices (subscription_id) where status = 'open';

-- Une facture n'est jamais supprimée ; une fois émise, seuls son statut et son paiement changent.
create or replace function public.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'invoices are never deleted' using errcode = '42501';
  end if;
  if (new.number, new.kind, new.billing_period, new.period_start, new.period_end, new.lines, new.subtotal_xaf, new.discount_xaf,
      new.vat_rate, new.tax_xaf, new.total_xaf, new.issued_at, new.buyer_snapshot, new.seller_snapshot)
     is distinct from
     (old.number, old.kind, old.billing_period, old.period_start, old.period_end, old.lines, old.subtotal_xaf, old.discount_xaf,
      old.vat_rate, old.tax_xaf, old.total_xaf, old.issued_at, old.buyer_snapshot, old.seller_snapshot) then
    raise exception 'issued invoices are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger invoices_guard before update or delete on public.invoices for each row execute function public.invoices_guard();

-- Liens de paiement {APP_URL}/pay/<jeton> : jeton en clair dans le message seulement, empreinte en base.
create table public.pay_links (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  invoice_id uuid not null references public.invoices (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index pay_links_invoice_idx on public.pay_links (invoice_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  provider public.payment_provider not null,
  channel public.payment_channel not null,
  msisdn_masked text not null check (char_length(msisdn_masked) <= 24),
  amount_xaf integer not null check (amount_xaf > 0),
  status public.payment_status not null default 'pending',
  -- Référence NextIn transmise à l'agrégateur (idempotence des webhooks).
  external_id text not null unique check (external_id ~ '^nx_[A-Za-z0-9]{20}$'),
  provider_ref text,
  failure_reason text check (char_length(failure_reason) <= 200),
  raw jsonb,
  confirmed_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_pending_idx on public.payments (created_at) where status = 'pending';
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();

-- Webhooks des agrégateurs de paiement : même journal idempotent que WhatsApp (M7).
alter table public.provider_webhook_events drop constraint provider_webhook_events_provider_check;
alter table public.provider_webhook_events add constraint provider_webhook_events_provider_check
  check (provider in ('whatsapp', 'fake', 'notchpay', 'fapshi', 'mesomb', 'cinetpay', 'flutterwave'));

-- ═════════════════════════════════════════════════════════════════════════════
-- Rappels, quotas, messages du compte
-- ═════════════════════════════════════════════════════════════════════════════

create table public.billing_reminders (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  kind text not null check (kind in ('trial_end', 'period_end', 'grace', 'deletion')),
  offset_days smallint not null,
  target_date date not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  sent_at timestamptz not null default now(),
  unique (subscription_id, kind, offset_days, target_date, channel)
);

create table public.messaging_usage (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  whatsapp_sent integer not null default 0,
  sms_sent integer not null default 0,
  alerted_at timestamptz,
  primary key (organization_id, month)
);

/**
 * Messages du compte (hors file d'attente) : code de vérification, rappels d'abonnement, paiement confirmé, facture,
 * alerte de quota, avis de suppression. Mis en file par la base, envoyés par l'expéditeur des notifications (M7).
 */
create table public.account_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  kind text not null check (kind in ('phone_code', 'billing_reminder', 'payment_confirmed', 'invoice_available', 'quota_alert',
    'deletion_notice')),
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  to_phone text check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  to_email text check (char_length(to_email) <= 254),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  -- Données du message (ex. code de vérification, montant, lien de paiement). Code effacé après usage.
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  attempt smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  dedupe_key text not null unique,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel = 'email' and to_email is not null) or (channel <> 'email' and to_phone is not null))
);
create index account_messages_due_idx on public.account_messages (next_attempt_at) where status in ('pending', 'sending');
create trigger account_messages_set_updated_at before update on public.account_messages for each row execute function public.set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- Tarification et droits
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Prix d'une période (FCFA, hors taxe), miroir exact de `computeSubscriptionPrice` (packages/shared/src/billing) :
 * mensuel = base + max(0, agences − incluses) × prix par agence ; annuel = mensuel × (12 − mois offerts) ;
 * remise ensuite (pourcentage arrondi à l'entier, ou montant plafonné au prix).
 */
create or replace function public.subscription_price(
  p_base integer, p_included integer, p_extra integer, p_free_months integer, p_branches integer,
  p_period public.billing_period, p_discount_kind text default null, p_discount_value integer default null
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_extra_count integer := greatest(0, coalesce(p_branches, 1) - p_included);
  v_monthly integer := p_base + v_extra_count * coalesce(p_extra, 0);
  v_months integer := case when p_period = 'annual' then 12 - p_free_months else 1 end;
  v_subtotal integer := v_monthly * v_months;
  v_discount integer := 0;
begin
  if p_discount_kind = 'percent' then
    v_discount := round(v_subtotal * least(greatest(p_discount_value, 0), 100) / 100.0);
  elsif p_discount_kind = 'fixed_xaf' then
    v_discount := least(v_subtotal, greatest(p_discount_value, 0));
  end if;
  return jsonb_build_object('monthly', v_monthly, 'months', v_months, 'extra_branches', v_extra_count,
    'subtotal', v_subtotal, 'discount', v_discount, 'total', v_subtotal - v_discount);
end;
$$;

/** Agences actives d'un établissement (base du prix). */
create or replace function public.billable_branches(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(1, count(*)::integer) from public.branches where organization_id = p_org and active;
$$;

/**
 * Droits d'un établissement : formule, statut, limites et fonctions. Pendant l'essai : formule Pro. Établissements créés
 * avant le M10a (« pilotes », sans abonnement) : tout compris (formule Entreprise), comme avant.
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
      (select case when s.status = 'trialing' then (select id from public.plans where code = 'pro') else s.plan_id end from s),
      (select id from public.plans where code = 'entreprise'))
  )
  select jsonb_build_object(
    'pilot', not exists (select 1 from s),
    'plan_code', (select code from p),
    'subscribed_plan_code', (select pl.code from s join public.plans pl on pl.id = s.plan_id),
    'status', coalesce((select status::text from s), 'active'),
    'can_issue', coalesce((select status not in ('read_only', 'suspended') from s), true),
    'included_branches', (select included_branches from p),
    'extra_branch_price_xaf', (select extra_branch_price_xaf from p),
    'max_counters_per_branch', (select max_counters_per_branch from p),
    'max_displays_per_branch', (select max_displays_per_branch from p),
    'whatsapp_quota', (select whatsapp_quota_per_branch from p) * public.billable_branches(p_org),
    'features', (select features from p)
  );
$$;

/** Droits de l'établissement pour son personnel (menus, bandeaux) ; `not_allowed` sinon. */
create or replace function public.staff_entitlements(p_org uuid)
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
  return public.org_entitlements(p_org);
end;
$$;

/** Fonction de la formule disponible ? Sinon erreur `feature_unavailable` (détail : la fonction). */
create or replace function public.assert_feature(p_org uuid, p_feature text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((public.org_entitlements(p_org) -> 'features' ->> p_feature)::boolean, false) then
    raise exception 'feature_unavailable' using errcode = 'P0403', detail = p_feature;
  end if;
end;
$$;

/** Limites des formules, vérifiées par la base : agences, guichets et écrans par agence. */
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e jsonb;
  v_count integer;
begin
  v_e := public.org_entitlements(new.organization_id);
  if tg_table_name = 'branches' then
    if new.active and (tg_op = 'INSERT' or not old.active) and (v_e ->> 'extra_branch_price_xaf') is null then
      select count(*) into v_count from public.branches where organization_id = new.organization_id and active and id <> new.id;
      if v_count >= (v_e ->> 'included_branches')::integer then
        raise exception 'plan_limit' using errcode = 'P0403', detail = 'branches';
      end if;
    end if;
  elsif tg_table_name = 'counters' then
    if new.active and (tg_op = 'INSERT' or not old.active) and (v_e ->> 'max_counters_per_branch') is not null then
      select count(*) into v_count from public.counters where branch_id = new.branch_id and active and id <> new.id;
      if v_count >= (v_e ->> 'max_counters_per_branch')::integer then
        raise exception 'plan_limit' using errcode = 'P0403', detail = 'counters';
      end if;
    end if;
  elsif tg_table_name = 'displays' then
    if new.status = 'active' and new.branch_id is not null and (tg_op = 'INSERT' or old.status <> 'active')
       and (v_e ->> 'max_displays_per_branch') is not null then
      select count(*) into v_count from public.displays where branch_id = new.branch_id and status = 'active' and id <> new.id;
      if v_count >= (v_e ->> 'max_displays_per_branch')::integer then
        raise exception 'plan_limit' using errcode = 'P0403', detail = 'displays';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger branches_plan_limits before insert or update of active on public.branches
  for each row execute function public.enforce_plan_limits();
create trigger counters_plan_limits before insert or update of active on public.counters
  for each row execute function public.enforce_plan_limits();
create trigger displays_plan_limits before insert or update of status, branch_id on public.displays
  for each row execute function public.enforce_plan_limits();

/**
 * Émission de tickets et rendez-vous selon l'abonnement : rien en lecture seule ou suspendu (`subscription_read_only`) ;
 * ticket à distance et rendez-vous seulement si la formule les comprend.
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
    if new.source = 'remote' then
      perform public.assert_feature(new.organization_id, 'remote_tickets');
    end if;
  elsif tg_table_name in ('appointments', 'appointment_requests') then
    perform public.assert_feature(new.organization_id, 'appointments');
  end if;
  return new;
end;
$$;
create trigger tickets_subscription before insert on public.tickets
  for each row execute function public.enforce_subscription_on_write();
create trigger appointments_subscription before insert on public.appointments
  for each row execute function public.enforce_subscription_on_write();
create trigger appointment_requests_subscription before insert on public.appointment_requests
  for each row execute function public.enforce_subscription_on_write();

-- ═════════════════════════════════════════════════════════════════════════════
-- Messages du compte
-- ═════════════════════════════════════════════════════════════════════════════

/** Met un message du compte en file (WhatsApp + e-mail si une adresse est connue) et réveille l'expéditeur. */
create or replace function public.enqueue_account_message(
  p_org uuid, p_kind text, p_dedupe text, p_payload jsonb, p_phone text, p_email text, p_locale text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_n integer;
begin
  if p_phone is not null then
    insert into public.account_messages (organization_id, kind, channel, to_phone, locale, payload, dedupe_key)
    values (p_org, p_kind, 'whatsapp', p_phone, coalesce(p_locale, 'fr'), p_payload, p_dedupe || ':whatsapp')
    on conflict (dedupe_key) do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end if;
  if p_email is not null and p_kind <> 'phone_code' then
    insert into public.account_messages (organization_id, kind, channel, to_email, locale, payload, dedupe_key)
    values (p_org, p_kind, 'email', p_email, coalesce(p_locale, 'fr'), p_payload, p_dedupe || ':email')
    on conflict (dedupe_key) do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end if;
  if v_count > 0 then perform public.kick_notification_dispatch(); end if;
  return v_count;
end;
$$;

/** Expéditeur : messages du compte dus (SKIP LOCKED), repris après 2 minutes s'ils restent « en cours ». */
create or replace function public.claim_account_messages(p_limit integer default 20)
returns setof public.account_messages
language sql
security definer
set search_path = ''
as $$
  update public.account_messages m set status = 'sending', attempt = m.attempt + 1
  from (
    select id from public.account_messages
    where (status = 'pending' and next_attempt_at <= now()) or (status = 'sending' and updated_at < now() - interval '2 minutes')
    order by next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ) picked
  where m.id = picked.id
  returning m.*;
$$;

/**
 * Résultat d'un envoi. Le texte du code de vérification n'est jamais enregistré. Échec définitif sur WhatsApp d'un code
 * ou d'un rappel : SMS de secours.
 */
create or replace function public.complete_account_message(
  p_message uuid, p_status text, p_error text default null, p_retry_in_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.account_messages;
begin
  update public.account_messages set
    status = case when p_retry_in_seconds is not null then 'pending' else p_status end,
    next_attempt_at = case when p_retry_in_seconds is not null then now() + make_interval(secs => p_retry_in_seconds) else next_attempt_at end,
    error = left(p_error, 500),
    sent_at = case when p_status = 'sent' and p_retry_in_seconds is null then now() else sent_at end
  where id = p_message
  returning * into v_m;
  if v_m.status = 'failed' and v_m.channel = 'whatsapp' and v_m.kind in ('phone_code', 'billing_reminder', 'deletion_notice') then
    insert into public.account_messages (organization_id, kind, channel, to_phone, locale, payload, dedupe_key)
    values (v_m.organization_id, v_m.kind, 'sms', v_m.to_phone, v_m.locale, v_m.payload, 'sms:' || v_m.id)
    on conflict (dedupe_key) do nothing;
    perform public.kick_notification_dispatch();
  end if;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Inscription en libre-service (§11.1, §11.2)
-- ═════════════════════════════════════════════════════════════════════════════

/** Empreinte salée d'un numéro (un seul essai par numéro). */
create or replace function public.phone_fingerprint(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.sha256_hex('nextin-trial:' || p_phone);
$$;

/**
 * Code de vérification du téléphone du directeur (serveur de l'application, après captcha) : 6 chiffres, 10 minutes,
 * 5 essais, 3 codes par heure et par numéro. Envoyé par WhatsApp (SMS en secours). Renvoie l'identifiant à vérifier.
 */
create or replace function public.request_phone_code(p_user uuid, p_phone text, p_locale text default 'fr')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.random_string(6, '0123456789');
  v_id uuid;
begin
  if p_user is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_phone is null or p_phone !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  if not public.check_rate_limit('phone_code:' || public.phone_fingerprint(p_phone), 3, interval '1 hour')
     or not public.check_rate_limit('phone_code:uid:' || p_user, 6, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  insert into public.phone_verifications (user_id, phone_e164, phone_hash, code_hash, expires_at)
  values (p_user, p_phone, public.phone_fingerprint(p_phone), '', now() + interval '10 minutes')
  returning id into v_id;
  update public.phone_verifications set code_hash = public.sha256_hex(v_code || ':' || v_id) where id = v_id;
  perform public.enqueue_account_message(null, 'phone_code', 'phone_code:' || v_id, jsonb_build_object('code', v_code),
    p_phone, null, case when p_locale = 'en' then 'en' else 'fr' end);
  return v_id;
end;
$$;

/** Code de vérification encore lisible dans la file d'envoi : effacé. */
create or replace function public.clear_phone_code(p_verification uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_messages set payload = payload - 'code'
  where kind = 'phone_code' and dedupe_key like 'phone_code:' || p_verification || ':%' and payload ? 'code';
  update public.account_messages set payload = payload - 'code'
  where kind = 'phone_code' and channel = 'sms' and payload ? 'code' and dedupe_key in (
    select 'sms:' || id from public.account_messages where dedupe_key like 'phone_code:' || p_verification || ':%');
$$;

/** Vérification du code par le directeur connecté. Erreur `code_expired` ; mauvais code : { error, attempts_left }. */
create or replace function public.verify_phone_code(p_verification uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.phone_verifications;
begin
  select * into v_v from public.phone_verifications where id = p_verification and user_id = (select auth.uid()) for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_v.verified_at is not null then return jsonb_build_object('verified', true); end if;
  if v_v.expires_at < now() or v_v.attempts >= 5 then raise exception 'code_expired' using errcode = 'P0409'; end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$' or public.sha256_hex(p_code || ':' || v_v.id) <> v_v.code_hash then
    update public.phone_verifications set attempts = attempts + 1 where id = v_v.id;
    return jsonb_build_object('error', 'code_invalid', 'attempts_left', greatest(0, 4 - v_v.attempts));
  end if;
  update public.phone_verifications set verified_at = now(), code_hash = null where id = v_v.id;
  perform public.clear_phone_code(v_v.id);
  return jsonb_build_object('verified', true);
end;
$$;

/**
 * Inscription d'un établissement (§11.1) : téléphone vérifié depuis moins d'une heure par le directeur connecté,
 * organisation active, directeur administrateur, abonnement. Essai Pro de `trial_days` jours si le numéro n'a jamais
 * servi à un essai ; sinon, l'établissement est créé en lecture seule et doit payer pour émettre des tickets.
 */
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
  v_pro uuid;
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
  select id into v_pro from public.plans where code = 'pro';
  select email into v_email from auth.users where id = v_user;
  insert into public.trial_claims (phone_hash, organization_id) values (v_v.phone_hash, v_org)
  on conflict (phone_hash) do nothing;
  v_trial := found;
  insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at, read_only_since, billing_phone_e164, billing_email, locale)
  values (v_org, v_pro, case when v_trial then 'trialing' else 'read_only' end::public.subscription_status,
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

-- ═════════════════════════════════════════════════════════════════════════════
-- Factures et paiements
-- ═════════════════════════════════════════════════════════════════════════════

/** Remise applicable à un établissement (la plus récente, encore valable). */
create or replace function public.active_discount(p_org uuid)
returns public.discounts
language sql
stable
security definer
set search_path = ''
as $$
  select d.* from public.discounts d
  where d.organization_id = p_org and d.remaining_invoices > 0 and (d.expires_at is null or d.expires_at > now())
  order by d.created_at desc limit 1;
$$;

/** Nouveau lien de paiement (30 jours) ; renvoie le jeton en clair, une seule fois. */
create or replace function public.create_pay_link(p_invoice uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := public.random_string(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
begin
  insert into public.pay_links (token_hash, invoice_id, expires_at)
  values (public.sha256_hex(v_token), p_invoice, now() + interval '30 days');
  return v_token;
end;
$$;

/**
 * Émission (ou réutilisation) de la facture de la prochaine période : formule (ou formule demandée, `p_plan`),
 * période, agences, remise, TVA ; numéro FAC-AAAA-NNNNNN sans trou (verrou de l'année). Montée de formule : nouvelle
 * période à partir de maintenant, avec un avoir pour les jours restants de la période payée. Renvoie la facture.
 */
create or replace function public.issue_invoice(
  p_subscription uuid, p_plan uuid default null, p_period public.billing_period default null
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
  v_settings public.platform_settings;
  v_plan public.plans;
  v_current public.plans;
  v_period public.billing_period;
  v_kind text;
  v_start timestamptz;
  v_end timestamptz;
  v_branches integer;
  v_d public.discounts;
  v_price jsonb;
  v_credit integer := 0;
  v_lines jsonb;
  v_subtotal integer;
  v_discount integer;
  v_tax integer;
  v_year smallint;
  v_number integer;
  v_org public.organizations;
  v_inv public.invoices;
  v_last public.invoices;
begin
  select * into v_s from public.subscriptions where id = p_subscription for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_settings from public.platform_settings;
  select * into v_current from public.plans where id = v_s.plan_id;
  select * into v_plan from public.plans where id = coalesce(p_plan, v_s.next_plan_id, v_s.plan_id) and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  v_period := coalesce(p_period, v_s.billing_period);
  -- Montée de formule pendant une période payée : facturée tout de suite, au prorata.
  v_kind := case when v_s.status in ('active', 'past_due') and v_plan.base_price_xaf > v_current.base_price_xaf then 'upgrade' else 'renewal' end;

  -- Facture ouverte identique (même formule et période) : réutilisée.
  select * into v_inv from public.invoices
  where subscription_id = v_s.id and status = 'open' and plan_id = v_plan.id and billing_period = v_period and kind = v_kind
  order by issued_at desc limit 1;
  if found then return v_inv; end if;
  -- Les autres factures ouvertes sont annulées (une seule facture à payer à la fois).
  update public.invoices set status = 'void' where subscription_id = v_s.id and status = 'open';

  v_start := case
    when v_kind = 'renewal' and v_s.status in ('active', 'past_due', 'trialing') and v_s.current_period_end > now() - make_interval(days => v_settings.grace_days)
      then greatest(v_s.current_period_end, now())
    when v_kind = 'renewal' and v_s.status = 'trialing' then greatest(v_s.trial_ends_at, now())
    else now() end;
  v_start := coalesce(v_start, now());
  v_end := v_start + case when v_period = 'annual' then interval '1 year' else interval '1 month' end;
  v_branches := public.billable_branches(v_s.organization_id);
  v_d := public.active_discount(v_s.organization_id);
  v_price := public.subscription_price(v_plan.base_price_xaf, v_plan.included_branches, v_plan.extra_branch_price_xaf,
    v_plan.annual_free_months, v_branches, v_period, v_d.kind, v_d.value);

  v_lines := jsonb_build_array(jsonb_build_object(
    'label', v_plan.name, 'label_en', coalesce(v_plan.name_en, v_plan.name), 'kind', 'plan',
    'quantity', (v_price ->> 'months')::integer, 'unit_xaf', v_plan.base_price_xaf,
    'amount_xaf', v_plan.base_price_xaf * (v_price ->> 'months')::integer, 'included_branches', v_plan.included_branches));
  if (v_price ->> 'extra_branches')::integer > 0 then
    v_lines := v_lines || jsonb_build_object('kind', 'extra_branches', 'label', 'Agences supplémentaires', 'label_en', 'Additional branches',
      'quantity', (v_price ->> 'extra_branches')::integer * (v_price ->> 'months')::integer,
      'unit_xaf', v_plan.extra_branch_price_xaf,
      'amount_xaf', (v_price ->> 'extra_branches')::integer * (v_price ->> 'months')::integer * v_plan.extra_branch_price_xaf);
  end if;
  if v_period = 'annual' and v_plan.annual_free_months > 0 then
    v_lines := v_lines || jsonb_build_object('kind', 'annual_note', 'label', format('Paiement annuel : %s mois offerts', v_plan.annual_free_months),
      'label_en', format('Annual payment: %s months free', v_plan.annual_free_months), 'amount_xaf', 0);
  end if;
  v_subtotal := (v_price ->> 'subtotal')::integer;
  v_discount := (v_price ->> 'discount')::integer;
  if v_discount > 0 then
    v_lines := v_lines || jsonb_build_object('kind', 'discount', 'label', coalesce('Remise · ' || v_d.reason, 'Remise'),
      'label_en', coalesce('Discount · ' || v_d.reason, 'Discount'), 'amount_xaf', -v_discount);
    update public.discounts set remaining_invoices = remaining_invoices - 1 where id = v_d.id;
  end if;
  -- Montée de formule : avoir des jours restants de la dernière période payée.
  if v_kind = 'upgrade' then
    select * into v_last from public.invoices where subscription_id = v_s.id and status = 'paid' order by paid_at desc limit 1;
    if found and v_s.current_period_end > now() then
      v_credit := least(v_subtotal - v_discount, floor(v_last.total_xaf * extract(epoch from v_s.current_period_end - now())
        / extract(epoch from v_last.period_end - v_last.period_start))::integer);
      if v_credit > 0 then
        v_lines := v_lines || jsonb_build_object('kind', 'credit', 'label', 'Avoir : période en cours non utilisée',
          'label_en', 'Credit: unused current period', 'amount_xaf', -v_credit);
        v_discount := v_discount + v_credit;
      end if;
    end if;
  end if;
  v_tax := round((v_subtotal - v_discount) * v_settings.vat_rate / 100.0);

  v_year := extract(year from now() at time zone 'Africa/Douala')::smallint;
  insert into public.invoice_sequences as q (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = q.last_number + 1
  returning last_number into v_number;
  select * into v_org from public.organizations where id = v_s.organization_id;

  insert into public.invoices (number, organization_id, subscription_id, plan_id, kind, billing_period, period_start, period_end,
    lines, subtotal_xaf, discount_xaf, vat_rate, tax_xaf, total_xaf, due_at, buyer_snapshot, seller_snapshot)
  values (format('FAC-%s-%s', v_year, lpad(v_number::text, 6, '0')), v_s.organization_id, v_s.id, v_plan.id, v_kind, v_period,
    v_start, v_end, v_lines, v_subtotal, v_discount, v_settings.vat_rate, v_tax, v_subtotal - v_discount + v_tax,
    greatest(v_start, now() + interval '1 day'),
    jsonb_build_object('name', v_org.name, 'phone', v_s.billing_phone_e164, 'email', v_s.billing_email,
      'city', (select city from public.branches where organization_id = v_org.id order by created_at limit 1)),
    jsonb_build_object('legal_name', v_settings.company_legal_name, 'rc', v_settings.company_rc, 'niu', v_settings.company_niu,
      'address', v_settings.company_address, 'phone', v_settings.company_phone, 'email', v_settings.company_email,
      'footer', v_settings.invoice_footer))
  returning * into v_inv;
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_s.id, v_s.organization_id, 'invoice_issued', (select auth.uid()),
    jsonb_build_object('invoice_id', v_inv.id, 'number', v_inv.number, 'total_xaf', v_inv.total_xaf, 'kind', v_kind));
  return v_inv;
end;
$$;

/** Facture publique d'un lien de paiement (`/pay/<jeton>`), sans donnée personnelle hors nom de l'établissement. */
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
    'lines', i.lines,
    'expired', l.expires_at < now(),
    'payment', (select jsonb_build_object('status', y.status, 'channel', y.channel, 'external_id', y.external_id,
                  'failure_reason', y.failure_reason)
                from public.payments y where y.invoice_id = i.id order by y.created_at desc limit 1)
  )
  from public.pay_links l join public.invoices i on i.id = l.invoice_id
  where p_token ~ '^[A-Za-z0-9]{32}$' and l.token_hash = public.sha256_hex(p_token);
$$;

/**
 * Début d'un paiement (serveur de l'application, après captcha) : facture ouverte du lien, paiement « en attente »
 * avec une référence NextIn. Le numéro débité n'est gardé que masqué. Erreurs : `not_found`, `invoice_paid`, `link_expired`.
 */
create or replace function public.start_payment(p_token text, p_provider public.payment_provider, p_channel public.payment_channel, p_msisdn text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.pay_links;
  v_i public.invoices;
  v_external text := 'nx_' || public.random_string(20, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
begin
  if p_msisdn is null or p_msisdn !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  select * into v_l from public.pay_links where token_hash = public.sha256_hex(coalesce(p_token, ''));
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_l.expires_at < now() then raise exception 'link_expired' using errcode = 'P0410'; end if;
  select * into v_i from public.invoices where id = v_l.invoice_id for update;
  if v_i.status = 'paid' then raise exception 'invoice_paid' using errcode = 'P0409'; end if;
  if v_i.status = 'void' then raise exception 'link_expired' using errcode = 'P0410'; end if;
  if not public.check_rate_limit('payment:invoice:' || v_i.id, 10, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  insert into public.payments (invoice_id, provider, channel, msisdn_masked, amount_xaf, external_id)
  values (v_i.id, p_provider, p_channel, substr(p_msisdn, 1, 5) || '•• •• •• ' || right(p_msisdn, 2), v_i.total_xaf, v_external);
  return jsonb_build_object('external_id', v_external, 'amount_xaf', v_i.total_xaf, 'invoice_number', v_i.number,
    'description', format('NextIn %s', v_i.number));
end;
$$;

/**
 * Résultat d'un paiement (webhook signé ou revérification), idempotent : un paiement déjà réglé n'est jamais retraité.
 * Réussite : facture payée, période prolongée, abonnement actif (immédiatement, à toute heure), établissement
 * réactivé, messages « paiement confirmé » et « facture disponible ».
 */
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

/** Rattrapage (§11.5) : paiements en attente depuis plus de 10 minutes, à revérifier auprès de l'agrégateur. */
create or replace function public.payments_to_recheck(p_limit integer default 20)
returns setof public.payments
language sql
security definer
set search_path = ''
as $$
  update public.payments p set last_checked_at = now()
  from (
    select id from public.payments
    where status = 'pending' and created_at < now() - interval '10 minutes'
      and (last_checked_at is null or last_checked_at < now() - interval '5 minutes')
    order by created_at limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ) picked
  where p.id = picked.id
  returning p.*;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Cycle de vie (§11.4)
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Heure après laquelle une dégradation peut s'appliquer aujourd'hui : la plus tardive des fermetures du jour de toutes
 * les agences (heure de Douala), ou `default_closing_time` si aucune agence n'a d'horaires ce jour-là.
 */
create or replace function public.org_closing_time(p_org uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((now() at time zone 'Africa/Douala')::date + coalesce(
    (select max(h.closes_at) from public.opening_hours h join public.branches b on b.id = h.branch_id
     where b.organization_id = p_org and b.active
       and h.weekday = extract(isodow from now() at time zone 'Africa/Douala')),
    (select default_closing_time from public.platform_settings))) at time zone 'Africa/Douala';
$$;

/** Une agence de l'établissement est-elle ouverte en ce moment ? */
create or replace function public.org_has_open_branch(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.branches b where b.organization_id = p_org and b.active and public.branch_is_open(b.id));
$$;

/** Statut visé par les dates (sans les délais d'application) : pur, miroir de `targetStatus` (packages/shared/src/billing). */
create or replace function public.subscription_target_status(p_s public.subscriptions, p_settings public.platform_settings, p_now timestamptz)
returns public.subscription_status
language sql
immutable
set search_path = ''
as $$
  select case
    when p_s.status = 'trialing' and p_s.trial_ends_at <= p_now then 'read_only'
    when p_s.status = 'active' and p_s.current_period_end <= p_now then 'past_due'
    when p_s.status = 'past_due' and p_s.grace_ends_at <= p_now then 'read_only'
    when p_s.status = 'read_only' and p_s.read_only_since + make_interval(days => p_settings.read_only_days) <= p_now then 'suspended'
    else p_s.status
  end::public.subscription_status;
$$;

/** Applique une transition (dates, établissement, événement). */
create or replace function public.apply_subscription_status(p_sub uuid, p_status public.subscription_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
  v_settings public.platform_settings;
begin
  select * into v_settings from public.platform_settings;
  update public.subscriptions set
    status = p_status,
    pending_status = null, pending_status_after = null,
    grace_ends_at = case when p_status = 'past_due' then coalesce(current_period_end, now()) + make_interval(days => v_settings.grace_days) else grace_ends_at end,
    read_only_since = case when p_status = 'read_only' then now() else read_only_since end,
    suspended_since = case when p_status = 'suspended' then now() else suspended_since end,
    deletion_due_at = case when p_status = 'suspended' then now() + make_interval(days => v_settings.retention_after_suspension_days) else deletion_due_at end
  where id = p_sub returning * into v_s;
  if p_status = 'suspended' then
    update public.organizations set status = 'suspended', suspended_reason = 'subscription' where id = v_s.organization_id and status = 'active';
  end if;
  insert into public.subscription_events (subscription_id, organization_id, type, payload)
  values (v_s.id, v_s.organization_id, case p_status when 'past_due' then 'grace_started' else p_status::text end,
    jsonb_build_object('at', now()));
end;
$$;

/**
 * Tâche (toutes les 15 minutes) : programme les dégradations dues (`pending_status` après la fermeture du jour),
 * puis les applique une fois l'heure passée **et** aucune agence ouverte (§11.4 : jamais de coupure en pleine journée).
 * Supprime les établissements suspendus depuis `retention_after_suspension_days` (factures et paiements conservés).
 */
create or replace function public.apply_pending_transitions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.platform_settings;
  v_s public.subscriptions;
  v_target public.subscription_status;
  v_scheduled integer := 0;
  v_applied integer := 0;
  v_deleted integer := 0;
begin
  select * into v_settings from public.platform_settings;
  for v_s in select * from public.subscriptions where status <> 'active' or current_period_end <= now() loop
    v_target := public.subscription_target_status(v_s, v_settings, now());
    if v_target <> v_s.status and v_s.pending_status is distinct from v_target then
      update public.subscriptions set pending_status = v_target,
        pending_status_after = greatest(now(), public.org_closing_time(v_s.organization_id))
      where id = v_s.id;
      v_scheduled := v_scheduled + 1;
    end if;
  end loop;
  for v_s in
    select * from public.subscriptions
    where pending_status is not null and pending_status_after <= now()
    for update skip locked
  loop
    if not public.org_has_open_branch(v_s.organization_id) then
      perform public.apply_subscription_status(v_s.id, v_s.pending_status);
      v_applied := v_applied + 1;
    end if;
  end loop;
  for v_s in select * from public.subscriptions where status = 'suspended' and deletion_due_at <= now() loop
    insert into public.subscription_events (subscription_id, organization_id, type, payload)
    values (v_s.id, v_s.organization_id, 'deleted', jsonb_build_object('at', now()));
    perform public.audit(v_s.organization_id, 'org.delete', 'organization', v_s.organization_id, '{}'::jsonb);
    delete from public.organizations where id = v_s.organization_id;
    v_deleted := v_deleted + 1;
  end loop;
  return jsonb_build_object('scheduled', v_scheduled, 'applied', v_applied, 'deleted', v_deleted);
end;
$$;

/**
 * Tâche quotidienne (8 h à Douala) : facture de renouvellement `invoice_lead_days` avant l'échéance (ou la fin de
 * l'essai), rappels WhatsApp et e-mail à J-7, J-3, J-1, pendant la grâce (J+1, J+4, J+6) et avant la suppression
 * (J-7, J-1), chacun avec un lien de paiement. Idempotente (`billing_reminders`).
 */
create or replace function public.billing_daily()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.platform_settings;
  v_today date := (now() at time zone 'Africa/Douala')::date;
  v_s record;
  v_kind text;
  v_offset integer;
  v_target date;
  v_inv public.invoices;
  v_token text;
  v_count integer := 0;
  v_channel text;
begin
  select * into v_settings from public.platform_settings;
  for v_s in select s.*, o.name as org_name from public.subscriptions s join public.organizations o on o.id = s.organization_id loop
    v_kind := null;
    if v_s.status = 'trialing' then
      v_target := (v_s.trial_ends_at at time zone 'Africa/Douala')::date;
      v_offset := v_target - v_today;
      if v_offset in (7, 3, 1) then v_kind := 'trial_end'; end if;
    elsif v_s.status = 'active' then
      v_target := (v_s.current_period_end at time zone 'Africa/Douala')::date;
      v_offset := v_target - v_today;
      if v_offset in (7, 3, 1) then v_kind := 'period_end'; end if;
    elsif v_s.status = 'past_due' then
      v_target := (v_s.current_period_end at time zone 'Africa/Douala')::date;
      v_offset := v_target - v_today;
      if v_offset in (-1, -4, -6) then v_kind := 'grace'; end if;
    elsif v_s.status = 'suspended' then
      v_target := (v_s.deletion_due_at at time zone 'Africa/Douala')::date;
      v_offset := v_target - v_today;
      if v_offset in (7, 1) then v_kind := 'deletion'; end if;
    end if;
    -- Facture de la prochaine période dès J-`invoice_lead_days` (ou dès un rappel).
    if v_kind is not null or (v_s.status in ('trialing', 'active') and v_offset between 0 and v_settings.invoice_lead_days) then
      if not exists (select 1 from public.invoices where subscription_id = v_s.id and status = 'open') then
        v_inv := public.issue_invoice(v_s.id);
      end if;
    end if;
    continue when v_kind is null;
    select * into v_inv from public.invoices where subscription_id = v_s.id and status = 'open' order by issued_at desc limit 1;
    foreach v_channel in array array['whatsapp', 'email'] loop
      continue when (v_channel = 'whatsapp' and v_s.billing_phone_e164 is null) or (v_channel = 'email' and v_s.billing_email is null);
      insert into public.billing_reminders (subscription_id, kind, offset_days, target_date, channel)
      values (v_s.id, v_kind, v_offset, v_target, v_channel)
      on conflict do nothing;
      continue when not found;
      v_token := case when v_inv.id is not null then public.create_pay_link(v_inv.id) end;
      insert into public.account_messages (organization_id, kind, channel, to_phone, to_email, locale, payload, dedupe_key)
      values (v_s.organization_id, case when v_kind = 'deletion' then 'deletion_notice' else 'billing_reminder' end, v_channel,
        case when v_channel = 'whatsapp' then v_s.billing_phone_e164 end, case when v_channel = 'email' then v_s.billing_email end,
        v_s.locale,
        jsonb_build_object('reminder', v_kind, 'days', abs(v_offset), 'date', v_target, 'organization', v_s.org_name,
          -- Fin de la grâce (passage en lecture seule) ou date de suppression, en date de Douala.
          'until', case v_kind when 'grace' then (v_s.grace_ends_at at time zone 'Africa/Douala')::date
                               when 'deletion' then v_target end,
          'amount_xaf', v_inv.total_xaf, 'invoice', v_inv.number, 'pay_token', v_token),
        format('reminder:%s:%s:%s:%s:%s', v_s.id, v_kind, v_offset, v_target, v_channel))
      on conflict (dedupe_key) do nothing;
      v_count := v_count + 1;
    end loop;
  end loop;
  if v_count > 0 then perform public.kick_notification_dispatch(); end if;
  return v_count;
end;
$$;

select cron.schedule('nextin-billing-transitions', '*/15 * * * *', $$select public.apply_pending_transitions()$$);
-- 8 h à Douala (UTC+1).
select cron.schedule('nextin-billing-daily', '0 7 * * *', $$select public.billing_daily()$$);

-- ═════════════════════════════════════════════════════════════════════════════
-- Quotas WhatsApp (§11.8)
-- ═════════════════════════════════════════════════════════════════════════════

/** Message WhatsApp ou SMS envoyé : compté pour le mois ; alerte au directeur au seuil (une fois par mois). */
create or replace function public.count_messaging_usage(p_org uuid, p_channel public.notif_channel)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Africa/Douala')::date;
  v_u public.messaging_usage;
  v_quota integer;
  v_s public.subscriptions;
begin
  if p_channel not in ('whatsapp', 'sms') then return; end if;
  insert into public.messaging_usage as u (organization_id, month, whatsapp_sent, sms_sent)
  values (p_org, v_month, (p_channel = 'whatsapp')::integer, (p_channel = 'sms')::integer)
  on conflict (organization_id, month) do update set
    whatsapp_sent = u.whatsapp_sent + (p_channel = 'whatsapp')::integer,
    sms_sent = u.sms_sent + (p_channel = 'sms')::integer
  returning * into v_u;
  v_quota := (public.org_entitlements(p_org) ->> 'whatsapp_quota')::integer;
  if v_quota > 0 and v_u.alerted_at is null
     and v_u.whatsapp_sent * 100 >= v_quota * (select quota_alert_percent from public.platform_settings) then
    update public.messaging_usage set alerted_at = now() where organization_id = p_org and month = v_month;
    select * into v_s from public.subscriptions where organization_id = p_org;
    if found then
      perform public.enqueue_account_message(p_org, 'quota_alert', 'quota:' || p_org || ':' || v_month,
        jsonb_build_object('used', v_u.whatsapp_sent, 'quota', v_quota,
          'organization', (select name from public.organizations where id = p_org)), v_s.billing_phone_e164, v_s.billing_email, v_s.locale);
    end if;
  end if;
end;
$$;

/** Quota mensuel de messages WhatsApp dépassé ? (« c'est votre tour » reste toujours envoyé.) */
create or replace function public.whatsapp_quota_exceeded(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.whatsapp_sent from public.messaging_usage u
                   where u.organization_id = p_org and u.month = date_trunc('month', now() at time zone 'Africa/Douala')::date), 0)
         >= nullif((public.org_entitlements(p_org) ->> 'whatsapp_quota')::integer, 0);
$$;

/** Réservation des messages de la file (M9), plus l'état du quota WhatsApp de l'établissement. */
create or replace function public.claim_notification_jobs(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with picked as (
    select j.id from public.notification_jobs j
    where (j.status = 'pending' and j.next_attempt_at <= now())
       or (j.status = 'sending' and j.updated_at < now() - interval '2 minutes')
    order by j.next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ),
  claimed as (
    update public.notification_jobs j set status = 'sending', attempt = j.attempt + 1
    from picked where j.id = picked.id
    returning j.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'event', j.event,
    'channel', j.channel,
    'attempt', j.attempt,
    'payload', j.payload,
    'guard', j.guard,
    -- M10a : quota mensuel WhatsApp de la formule atteint (« c'est votre tour » toujours envoyé).
    'quota_exceeded', j.channel = 'whatsapp' and j.event <> 'your_turn' and coalesce(public.whatsapp_quota_exceeded(j.organization_id), false),
    'fallback_status', (select f.status from public.notification_jobs f where f.id = j.fallback_of),
    'contact', case when c.id is not null then jsonb_build_object(
      'id', c.id,
      'phone_e164', c.phone_e164,
      'locale', c.locale,
      'push_subscription', c.push_subscription,
      'window_expires_at', c.window_expires_at,
      'opted_out', c.opted_out_at is not null
        or (c.phone_e164 is not null and exists (
          select 1 from public.whatsapp_opt_outs o where o.phone_hash = public.sha256_hex(c.phone_e164)))
    ) end,
    'token', t.public_token,
    'ticket', case when t.id is not null then public.ticket_view(t.id) end,
    'appointment', case when j.appointment_id is not null and j.ticket_id is null then public.appointment_notification_view(j.appointment_id) end,
    'request', case when j.appointment_request_id is not null and j.appointment_id is null and j.ticket_id is null
                    then public.request_notification_view(j.appointment_request_id) end
  )), '[]'::jsonb) into v_result
  from claimed j
  left join public.tickets t on t.id = j.ticket_id
  left join public.notification_contacts c on c.id = j.contact_id;
  return v_result;
end;
$$;

/** Résultat d'un envoi (M7), plus le comptage des messages WhatsApp et SMS du mois. */
create or replace function public.complete_notification_job(
  p_job uuid,
  p_status public.job_status,
  p_provider_message_id text default null,
  p_error text default null,
  p_retry_in_seconds integer default null,
  p_template_name text default null,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j public.notification_jobs;
begin
  update public.notification_jobs set
    status = case when p_retry_in_seconds is not null then 'pending'::public.job_status else p_status end,
    next_attempt_at = case when p_retry_in_seconds is not null then now() + make_interval(secs => p_retry_in_seconds) else next_attempt_at end,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    template_name = coalesce(p_template_name, template_name),
    error = left(p_error, 500),
    payload = payload || coalesce(p_payload, '{}'::jsonb),
    sent_at = case when p_status in ('sent', 'delivered', 'read') and p_retry_in_seconds is null then coalesce(sent_at, now()) else sent_at end
  where id = p_job
  returning * into v_j;
  if p_status = 'sent' and p_retry_in_seconds is null then
    perform public.count_messaging_usage(v_j.organization_id, v_j.channel);
  end if;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Page Abonnement (administrateur de l'établissement)
-- ═════════════════════════════════════════════════════════════════════════════

/** Administrateur de l'établissement (ou super admin), sinon `not_allowed`. */
create or replace function public.assert_org_admin(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_anonymous() or not (public.has_org_role(p_org, array['org_admin']::public.member_role[]) or public.is_platform_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

/** Tout ce que montre la page Abonnement : abonnement, droits, usage, devis des formules, factures. */
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
begin
  perform public.assert_org_admin(p_org);
  select * into v_s from public.subscriptions where organization_id = p_org;
  v_branches := public.billable_branches(p_org);
  v_d := public.active_discount(p_org);
  return jsonb_build_object(
    'subscription', case when v_s.id is not null then to_jsonb(v_s) - 'billing_phone_e164' || jsonb_build_object(
      'billing_phone_masked', case when v_s.billing_phone_e164 is not null
        then substr(v_s.billing_phone_e164, 1, 5) || '•• •• •• ' || right(v_s.billing_phone_e164, 2) end) end,
    'entitlements', public.org_entitlements(p_org),
    'usage', jsonb_build_object(
      'branches', v_branches,
      'counters_max', (select max(c) from (select count(*) as c from public.counters where organization_id = p_org and active group by branch_id) x),
      'displays_max', (select max(c) from (select count(*) as c from public.displays where organization_id = p_org and status = 'active' group by branch_id) x),
      'whatsapp_sent', coalesce((select whatsapp_sent from public.messaging_usage
        where organization_id = p_org and month = date_trunc('month', now() at time zone 'Africa/Douala')::date), 0)),
    'discount', case when v_d.id is not null then jsonb_build_object('kind', v_d.kind, 'value', v_d.value, 'remaining', v_d.remaining_invoices, 'reason', v_d.reason) end,
    'plans', (select jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'name', p.name, 'name_en', p.name_en, 'description', p.description, 'description_en', p.description_en,
        'base_price_xaf', p.base_price_xaf, 'included_branches', p.included_branches, 'extra_branch_price_xaf', p.extra_branch_price_xaf,
        'max_counters_per_branch', p.max_counters_per_branch, 'max_displays_per_branch', p.max_displays_per_branch,
        'features', p.features, 'whatsapp_quota_per_branch', p.whatsapp_quota_per_branch, 'annual_free_months', p.annual_free_months,
        'monthly', public.subscription_price(p.base_price_xaf, p.included_branches, p.extra_branch_price_xaf, p.annual_free_months, v_branches, 'monthly', v_d.kind, v_d.value),
        'annual', public.subscription_price(p.base_price_xaf, p.included_branches, p.extra_branch_price_xaf, p.annual_free_months, v_branches, 'annual', v_d.kind, v_d.value),
        'fits', (p.extra_branch_price_xaf is not null or v_branches <= p.included_branches)
          and (p.max_counters_per_branch is null or coalesce((select max(c) from (select count(*) as c from public.counters
               where organization_id = p_org and active group by branch_id) x), 0) <= p.max_counters_per_branch)
          and (p.max_displays_per_branch is null or coalesce((select max(c) from (select count(*) as c from public.displays
               where organization_id = p_org and status = 'active' group by branch_id) x), 0) <= p.max_displays_per_branch)
      ) order by p.sort_order) from public.plans p where p.active),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'number', i.number, 'status', i.status, 'total_xaf', i.total_xaf,
        'issued_at', i.issued_at, 'paid_at', i.paid_at, 'period_start', i.period_start, 'period_end', i.period_end,
        'billing_period', i.billing_period, 'kind', i.kind, 'paid_channel', i.paid_channel, 'plan_id', i.plan_id) order by i.issued_at desc)
      from public.invoices i where i.organization_id = p_org), '[]'::jsonb),
    'settings', (select jsonb_build_object('trial_days', trial_days, 'grace_days', grace_days, 'vat_rate', vat_rate) from public.platform_settings)
  );
end;
$$;

/**
 * Payer ou changer de formule : facture de la formule et de la période choisies, puis lien de paiement (jeton renvoyé).
 * Descente de formule pendant une période payée : appliquée à la prochaine échéance, si les limites sont respectées
 * (`plan_limit` sinon) ; aucune facture tout de suite.
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

/** Facture complète pour le PDF (administrateur de l'établissement ou super admin). */
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
    if v_i.organization_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
    perform public.assert_org_admin(v_i.organization_id);
  end if;
  return to_jsonb(v_i) || jsonb_build_object('plan', (select jsonb_build_object('name', name, 'name_en', name_en) from public.plans where id = v_i.plan_id));
end;
$$;

/** Étape de l'assistant de démarrage (§11.3), 0 à 5 (5 : terminé). */
create or replace function public.set_onboarding_step(p_org uuid, p_step integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_org_admin(p_org);
  if p_step not between 0 and 5 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.organizations set onboarding_step = greatest(onboarding_step, p_step) where id = p_org;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Super admin (§11.9)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_anonymous() or not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
end;
$$;

/** Tableau des abonnements, filtrable par statut (ou « all ») et recherche sur le nom. */
create or replace function public.admin_subscriptions(p_status text default 'all', p_query text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'organization_id', o.id, 'organization', o.name, 'org_type', o.type, 'org_status', o.status,
      'plan', p.code, 'plan_name', p.name, 'status', s.status, 'billing_period', s.billing_period,
      'trial_ends_at', s.trial_ends_at, 'current_period_end', s.current_period_end, 'pending_status', s.pending_status,
      'pending_status_after', s.pending_status_after, 'deletion_due_at', s.deletion_due_at,
      'branches', public.billable_branches(o.id),
      'last_payment', (select jsonb_build_object('paid_at', i.paid_at, 'total_xaf', i.total_xaf, 'channel', i.paid_channel)
                       from public.invoices i where i.subscription_id = s.id and i.status = 'paid' order by i.paid_at desc limit 1),
      'created_at', s.created_at
    ) order by case s.status when 'past_due' then 0 when 'read_only' then 1 when 'trialing' then 2 when 'suspended' then 3 else 4 end,
              coalesce(s.current_period_end, s.trial_ends_at))
    from public.subscriptions s
    join public.organizations o on o.id = s.organization_id
    join public.plans p on p.id = s.plan_id
    where (p_status = 'all' or s.status::text = p_status)
      and (nullif(trim(coalesce(p_query, '')), '') is null or o.name ilike '%' || trim(p_query) || '%')
  ), '[]'::jsonb);
end;
$$;

/**
 * Revenus : MRR (paiements annuels lissés sur 12 mois, abonnements actifs ou en grâce), encaissements du mois,
 * répartition par formule, nombre d'abonnements par statut, essais convertis (12 derniers mois).
 */
create or replace function public.admin_revenue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Douala') at time zone 'Africa/Douala';
begin
  perform public.assert_platform_admin();
  return jsonb_build_object(
    'mrr_xaf', coalesce((
      select sum(case when i.billing_period = 'annual' then round(i.total_xaf / 12.0) else i.total_xaf end)::integer
      from public.subscriptions s
      join lateral (select * from public.invoices i where i.subscription_id = s.id and i.status = 'paid' order by i.paid_at desc limit 1) i on true
      where s.status in ('active', 'past_due')), 0),
    'collected_month_xaf', coalesce((select sum(total_xaf)::integer from public.invoices where status = 'paid' and paid_at >= v_month_start), 0),
    'by_plan', coalesce((select jsonb_agg(x) from (
      select p.code, p.name, count(s.id) filter (where s.status in ('active', 'past_due')) as paying,
             count(s.id) filter (where s.status = 'trialing') as trialing
      from public.plans p left join public.subscriptions s on s.plan_id = p.id
      group by p.code, p.name, p.sort_order order by p.sort_order) x), '[]'::jsonb),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) as n from public.subscriptions group by status) x), '{}'::jsonb),
    'trials_started', (select count(*) from public.subscription_events where type = 'trial_started' and created_at > now() - interval '12 months'),
    'trials_converted', (select count(distinct e.subscription_id) from public.subscription_events e
      where e.type = 'paid' and e.created_at > now() - interval '12 months'
        and exists (select 1 from public.subscription_events t where t.subscription_id = e.subscription_id and t.type = 'trial_started')),
    'collected_by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'total_xaf', t) order by m) from (
      select to_char(date_trunc('month', paid_at at time zone 'Africa/Douala'), 'YYYY-MM') as m, sum(total_xaf)::integer as t
      from public.invoices where status = 'paid' and paid_at > now() - interval '12 months' group by 1) x), '[]'::jsonb)
  );
end;
$$;

/** Offrir des jours : prolonge l'essai ou la période en cours (réactive au besoin, immédiatement). */
create or replace function public.admin_grant_days(p_subscription uuid, p_days integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
begin
  perform public.assert_platform_admin();
  if p_days not between 1 and 365 or char_length(coalesce(trim(p_reason), '')) not between 3 and 200 then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  select * into v_s from public.subscriptions where id = p_subscription for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_s.status = 'trialing' or (v_s.status = 'read_only' and v_s.current_period_end is null) then
    update public.subscriptions set status = 'trialing',
      trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_days),
      read_only_since = null, pending_status = null, pending_status_after = null
    where id = v_s.id returning * into v_s;
  else
    update public.subscriptions set status = 'active',
      current_period_end = greatest(coalesce(current_period_end, now()), now()) + make_interval(days => p_days),
      grace_ends_at = null, read_only_since = null, suspended_since = null, deletion_due_at = null,
      pending_status = null, pending_status_after = null
    where id = v_s.id returning * into v_s;
  end if;
  update public.organizations set status = 'active', suspended_reason = null
  where id = v_s.organization_id and status = 'suspended' and suspended_reason = 'subscription';
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_s.id, v_s.organization_id, 'days_granted', (select auth.uid()), jsonb_build_object('days', p_days, 'reason', p_reason));
  perform public.audit(v_s.organization_id, 'subscription.grant_days', 'subscription', v_s.id, jsonb_build_object('days', p_days, 'reason', p_reason));
  return to_jsonb(v_s);
end;
$$;

/** Remise sur les N prochaines factures d'un établissement (pourcentage ou montant). */
create or replace function public.admin_apply_discount(p_org uuid, p_kind text, p_value integer, p_invoices integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_platform_admin();
  if p_kind not in ('percent', 'fixed_xaf') or p_value <= 0 or (p_kind = 'percent' and p_value > 100) or p_invoices not between 1 and 24
     or char_length(coalesce(trim(p_reason), '')) not between 3 and 200 then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  insert into public.discounts (organization_id, kind, value, remaining_invoices, reason, created_by)
  values (p_org, p_kind, p_value, p_invoices, trim(p_reason), (select auth.uid())) returning id into v_id;
  -- La facture ouverte est réémise avec la remise.
  update public.invoices set status = 'void' where organization_id = p_org and status = 'open';
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  select id, p_org, 'discount_applied', (select auth.uid()), jsonb_build_object('kind', p_kind, 'value', p_value, 'invoices', p_invoices, 'reason', p_reason)
  from public.subscriptions where organization_id = p_org;
  perform public.audit(p_org, 'subscription.discount', 'discount', v_id, jsonb_build_object('kind', p_kind, 'value', p_value, 'invoices', p_invoices));
  return v_id;
end;
$$;

/** Changement de formule par le super admin (immédiat, sans facture). */
create or replace function public.admin_change_plan(p_subscription uuid, p_plan uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
  v_code text;
begin
  perform public.assert_platform_admin();
  select code into v_code from public.plans where id = p_plan;
  if v_code is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  update public.subscriptions set plan_id = p_plan, next_plan_id = null where id = p_subscription returning * into v_s;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  update public.invoices set status = 'void' where subscription_id = v_s.id and status = 'open';
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_s.id, v_s.organization_id, 'plan_changed', (select auth.uid()), jsonb_build_object('plan', v_code, 'reason', p_reason));
  perform public.audit(v_s.organization_id, 'subscription.change_plan', 'subscription', v_s.id, jsonb_build_object('plan', v_code, 'reason', p_reason));
end;
$$;

/** Suspension ou réactivation pour modération (fraude, abus), indépendante du paiement. */
create or replace function public.admin_set_suspension(p_org uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  if char_length(coalesce(trim(p_reason), '')) not between 3 and 200 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.organizations set status = case when p_suspended then 'suspended' else 'active' end::public.org_status,
    suspended_reason = case when p_suspended then 'moderation: ' || trim(p_reason) end
  where id = p_org;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  select id, p_org, 'moderation', (select auth.uid()), jsonb_build_object('suspended', p_suspended, 'reason', p_reason)
  from public.subscriptions where organization_id = p_org;
  perform public.audit(p_org, case when p_suspended then 'org.suspend' else 'org.reactivate' end, 'organization', p_org,
    jsonb_build_object('reason', p_reason));
end;
$$;

/** Édition d'une formule (prix, limites, fonctions, quota). Ne touche pas aux factures déjà émises. */
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
    max_counters_per_branch = case when p_fields ? 'max_counters_per_branch' then (p_fields ->> 'max_counters_per_branch')::smallint else max_counters_per_branch end,
    max_displays_per_branch = case when p_fields ? 'max_displays_per_branch' then (p_fields ->> 'max_displays_per_branch')::smallint else max_displays_per_branch end,
    whatsapp_quota_per_branch = coalesce((p_fields ->> 'whatsapp_quota_per_branch')::integer, whatsapp_quota_per_branch),
    annual_free_months = coalesce((p_fields ->> 'annual_free_months')::smallint, annual_free_months),
    features = case when p_fields ? 'features' then features || (p_fields -> 'features') else features end,
    active = coalesce((p_fields ->> 'active')::boolean, active)
  where id = p_plan;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.audit(null, 'plan.update', 'plan', p_plan, p_fields);
end;
$$;

/** Réglages de la plateforme (mentions légales, durées, TVA). */
create or replace function public.admin_update_settings(p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  update public.platform_settings set
    company_legal_name = coalesce(p_fields ->> 'company_legal_name', company_legal_name),
    company_rc = coalesce(p_fields ->> 'company_rc', company_rc),
    company_niu = coalesce(p_fields ->> 'company_niu', company_niu),
    company_address = coalesce(p_fields ->> 'company_address', company_address),
    company_phone = coalesce(p_fields ->> 'company_phone', company_phone),
    company_email = coalesce(p_fields ->> 'company_email', company_email),
    invoice_footer = coalesce(p_fields ->> 'invoice_footer', invoice_footer),
    trial_days = coalesce((p_fields ->> 'trial_days')::smallint, trial_days),
    grace_days = coalesce((p_fields ->> 'grace_days')::smallint, grace_days),
    read_only_days = coalesce((p_fields ->> 'read_only_days')::smallint, read_only_days),
    retention_after_suspension_days = coalesce((p_fields ->> 'retention_after_suspension_days')::smallint, retention_after_suspension_days),
    default_closing_time = coalesce((p_fields ->> 'default_closing_time')::time, default_closing_time),
    vat_rate = coalesce((p_fields ->> 'vat_rate')::numeric, vat_rate),
    invoice_lead_days = coalesce((p_fields ->> 'invoice_lead_days')::smallint, invoice_lead_days),
    quota_alert_percent = coalesce((p_fields ->> 'quota_alert_percent')::smallint, quota_alert_percent),
    updated_by = (select auth.uid())
  where id;
  perform public.audit(null, 'platform.settings', 'platform_settings', null, p_fields);
end;
$$;

/** Historique d'un abonnement (super admin). */
create or replace function public.admin_subscription_detail(p_subscription uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.subscriptions;
begin
  perform public.assert_platform_admin();
  select * into v_s from public.subscriptions where id = p_subscription;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  return jsonb_build_object(
    'subscription', to_jsonb(v_s),
    'organization', (select jsonb_build_object('id', id, 'name', name, 'type', type, 'status', status, 'suspended_reason', suspended_reason, 'created_at', created_at)
                     from public.organizations where id = v_s.organization_id),
    'events', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'payload', payload, 'created_at', created_at) order by created_at desc)
                        from (select * from public.subscription_events where subscription_id = v_s.id order by created_at desc limit 50) e), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'number', number, 'status', status, 'total_xaf', total_xaf, 'issued_at', issued_at, 'paid_at', paid_at) order by issued_at desc)
                          from public.invoices where subscription_id = v_s.id), '[]'::jsonb)
  );
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Écran TV : annonces vocales selon la formule
-- ═════════════════════════════════════════════════════════════════════════════

/** Configuration d'un écran appairé (M6), plus `voice_enabled` (M10a). */
create or replace function public.tv_session(p_device_token text, p_app_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.displays;
begin
  update public.displays
  set last_seen_at = now(), app_version = coalesce(left(p_app_version, 40), app_version)
  where device_token_hash = public.sha256_hex(p_device_token) and status = 'active'
  returning * into v_row;
  if not found then return null; end if;
  return coalesce(
  (
    select jsonb_build_object(
      'display_id', v_row.id,
      'name', v_row.name,
      'show_ads', v_row.show_ads,
      'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
      'branch', jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone),
      'service_ids', coalesce((select jsonb_agg(ds.service_id) from public.display_services ds where ds.display_id = v_row.id), '[]'::jsonb),
      'entry', (select jsonb_build_object('token', q.token, 'short_code', q.short_code) from public.qr_codes q
                where q.branch_id = b.id and q.active and q.service_id is null order by q.created_at desc limit 1),
      'announcements', coalesce(
        (select jsonb_build_object('languages', a.languages, 'volume', a.volume, 'repeat_count', a.repeat_count,
                                   'chime_enabled', a.chime_enabled, 'quiet_hours', a.quiet_hours)
         from public.announcement_settings a where a.branch_id = b.id),
        jsonb_build_object('languages', jsonb_build_array(o.default_locale), 'volume', 80, 'repeat_count', 1,
                           'chime_enabled', true, 'quiet_hours', '[]'::jsonb)),
      -- M10a : annonces vocales selon la formule (sinon carillon et affichage seuls).
      'voice_enabled', coalesce((public.org_entitlements(o.id) -> 'features' ->> 'voice_announcements')::boolean, false),
      'board', public.branch_board(b.id)
    )
    from public.branches b join public.organizations o on o.id = b.organization_id
    where b.id = v_row.branch_id and b.active and o.status = 'active'
  ), (
    -- Établissement suspendu : l'écran reste appairé et affiche un message neutre (aucun nom, aucun motif).
    select jsonb_build_object('display_id', v_row.id, 'unavailable', true)
    from public.branches b join public.organizations o on o.id = b.organization_id
    where b.id = v_row.branch_id and o.status = 'suspended'
  ));
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Export du tableau de bord selon la formule
-- ═════════════════════════════════════════════════════════════════════════════

/** Export CSV du tableau de bord (M8), réservé aux formules qui le comprennent. */
create or replace function public.stats_export(p_org uuid, p_branch uuid, p_from date, p_to date, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_stats_access(p_org, p_branch);
  -- M10a : export compris dans la formule (Entreprise ; établissements pilotes).
  perform public.assert_feature(p_org, 'export');
  if p_to < p_from or p_to - p_from > 400 or p_kind not in ('services', 'counters') then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  if p_kind = 'services' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', r.day, 'branch', b.name, 'service', s.name, 'prefix', s.prefix,
        'issued', r.issued, 'served', r.served, 'no_show', r.no_show, 'cancelled', r.cancelled, 'transferred', r.transferred,
        'remote', r.remote, 'appointment', r.appointment,
        'wait_avg_seconds', case when r.wait_count > 0 then round(r.wait_seconds_sum::numeric / r.wait_count) end,
        'max_wait_seconds', r.max_wait_seconds,
        'service_avg_seconds', case when r.service_count > 0 then round(r.service_seconds_sum::numeric / r.service_count) end,
        'rating_avg', case when r.rating_count > 0 then round(r.rating_sum::numeric / r.rating_count, 2) end,
        'rating_count', r.rating_count
      ) order by r.day, b.name, s.sort_order)
      from public.stats_branch_rows(p_org, p_branch, p_from, p_to) r
      join public.branches b on b.id = r.branch_id
      join public.services s on s.id = r.service_id
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', r.day, 'branch', b.name, 'kind', c.kind, 'number', c.number, 'label', c.label,
      'practitioner', case when r.practitioner_id is not null then public.practitioner_label(r.practitioner_id) end,
      'called', r.called, 'served', r.served, 'no_show', r.no_show,
      'service_avg_seconds', case when r.service_count > 0 then round(r.service_seconds_sum::numeric / r.service_count) end,
      'rating_avg', case when r.rating_count > 0 then round(r.rating_sum::numeric / r.rating_count, 2) end,
      'open_seconds', r.open_seconds, 'pause_seconds', r.pause_seconds
    ) order by r.day, b.name, c.kind, c.number)
    from public.stats_counter_rows(p_org, p_branch, p_from, p_to) r
    join public.branches b on b.id = r.branch_id
    join public.counters c on c.id = r.counter_id
  ), '[]'::jsonb);
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Purge : vérifications du téléphone
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Tâche nocturne : codes de vérification jamais utilisés effacés de la file (expirés depuis longtemps), vérifications de
 * plus de 7 jours supprimées, messages du compte de plus de 90 jours vidés.
 */
create or replace function public.purge_billing_personal_data()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_messages set payload = payload - 'code'
  where kind = 'phone_code' and payload ? 'code' and created_at < now() - interval '1 day';
  delete from public.phone_verifications where created_at < now() - interval '7 days';
  update public.account_messages set payload = '{}'::jsonb, to_phone = case when channel = 'email' then null else '+237600000000' end,
    to_email = case when channel = 'email' then 'purged@invalid' end
  where created_at < now() - interval '90 days' and payload <> '{}'::jsonb;
$$;
select cron.schedule('nextin-purge-billing', '45 2 * * *', $$select public.purge_billing_personal_data()$$);

-- ═════════════════════════════════════════════════════════════════════════════
-- Droits et RLS
-- ═════════════════════════════════════════════════════════════════════════════

revoke execute on function
  public.subscription_price(integer, integer, integer, integer, integer, public.billing_period, text, integer),
  public.billable_branches(uuid), public.org_entitlements(uuid), public.staff_entitlements(uuid), public.assert_feature(uuid, text), public.enforce_plan_limits(),
  public.enforce_subscription_on_write(), public.enqueue_account_message(uuid, text, text, jsonb, text, text, text),
  public.claim_account_messages(integer), public.complete_account_message(uuid, text, text, integer), public.phone_fingerprint(text),
  public.request_phone_code(uuid, text, text), public.clear_phone_code(uuid), public.verify_phone_code(uuid, text),
  public.self_service_signup(text, text, public.org_type, text, uuid), public.active_discount(uuid), public.create_pay_link(uuid),
  public.issue_invoice(uuid, uuid, public.billing_period), public.pay_invoice_view(text),
  public.start_payment(text, public.payment_provider, public.payment_channel, text),
  public.confirm_payment(text, public.payment_status, text, jsonb, text), public.payments_to_recheck(integer),
  public.org_closing_time(uuid), public.org_has_open_branch(uuid),
  public.subscription_target_status(public.subscriptions, public.platform_settings, timestamptz),
  public.apply_subscription_status(uuid, public.subscription_status), public.apply_pending_transitions(), public.billing_daily(),
  public.count_messaging_usage(uuid, public.notif_channel), public.whatsapp_quota_exceeded(uuid),
  public.complete_notification_job(uuid, public.job_status, text, text, integer, text, jsonb),
  public.assert_org_admin(uuid), public.billing_overview(uuid), public.billing_checkout(uuid, uuid, public.billing_period),
  public.invoice_document(uuid), public.set_onboarding_step(uuid, integer), public.assert_platform_admin(),
  public.admin_subscriptions(text, text), public.admin_revenue(), public.admin_grant_days(uuid, integer, text),
  public.admin_apply_discount(uuid, text, integer, integer, text), public.admin_change_plan(uuid, uuid, text),
  public.admin_set_suspension(uuid, boolean, text), public.admin_update_plan(uuid, jsonb), public.admin_update_settings(jsonb),
  public.admin_subscription_detail(uuid), public.purge_billing_personal_data()
from public, anon, authenticated;

-- Création d'un établissement : uniquement par l'inscription avec téléphone vérifié (`self_service_signup`), sinon un
-- établissement sans abonnement serait « pilote » (tout compris, sans fin).
revoke execute on function public.create_organization(text, text, public.org_type, text, integer) from public, anon, authenticated;

-- Calcul de prix (affichage), lien de paiement public.
grant execute on function public.subscription_price(integer, integer, integer, integer, integer, public.billing_period, text, integer),
  public.pay_invoice_view(text) to anon, authenticated;
-- Personnel : droits vérifiés dans chaque fonction.
grant execute on function public.staff_entitlements(uuid), public.verify_phone_code(uuid, text),
  public.self_service_signup(text, text, public.org_type, text, uuid), public.billing_overview(uuid),
  public.billing_checkout(uuid, uuid, public.billing_period), public.invoice_document(uuid), public.set_onboarding_step(uuid, integer),
  public.admin_subscriptions(text, text), public.admin_revenue(), public.admin_grant_days(uuid, integer, text),
  public.admin_apply_discount(uuid, text, integer, integer, text), public.admin_change_plan(uuid, uuid, text),
  public.admin_set_suspension(uuid, boolean, text), public.admin_update_plan(uuid, jsonb), public.admin_update_settings(jsonb),
  public.admin_subscription_detail(uuid)
to authenticated;
-- Serveur de l'application (captcha vérifié avant ; webhooks signés ; expéditeur).
grant execute on function public.request_phone_code(uuid, text, text), public.start_payment(text, public.payment_provider, public.payment_channel, text),
  public.confirm_payment(text, public.payment_status, text, jsonb, text), public.payments_to_recheck(integer),
  public.claim_account_messages(integer), public.complete_account_message(uuid, text, text, integer),
  public.complete_notification_job(uuid, public.job_status, text, text, integer, text, jsonb), public.whatsapp_quota_exceeded(uuid),
  public.org_entitlements(uuid), public.issue_invoice(uuid, uuid, public.billing_period),
  public.create_pay_link(uuid)
to service_role;

alter table public.platform_settings enable row level security;
alter table public.plans enable row level security;
alter table public.discounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.trial_claims enable row level security;
alter table public.phone_verifications enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.pay_links enable row level security;
alter table public.payments enable row level security;
alter table public.billing_reminders enable row level security;
alter table public.messaging_usage enable row level security;
alter table public.account_messages enable row level security;

revoke all on public.platform_settings, public.plans, public.discounts, public.subscriptions, public.subscription_events, public.trial_claims,
  public.phone_verifications, public.invoice_sequences, public.invoices, public.pay_links, public.payments, public.billing_reminders,
  public.messaging_usage, public.account_messages from anon, authenticated;
-- Lecture seule ; toute écriture passe par les RPC ci-dessus.
grant select on public.plans, public.platform_settings to anon, authenticated;
grant select on public.subscriptions, public.invoices, public.payments, public.messaging_usage, public.subscription_events to authenticated;

create policy plans_select on public.plans for select to anon, authenticated using (active or public.is_platform_admin());
create policy platform_settings_select on public.platform_settings for select to anon, authenticated using (true);
-- Tout le personnel voit le statut de l'abonnement (bandeaux) ; les factures et paiements : administrateurs seulement.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using ((public.has_org_role(organization_id, null) and not public.is_anonymous()) or public.is_platform_admin());
create policy invoices_select on public.invoices for select to authenticated
  using (public.has_org_role(organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin());
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id
                 and (public.has_org_role(i.organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin())));
create policy messaging_usage_select on public.messaging_usage for select to authenticated
  using (public.has_org_role(organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin());
create policy subscription_events_select on public.subscription_events for select to authenticated
  using (public.has_org_role(organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin());
