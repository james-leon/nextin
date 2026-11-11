-- S3 — Alertes de sécurité par e-mail : connexion d'un administrateur depuis un nouvel appareil, 10 échecs de connexion
-- en 15 minutes sur un compte, double authentification supprimée, rôle d'administrateur attribué, export massif.
-- Destinataires : adresse de sécurité de Wintek (console, sinon l'adresse de la société), le compte concerné et, selon
-- le cas, les administrateurs de l'établissement. Jamais de donnée d'un client de l'établissement.
--
-- Compatibilité avec le code en ligne : file d'envoi à part (`security_alerts`), ignorée par l'expéditeur actuel ;
-- ajouts seulement (colonne avec valeur par défaut, tables, fonctions, déclencheurs). `stats_export` garde sa signature.

alter table public.platform_settings
  add column security_alert_email text check (security_alert_email is null or security_alert_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

create table public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('admin_new_device', 'login_failures', 'mfa_disabled', 'admin_role_granted', 'mass_export')),
  user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  to_email text not null check (char_length(to_email) <= 254),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index security_alerts_due_idx on public.security_alerts (next_attempt_at) where status in ('pending', 'sending');
alter table public.security_alerts enable row level security;
-- Lecture : console Wintek seulement ; écriture : fonctions de la base.
create policy security_alerts_platform_read on public.security_alerts for select to authenticated using (public.is_platform_admin());

-- Appareils connus des comptes du personnel : empreinte d'un identifiant aléatoire du navigateur (cookie), jamais
-- d'adresse IP ni d'identifiant matériel.
create table public.staff_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  label text check (char_length(label) <= 80),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_hash)
);
alter table public.staff_devices enable row level security;
create policy staff_devices_own on public.staff_devices for select to authenticated using (user_id = (select auth.uid()));

-- Échecs de connexion par compte (empreinte salée de l'adresse), purgés après une heure.
create table public.login_failures (
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  at timestamptz not null default now()
);
create index login_failures_idx on public.login_failures (email_hash, at);
alter table public.login_failures enable row level security;
-- Aucune politique : écrit et lu par `record_login_failure` seulement.

/** Adresse de sécurité de Wintek (réglage de la console, sinon l'adresse de la société). */
create or replace function public.security_alert_inbox()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(coalesce(nullif(security_alert_email, ''), nullif(company_email, '')), '') from public.platform_settings;
$$;

/**
 * Alerte : une ligne par destinataire (Wintek, le compte concerné, les administrateurs de l'établissement si
 * `p_notify_org_admins`), dédoublonnée par `p_dedupe`. Journalisée.
 */
create or replace function public.raise_security_alert(
  p_org uuid, p_kind text, p_user uuid, p_detail jsonb, p_dedupe text, p_notify_user boolean default true, p_notify_org_admins boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_n integer;
  v_to record;
begin
  for v_to in
    select distinct on (lower(e.email)) e.email, e.locale from (
      select public.security_alert_inbox() as email, 'fr'::text as locale
      union all
      select u.email, case when u.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end
      from auth.users u where p_notify_user and u.id = p_user
      union all
      select u.email, case when u.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end
      from public.memberships m join auth.users u on u.id = m.user_id
      where p_notify_org_admins and p_org is not null and m.organization_id = p_org and m.role = 'org_admin' and m.active
    ) e
    where e.email is not null
  loop
    insert into public.security_alerts (organization_id, kind, user_id, detail, to_email, locale, dedupe_key)
    values (p_org, p_kind, p_user, coalesce(p_detail, '{}'::jsonb), v_to.email, v_to.locale, p_dedupe || ':' || lower(v_to.email))
    on conflict (dedupe_key) do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;
  if v_count > 0 then
    perform public.audit(p_org, 'security.alert', 'user', p_user, jsonb_build_object('kind', p_kind) || coalesce(p_detail, '{}'::jsonb));
    perform public.kick_notification_dispatch();
  end if;
  return v_count;
end;
$$;

/** Compte administrateur (super admin ou administrateur d'au moins un établissement) ? */
create or replace function public.is_admin_account(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = p_user)
      or exists (select 1 from public.memberships where user_id = p_user and role = 'org_admin' and active);
$$;

/**
 * Connexion réussie (appelée par l'application avec la session de l'utilisateur) : appareil enregistré ; un
 * administrateur qui se connecte depuis un appareil inconnu (alors qu'il en a déjà un) déclenche une alerte.
 */
create or replace function public.record_staff_login(p_device_id text, p_label text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hash text;
  v_known boolean;
  v_other boolean;
begin
  if v_user is null or public.is_anonymous() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_device_id is null or p_device_id !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  v_hash := public.sha256_hex('nextin-device:' || p_device_id);
  select true into v_known from public.staff_devices where user_id = v_user and device_hash = v_hash;
  if found then
    update public.staff_devices set last_seen_at = now() where user_id = v_user and device_hash = v_hash;
    return false;
  end if;
  v_other := exists (select 1 from public.staff_devices where user_id = v_user);
  insert into public.staff_devices (user_id, device_hash, label) values (v_user, v_hash, left(p_label, 80));
  if v_other and public.is_admin_account(v_user) then
    perform public.raise_security_alert(null, 'admin_new_device', v_user,
      jsonb_build_object('device', left(coalesce(p_label, ''), 80), 'at', now()), 'new_device:' || v_user || ':' || v_hash);
  end if;
  return v_other;
end;
$$;

/**
 * Échec de connexion (serveur de l'application) : au 10e échec en 15 minutes sur une même adresse, alerte à Wintek et
 * au compte s'il existe. L'adresse n'est conservée qu'en empreinte salée.
 */
create or replace function public.record_login_failure(p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := public.sha256_hex('nextin-login:' || lower(trim(coalesce(p_email, ''))));
  v_count integer;
  v_user uuid;
begin
  delete from public.login_failures where at < now() - interval '1 hour';
  insert into public.login_failures (email_hash) values (v_hash);
  select count(*)::integer into v_count from public.login_failures where email_hash = v_hash and at > now() - interval '15 minutes';
  if v_count = 10 then
    select id into v_user from auth.users where lower(email) = lower(trim(p_email)) and not coalesce(is_anonymous, false);
    perform public.raise_security_alert(null, 'login_failures', v_user,
      jsonb_build_object('account', public.mask_email(lower(trim(p_email))), 'failures', v_count, 'window_minutes', 15),
      'login_failures:' || v_hash || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'));
  end if;
  return v_count;
end;
$$;

-- ─── Double authentification supprimée ───────────────────────────────────────

create or replace function public.alert_mfa_disabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status::text = 'verified' then
    perform public.raise_security_alert(null, 'mfa_disabled', old.user_id,
      jsonb_build_object('by', case when (select auth.uid()) = old.user_id then 'self' else 'admin' end, 'at', now()),
      'mfa_disabled:' || old.id);
  end if;
  return old;
end;
$$;
-- Sur un projet hébergé, le schéma `auth` peut refuser un déclencheur : la migration continue alors sans lui (avis
-- dans le journal), et la réinitialisation par le super admin reste journalisée (`security.mfa_reset`).
do $$
begin
  create trigger mfa_factor_removed after delete on auth.mfa_factors
    for each row execute function public.alert_mfa_disabled();
exception when insufficient_privilege then
  raise notice 'mfa_factor_removed : déclencheur non créé (droits du schéma auth)';
end;
$$;

-- ─── Rôle d'administrateur attribué ──────────────────────────────────────────

create or replace function public.alert_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'org_admin' and (tg_op = 'INSERT' or old.role is distinct from 'org_admin')
     -- Création de l'établissement : son premier administrateur n'est pas une alerte.
     and exists (select 1 from public.memberships m where m.organization_id = new.organization_id and m.role = 'org_admin' and m.id <> new.id) then
    perform public.raise_security_alert(new.organization_id, 'admin_role_granted', new.user_id,
      jsonb_build_object('organization', (select name from public.organizations where id = new.organization_id),
        'by', (select auth.uid()), 'at', now()),
      'admin_role:' || new.id || ':' || extract(epoch from now())::bigint, true, true);
  end if;
  return new;
end;
$$;
create trigger memberships_admin_alert after insert or update of role on public.memberships
  for each row execute function public.alert_admin_role();

-- ─── Export massif ───────────────────────────────────────────────────────────
-- `stats_export` devient VOLATILE (il enregistre l'alerte) ; même signature et même résultat.
create or replace function public.stats_export(p_org uuid, p_branch uuid, p_from date, p_to date, p_kind text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_stats_access(p_org, p_branch);
  perform public.assert_mfa(p_org, true);
  -- Export massif (S3) : plus de 92 jours d'un coup, ou plus de 10 exports dans l'heure par le même compte.
  if p_to - p_from > 92 or not public.check_rate_limit('stats_export:' || coalesce((select auth.uid())::text, 'server'), 10, interval '1 hour') then
    perform public.raise_security_alert(p_org, 'mass_export', (select auth.uid()),
      jsonb_build_object('organization', (select name from public.organizations where id = p_org), 'from', p_from, 'to', p_to, 'kind', p_kind),
      'mass_export:' || p_org || ':' || coalesce((select auth.uid())::text, 'server') || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'),
      true, true);
  end if;
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

-- ─── Envoi (expéditeur de l'application) ─────────────────────────────────────

create or replace function public.claim_security_alerts(p_limit integer default 20)
returns setof public.security_alerts
language sql
security definer
set search_path = ''
as $$
  update public.security_alerts a set status = 'sending', attempt = a.attempt + 1, updated_at = now()
  from (
    select id from public.security_alerts
    where (status = 'pending' and next_attempt_at <= now()) or (status = 'sending' and updated_at < now() - interval '2 minutes')
    order by next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ) picked
  where a.id = picked.id
  returning a.*;
$$;

create or replace function public.complete_security_alert(p_alert uuid, p_status text, p_error text default null, p_retry_in_seconds integer default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.security_alerts set
    status = case when p_status = 'sent' then 'sent' when p_retry_in_seconds is not null then 'pending' else 'failed' end,
    last_error = left(p_error, 500),
    next_attempt_at = case when p_retry_in_seconds is not null then now() + make_interval(secs => p_retry_in_seconds) else next_attempt_at end,
    updated_at = now()
  where id = p_alert;
$$;

-- Console : adresse de sécurité.
create or replace function public.admin_set_security_alert_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  update public.platform_settings set security_alert_email = nullif(trim(p_email), ''), updated_by = (select auth.uid()) where id;
  perform public.audit(null, 'platform.security_alert_email', 'platform_settings', null, jsonb_build_object('set', nullif(trim(p_email), '') is not null));
end;
$$;

revoke execute on function public.security_alert_inbox(), public.raise_security_alert(uuid, text, uuid, jsonb, text, boolean, boolean),
  public.is_admin_account(uuid), public.record_staff_login(text, text), public.record_login_failure(text), public.alert_mfa_disabled(),
  public.alert_admin_role(), public.claim_security_alerts(integer), public.complete_security_alert(uuid, text, text, integer),
  public.admin_set_security_alert_email(text)
from public, anon, authenticated;
grant execute on function public.record_staff_login(text, text), public.admin_set_security_alert_email(text) to authenticated;
grant execute on function public.record_login_failure(text), public.claim_security_alerts(integer),
  public.complete_security_alert(uuid, text, text, integer) to service_role;
