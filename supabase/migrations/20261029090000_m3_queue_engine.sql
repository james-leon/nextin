-- ═════════════════════════════════════════════════════════════════════════════
-- M3 — Moteur de file d'attente : tickets, numérotation journalière, appel en deux temps
-- (« Alerter le suivant » → called, « Admettre » → serving, chrono à l'admission),
-- estimation d'attente, temps réel (Realtime Broadcast), purges.
-- ═════════════════════════════════════════════════════════════════════════════

create type public.ticket_status as enum ('waiting', 'called', 'serving', 'served', 'no_show', 'cancelled', 'transferred');
create type public.ticket_source as enum ('qr', 'short_code', 'remote', 'reception');
create type public.priority_reason as enum ('appointment', 'pregnancy', 'elderly', 'disability', 'other');

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.daily_sequences (
  service_id uuid not null references public.services (id) on delete cascade,
  service_day date not null,
  last_number integer not null default 0,
  primary key (service_id, service_day)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  service_id uuid not null,
  service_day date not null,
  number integer not null check (number > 0),
  display_code text not null,
  -- Jeton du lien client (/t/<jeton>) ; NULL après purge des données personnelles.
  public_token text unique check (public_token ~ '^[A-Za-z0-9]{22}$'),
  customer_user_id uuid references auth.users (id) on delete set null,
  source public.ticket_source not null,
  priority_level smallint not null default 0 check (priority_level in (0, 1)),
  priority_reason public.priority_reason,
  status public.ticket_status not null default 'waiting',
  -- Ordre de passage : priorité décroissante puis sort_key croissant (≈ heure d'arrivée, en µs, strictement croissant par service).
  sort_key bigint not null,
  counter_id uuid,
  preferred_counter_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  called_at timestamptz,
  recalled_at timestamptz,
  serving_started_at timestamptz,
  finished_at timestamptz,
  recall_count smallint not null default 0,
  transferred_from_id uuid references public.tickets (id) on delete set null,
  is_remote boolean not null default false,
  presence_confirmed_at timestamptz,
  delay_count smallint not null default 0,
  rating smallint check (rating between 1 and 5),
  rating_comment text check (char_length(rating_comment) <= 500),
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (service_id, service_day, number),
  check ((priority_level = 0) = (priority_reason is null)),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  -- Pas de suppression d'un service qui a un historique de tickets (le désactiver).
  foreign key (organization_id, service_id) references public.services (organization_id, id),
  foreign key (organization_id, counter_id) references public.counters (organization_id, id) on delete set null (counter_id),
  foreign key (organization_id, preferred_counter_id) references public.counters (organization_id, id)
    on delete set null (preferred_counter_id)
);

create index tickets_waiting_idx on public.tickets (service_id, priority_level desc, sort_key, number) where status = 'waiting';
create index tickets_branch_day_idx on public.tickets (branch_id, service_day, status);
create index tickets_customer_active_idx on public.tickets (customer_user_id) where status in ('waiting', 'called', 'serving');
-- Un poste n'a jamais plus d'un ticket alerté ou admis : garantie d'unicité, même en concurrence.
create unique index tickets_one_active_per_counter_idx on public.tickets (counter_id) where status in ('called', 'serving');
create index tickets_stale_idx on public.tickets (service_day) where status in ('waiting', 'called', 'serving');

create trigger tickets_set_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

create table public.ticket_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  branch_id uuid not null,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  type text not null check (type in (
    'created', 'called', 'recalled', 'admitted', 'served', 'no_show', 'cancelled', 'transferred',
    'moved_back', 'priority_changed', 'expired', 'rated'
  )),
  actor_user_id uuid,
  counter_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id);
create index ticket_events_branch_idx on public.ticket_events (branch_id, created_at desc);

create table public.service_time_stats (
  organization_id uuid not null,
  service_id uuid not null references public.services (id) on delete cascade,
  counter_id uuid references public.counters (id) on delete cascade,
  ewma_seconds numeric not null,
  samples integer not null default 0,
  updated_at timestamptz not null default now()
);
create unique index service_time_stats_key_idx
  on public.service_time_stats (service_id, coalesce(counter_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Idempotence des commandes des postes (rejouées après une coupure réseau, PLAN §5.4).
create table public.client_ops (
  client_op_id uuid primary key,
  user_id uuid not null,
  op text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

-- ─── Utilitaires ─────────────────────────────────────────────────────────────

create or replace function public.branch_service_day(p_branch uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone b.timezone)::date from public.branches b where b.id = p_branch;
$$;

/** Agence ouverte à l'instant donné (horaires du jour local, hors fermeture exceptionnelle). */
create or replace function public.branch_is_open(p_branch uuid, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.branches b
    join public.opening_hours h on h.branch_id = b.id
    where b.id = p_branch
      and h.weekday = extract(isodow from (p_at at time zone b.timezone))::smallint
      and (p_at at time zone b.timezone)::time >= h.opens_at
      and (p_at at time zone b.timezone)::time < h.closes_at
      and not exists (
        select 1 from public.branch_closures c
        where c.branch_id = b.id and c.date = (p_at at time zone b.timezone)::date
      )
  );
$$;

create or replace function public.ticket_display_code(p_prefix text, p_number integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_prefix || '-' || lpad(p_number::text, 3, '0');
$$;

/** Diffusion Realtime (sans effet si Realtime n'est pas installé, ex. base de test minimale). */
create or replace function public.broadcast(p_topic text, p_event text, p_payload jsonb, p_private boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(p_payload, p_event, p_topic, p_private);
  end if;
end;
$$;

-- ─── Estimation (miroir de packages/shared/src/queue/estimate.ts) ────────────

create or replace function public.effective_duration_seconds(p_default integer, p_ewma numeric, p_samples integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_ewma is null or p_samples < 10 then p_default::numeric
    else least(1, (p_samples - 10) / 20.0) * p_ewma + (1 - least(1, (p_samples - 10) / 20.0)) * p_default
  end;
$$;

/** Attente (s) d'un client précédé de p_ahead personnes, postes en parallèle (le premier libre prend le suivant). */
create or replace function public.estimate_wait_seconds(p_ahead integer, p_durations numeric[], p_busy numeric[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_free numeric[] := p_busy;
  v_n integer := coalesce(array_length(p_durations, 1), 0);
  v_best integer;
begin
  if v_n = 0 then return 0; end if;
  for i in 1 .. v_n loop
    v_free[i] := greatest(0, v_free[i]);
  end loop;
  for k in 1 .. greatest(0, p_ahead) loop
    v_best := 1;
    for i in 2 .. v_n loop
      if v_free[i] < v_free[v_best] then v_best := i; end if;
    end loop;
    v_free[v_best] := v_free[v_best] + p_durations[v_best];
  end loop;
  return round((select min(x) from unnest(v_free) x));
end;
$$;

/** Charge des postes ouverts d'un service (durée retenue et temps restant du client en cours). */
create or replace function public.service_counter_loads(p_service uuid)
returns table (counter_id uuid, duration_seconds numeric, busy_remaining_seconds numeric)
language sql
stable
set search_path = ''
as $$
  with svc as (
    select s.id, s.default_service_seconds,
           st.ewma_seconds as svc_ewma, coalesce(st.samples, 0) as svc_samples
    from public.services s
    left join public.service_time_stats st on st.service_id = s.id and st.counter_id is null
    where s.id = p_service
  ),
  loads as (
    select c.id as counter_id,
           case
             when cst.samples >= 10 then public.effective_duration_seconds(svc.default_service_seconds, cst.ewma_seconds, cst.samples)
             else public.effective_duration_seconds(svc.default_service_seconds, svc.svc_ewma, svc.svc_samples)
           end as duration_seconds,
           t.status as active_status,
           t.serving_started_at
    from svc
    join public.counter_services cs on cs.service_id = svc.id
    join public.counters c on c.id = cs.counter_id and c.status = 'open' and c.active
    left join public.service_time_stats cst on cst.service_id = svc.id and cst.counter_id = c.id
    left join public.tickets t on t.counter_id = c.id and t.status in ('called', 'serving')
  )
  select counter_id, duration_seconds,
         case
           when active_status = 'serving' then greatest(0, duration_seconds - extract(epoch from now() - serving_started_at))
           when active_status = 'called' then duration_seconds
           else 0
         end
  from loads
  union all
  -- Aucun poste ouvert : un poste virtuel pour une estimation indicative.
  select null, public.effective_duration_seconds(svc.default_service_seconds, svc.svc_ewma, svc.svc_samples), 0
  from svc
  where not exists (select 1 from loads);
$$;

/** Ordre de passage dans un service : priorité, puis ancienneté (sort_key), puis numéro. */
create or replace function public.ticket_position(p_ticket uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select 1 + count(o.id)::integer
  from public.tickets t
  join public.tickets o on o.service_id = t.service_id and o.status = 'waiting' and o.id <> t.id
  where t.id = p_ticket
    and (o.priority_level > t.priority_level
         or (o.priority_level = t.priority_level and (o.sort_key, o.number) < (t.sort_key, t.number)));
$$;

create or replace function public.ticket_wait_seconds(p_ticket uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select public.estimate_wait_seconds(
    public.ticket_position(t.id) - 1,
    array_agg(l.duration_seconds),
    array_agg(l.busy_remaining_seconds)
  )
  from public.tickets t, public.service_counter_loads(t.service_id) l
  where t.id = p_ticket
  group by t.id;
$$;

/** Statistiques de durée de service, mises à jour à la fin de chaque passage (de l'admission à la fin). */
create or replace function public.record_service_duration(p_org uuid, p_service uuid, p_counter uuid, p_seconds numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter uuid;
  v_row public.service_time_stats;
begin
  if p_seconds < 20 then return; end if;
  foreach v_counter in array array[null::uuid, p_counter] loop
    select * into v_row from public.service_time_stats
    where service_id = p_service and counter_id is not distinct from v_counter
    for update;
    if not found then
      insert into public.service_time_stats (organization_id, service_id, counter_id, ewma_seconds, samples)
      values (p_org, p_service, v_counter, p_seconds, 1);
    elsif not (v_row.samples >= 10 and p_seconds > 4 * v_row.ewma_seconds) then
      update public.service_time_stats
      set ewma_seconds = case when samples = 0 then p_seconds else 0.2 * p_seconds + 0.8 * ewma_seconds end,
          samples = samples + 1,
          updated_at = now()
      where service_id = p_service and counter_id is not distinct from v_counter;
    end if;
    exit when p_counter is null;
  end loop;
end;
$$;

-- ─── Tableau d'agence (temps réel, écran TV, page client) ────────────────────

create or replace function public.branch_board(p_branch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with day as (select public.branch_service_day(p_branch) as d),
  svc as (
    select s.*
    from public.services s
    where s.branch_id = p_branch and s.active
  ),
  services_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'prefix', s.prefix,
        'name', s.name,
        'name_en', s.name_en,
        'color', s.color,
        'open', exists (
          select 1 from public.counter_services cs join public.counters c on c.id = cs.counter_id
          where cs.service_id = s.id and c.status = 'open' and c.active
        ),
        'waiting', coalesce((
          select jsonb_agg(t.display_code order by t.priority_level desc, t.sort_key, t.number)
          from public.tickets t
          where t.service_id = s.id and t.status = 'waiting' and t.service_day = (select d from day)
        ), '[]'::jsonb),
        'counters', coalesce((
          select jsonb_agg(jsonb_build_object(
            'counter_id', l.counter_id,
            'duration_seconds', round(l.duration_seconds),
            'busy_remaining_seconds', round(l.busy_remaining_seconds)))
          from public.service_counter_loads(s.id) l
        ), '[]'::jsonb),
        'wait_seconds', coalesce((
          select public.estimate_wait_seconds(
            (select count(*)::integer from public.tickets t
             where t.service_id = s.id and t.status = 'waiting' and t.service_day = (select d from day)),
            array_agg(l.duration_seconds), array_agg(l.busy_remaining_seconds))
          from public.service_counter_loads(s.id) l
        ), 0)
      ) order by s.sort_order, s.prefix), '[]'::jsonb) as v
    from svc s
  ),
  calls_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', x.display_code,
      'service_id', x.service_id,
      'status', x.status,
      'counter_kind', x.kind,
      'counter_number', x.number,
      'counter_label', x.label,
      'called_at', x.last_called_at,
      'recall_count', x.recall_count
    ) order by x.last_called_at desc), '[]'::jsonb) as v
    from (
      select t.display_code, t.service_id, t.status, c.kind, c.number, c.label, t.recall_count,
             greatest(t.called_at, coalesce(t.recalled_at, t.called_at)) as last_called_at
      from public.tickets t
      join public.counters c on c.id = t.counter_id
      where t.branch_id = p_branch and t.status in ('called', 'serving') and t.service_day = (select d from day)
      order by last_called_at desc
      limit 12
    ) x
  )
  select jsonb_build_object(
    'branch_id', p_branch,
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'services', (select v from services_json),
    'calls', (select v from calls_json)
  );
$$;

/** Vue d'un ticket pour son détenteur (aucun nom, aucune donnée personnelle). */
create or replace function public.ticket_view(p_ticket uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'display_code', t.display_code,
    'status', t.status,
    'source', t.source,
    'priority_reason', t.priority_reason,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color),
    'branch', jsonb_build_object('id', b.id, 'name', b.name),
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
    'position', case when t.status = 'waiting' then public.ticket_position(t.id) end,
    'wait_seconds', case when t.status = 'waiting' then public.ticket_wait_seconds(t.id) end,
    'counter', case when c.id is not null then jsonb_build_object('kind', c.kind, 'number', c.number, 'label', c.label) end,
    'called_at', t.called_at,
    'serving_started_at', t.serving_started_at,
    'finished_at', t.finished_at,
    'rating', t.rating,
    'rating_enabled', bs.rating_enabled,
    'created_at', t.created_at
  )
  from public.tickets t
  join public.services s on s.id = t.service_id
  join public.branches b on b.id = t.branch_id
  join public.organizations o on o.id = t.organization_id
  join public.branch_settings bs on bs.branch_id = t.branch_id
  left join public.counters c on c.id = t.counter_id
  where t.id = p_ticket;
$$;

-- ─── Diffusion temps réel ────────────────────────────────────────────────────

create or replace function public.broadcast_branch(p_branch uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board jsonb := public.branch_board(p_branch);
begin
  perform public.broadcast('branch:' || p_branch || ':board', 'board', v_board, false);
  perform public.broadcast('staff:branch:' || p_branch, 'board', v_board, true);
end;
$$;

create or replace function public.tickets_broadcast_statement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
begin
  for v_branch in
    select distinct branch_id from changed_rows
  loop
    perform public.broadcast_branch(v_branch);
  end loop;
  return null;
end;
$$;

create trigger tickets_broadcast_insert after insert on public.tickets
  referencing new table as changed_rows for each statement execute function public.tickets_broadcast_statement();
create trigger tickets_broadcast_update after update on public.tickets
  referencing new table as changed_rows for each statement execute function public.tickets_broadcast_statement();
create trigger tickets_broadcast_delete after delete on public.tickets
  referencing old table as changed_rows for each statement execute function public.tickets_broadcast_statement();
create trigger counters_broadcast_update after update on public.counters
  referencing new table as changed_rows for each statement execute function public.tickets_broadcast_statement();

/** Ticket suivi par son détenteur : topic public dont le nom contient le jeton secret. */
create or replace function public.ticket_broadcast_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.public_token is not null and (
    tg_op = 'INSERT'
    or (new.status, new.sort_key, new.priority_level, new.counter_id, new.recall_count)
       is distinct from (old.status, old.sort_key, old.priority_level, old.counter_id, old.recall_count)
  ) then
    perform public.broadcast('ticket:' || new.public_token, 'ticket', public.ticket_view(new.id), false);
  end if;
  return null;
end;
$$;

create trigger tickets_broadcast_row after insert or update on public.tickets
  for each row execute function public.ticket_broadcast_row();

-- Canal privé du personnel : réservé au personnel de l'agence.
create or replace function public.can_access_branch_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_org uuid;
begin
  if p_topic !~ '^staff:branch:[0-9a-f-]{36}$' then return false; end if;
  v_branch := substr(p_topic, 14)::uuid;
  select organization_id into v_org from public.branches where id = v_branch;
  return v_org is not null and (public.can_access_branch(v_org, v_branch) or public.is_platform_admin());
end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy nextin_staff_branch_topic on realtime.messages for select to authenticated
      using (realtime.messages.extension = 'broadcast' and public.can_access_branch_topic((select realtime.topic())))
    $p$;
  end if;
end;
$$;

-- ─── Création de tickets ─────────────────────────────────────────────────────

create or replace function public.next_ticket_number(p_service uuid, p_day date)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.daily_sequences as d (service_id, service_day, last_number)
  values (p_service, p_day, 1)
  on conflict (service_id, service_day) do update set last_number = d.last_number + 1
  returning last_number;
$$;

/** Insertion commune (client, accueil, transfert). Contrôles métier faits par l'appelant. */
create or replace function public.insert_ticket(
  p_service uuid,
  p_source public.ticket_source,
  p_priority_reason public.priority_reason,
  p_customer uuid,
  p_created_by uuid,
  p_public_token text default null,
  p_sort_key bigint default null,
  p_transferred_from uuid default null
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.services;
  v_day date;
  v_number integer;
  v_row public.tickets;
begin
  select * into v_s from public.services where id = p_service;
  v_day := public.branch_service_day(v_s.branch_id);
  -- La ligne de daily_sequences, verrouillée par next_ticket_number, sérialise les créations d'un même service.
  v_number := public.next_ticket_number(p_service, v_day);
  insert into public.tickets (
    organization_id, branch_id, service_id, service_day, number, display_code, public_token,
    customer_user_id, source, priority_level, priority_reason, sort_key, created_by, is_remote, transferred_from_id
  ) values (
    v_s.organization_id, v_s.branch_id, p_service, v_day, v_number, public.ticket_display_code(v_s.prefix, v_number),
    coalesce(p_public_token, public.random_string(22, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')),
    p_customer, p_source, case when p_priority_reason is null then 0 else 1 end, p_priority_reason,
    coalesce(p_sort_key, greatest(
      (extract(epoch from clock_timestamp()) * 1000000)::bigint,
      (select max(o.sort_key) + 1 from public.tickets o where o.service_id = p_service and o.service_day = v_day)
    )),
    p_created_by, p_source = 'remote', p_transferred_from
  )
  returning * into v_row;
  insert into public.ticket_events (organization_id, branch_id, ticket_id, type, actor_user_id, payload)
  values (v_row.organization_id, v_row.branch_id, v_row.id, 'created', p_created_by,
          jsonb_build_object('source', p_source, 'priority_reason', p_priority_reason));
  return v_row;
end;
$$;

/** Contrôles communs à la prise de ticket (client et accueil). */
create or replace function public.assert_can_issue(p_service uuid, p_priority_reason public.priority_reason, p_check_hours boolean)
returns public.services
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.services;
  v_settings public.branch_settings;
  v_count integer;
begin
  select s.* into v_s
  from public.services s
  join public.branches b on b.id = s.branch_id and b.active
  join public.organizations o on o.id = s.organization_id and o.status = 'active'
  where s.id = p_service;
  if not found then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if not v_s.active then
    raise exception 'service_closed' using errcode = 'P0410';
  end if;
  if p_check_hours and not public.branch_is_open(v_s.branch_id) then
    raise exception 'branch_closed' using errcode = 'P0410';
  end if;
  select * into v_settings from public.branch_settings where branch_id = v_s.branch_id;
  if p_priority_reason is not null and not (v_settings.priorities_enabled and v_s.allow_priority) then
    raise exception 'priority_not_allowed' using errcode = 'P0422';
  end if;
  if v_s.max_daily_tickets is not null then
    select coalesce(last_number, 0) into v_count from public.daily_sequences
    where service_id = p_service and service_day = public.branch_service_day(v_s.branch_id);
    if coalesce(v_count, 0) >= v_s.max_daily_tickets then
      raise exception 'quota_reached' using errcode = 'P0410';
    end if;
  end if;
  return v_s;
end;
$$;

/**
 * Limitation des demandes de ticket, appelée par le serveur avant take_ticket dans une transaction à part :
 * les tentatives refusées (code invalide, ticket déjà actif…) sont ainsi comptées elles aussi.
 */
create or replace function public.throttle_ticket_request(p_customer uuid, p_ip_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.check_rate_limit('take_ticket:uid:' || coalesce(p_customer::text, 'none'), 10, interval '1 hour')
     and (p_ip_hash is null or public.check_rate_limit('take_ticket:ip:' || p_ip_hash, 60, interval '10 minutes'));
$$;

/**
 * Prise de ticket par un client (appelée par le serveur de l'application, service role uniquement :
 * captcha vérifié et IP hachée en amont). L'entrée (QR ou code court) prouve le passage sur place.
 */
create or replace function public.take_ticket(
  p_service uuid,
  p_source public.ticket_source,
  p_entry_code text,
  p_priority_reason public.priority_reason,
  p_customer uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.services;
  v_settings public.branch_settings;
  v_existing public.tickets;
  v_active integer;
  v_row public.tickets;
begin
  if p_customer is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_source = 'reception' then
    raise exception 'invalid_entry' using errcode = 'P0422';
  end if;
  v_s := public.assert_can_issue(p_service, p_priority_reason, true);
  select * into v_settings from public.branch_settings where branch_id = v_s.branch_id;

  if p_source in ('qr', 'short_code') then
    if not exists (
      select 1 from public.qr_codes q
      where q.branch_id = v_s.branch_id and q.active
        and (q.service_id is null or q.service_id = p_service)
        and (q.token = p_entry_code or q.short_code = upper(p_entry_code))
    ) then
      raise exception 'invalid_entry' using errcode = 'P0422';
    end if;
  elsif p_source = 'remote' and not (v_settings.remote_tickets_enabled and v_s.allow_remote) then
    raise exception 'remote_not_allowed' using errcode = 'P0422';
  end if;

  -- Un client ne cumule pas les tickets dans une même agence : on lui rend son ticket actif.
  select count(*) into v_active from public.tickets
  where customer_user_id = p_customer and branch_id = v_s.branch_id and status in ('waiting', 'called', 'serving');
  if v_active >= v_settings.max_active_tickets_per_customer then
    select * into v_existing from public.tickets
    where customer_user_id = p_customer and branch_id = v_s.branch_id and status in ('waiting', 'called', 'serving')
    order by created_at desc limit 1;
    raise exception 'active_ticket_exists' using errcode = 'P0422', detail = v_existing.public_token;
  end if;

  v_row := public.insert_ticket(p_service, p_source, p_priority_reason, p_customer, null);
  return jsonb_build_object('ticket_id', v_row.id, 'public_token', v_row.public_token, 'display_code', v_row.display_code);
end;
$$;

-- ─── Droits du personnel et idempotence ──────────────────────────────────────

create or replace function public.assert_branch_staff(p_branch uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null or public.is_anonymous() or not (public.can_access_branch(v_org, p_branch) or public.is_platform_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return v_org;
end;
$$;

create or replace function public.client_op_replay(p_op uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('result', result) from public.client_ops where client_op_id = p_op and user_id = (select auth.uid());
$$;

create or replace function public.client_op_save(p_op uuid, p_name text, p_result jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.client_ops (client_op_id, user_id, op, result)
  values (p_op, (select auth.uid()), p_name, p_result)
  on conflict (client_op_id) do nothing;
$$;

create or replace function public.log_ticket_event(p_ticket public.tickets, p_type text, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ticket_events (organization_id, branch_id, ticket_id, type, actor_user_id, counter_id, payload)
  values (p_ticket.organization_id, p_ticket.branch_id, p_ticket.id, p_type, (select auth.uid()), p_ticket.counter_id, p_payload);
$$;

/** Résumé renvoyé aux postes après une commande. */
create or replace function public.staff_ticket_json(p_ticket public.tickets)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_ticket.id,
    'display_code', p_ticket.display_code,
    'status', p_ticket.status,
    'service_id', p_ticket.service_id,
    'service_name', (select name from public.services where id = p_ticket.service_id),
    'priority_reason', p_ticket.priority_reason,
    'counter_id', p_ticket.counter_id,
    'called_at', p_ticket.called_at,
    'serving_started_at', p_ticket.serving_started_at,
    'finished_at', p_ticket.finished_at,
    'recall_count', p_ticket.recall_count,
    'created_at', p_ticket.created_at,
    'public_token', p_ticket.public_token
  );
$$;

/** Ticket créé à l'accueil (patient sans smartphone) ; le jeton permet d'imprimer un QR de suivi. */
create or replace function public.reception_create_ticket(
  p_service uuid,
  p_priority_reason public.priority_reason default null,
  p_client_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.services;
  v_row public.tickets;
  v_replay jsonb;
  v_result jsonb;
begin
  select * into v_s from public.services where id = p_service;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_s.branch_id);
  if p_client_op_id is not null then
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then return v_replay -> 'result'; end if;
  end if;
  perform public.assert_can_issue(p_service, p_priority_reason, false);
  v_row := public.insert_ticket(p_service, 'reception', p_priority_reason, null, (select auth.uid()));
  v_result := public.staff_ticket_json(v_row);
  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, 'reception_create_ticket', v_result); end if;
  return v_result;
end;
$$;

-- ─── Postes : ouverture, pause, fermeture ────────────────────────────────────

create or replace function public.set_counter_status(p_counter uuid, p_status public.counter_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.counters;
begin
  select * into v_c from public.counters where id = p_counter for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_c.branch_id);
  if not v_c.active then raise exception 'counter_not_open' using errcode = 'P0409'; end if;
  if p_status <> 'open' and exists (select 1 from public.tickets where counter_id = p_counter and status in ('called', 'serving')) then
    raise exception 'counter_busy' using errcode = 'P0409';
  end if;
  update public.counters
  set status = p_status,
      status_changed_at = now(),
      current_agent_id = case when p_status = 'open' then (select auth.uid()) when p_status = 'closed' then null else current_agent_id end
  where id = p_counter
  returning * into v_c;
  -- Pause ou fermeture : les patients attitrés repassent dans la file commune (redistribution sur les autres postes).
  if p_status <> 'open' then
    update public.tickets set preferred_counter_id = null where preferred_counter_id = p_counter and status = 'waiting';
  end if;
  perform public.audit(v_c.organization_id, 'counter.' || p_status::text, 'counter', p_counter, '{}'::jsonb);
  return jsonb_build_object('id', v_c.id, 'status', v_c.status, 'status_changed_at', v_c.status_changed_at);
end;
$$;

create or replace function public.open_counter(p_counter uuid) returns jsonb
language sql security definer set search_path = '' as $$ select public.set_counter_status(p_counter, 'open'); $$;
create or replace function public.pause_counter(p_counter uuid) returns jsonb
language sql security definer set search_path = '' as $$ select public.set_counter_status(p_counter, 'paused'); $$;
create or replace function public.close_counter(p_counter uuid) returns jsonb
language sql security definer set search_path = '' as $$ select public.set_counter_status(p_counter, 'closed'); $$;

-- ─── Appel en deux temps ─────────────────────────────────────────────────────

/** Fin de passage (interne) : le chrono court de l'admission à la fin ; met à jour les statistiques. */
create or replace function public.finish_ticket_internal(p_ticket public.tickets)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  update public.tickets set status = 'served', finished_at = now() where id = p_ticket.id returning * into v_row;
  perform public.record_service_duration(v_row.organization_id, v_row.service_id, v_row.counter_id,
    extract(epoch from v_row.finished_at - v_row.serving_started_at));
  perform public.log_ticket_event(v_row, 'served',
    jsonb_build_object('service_seconds', round(extract(epoch from v_row.finished_at - v_row.serving_started_at))));
  return v_row;
end;
$$;

/**
 * « Alerter le suivant » : prend le prochain ticket des services du poste (`called`).
 * Avec p_finish_current, termine d'abord le patient admis (« Terminer et alerter le suivant »).
 * Refuse si un patient alerté n'a pas encore été admis (l'admettre, le rappeler ou le déclarer absent).
 * Renvoie le ticket alerté, ou null si la file est vide.
 */
create or replace function public.call_next(p_counter uuid, p_client_op_id uuid default null, p_finish_current boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.counters;
  v_current public.tickets;
  v_next public.tickets;
  v_replay jsonb;
  v_result jsonb;
begin
  select * into v_c from public.counters where id = p_counter for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_c.branch_id);
  if p_client_op_id is not null then
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then return v_replay -> 'result'; end if;
  end if;
  if v_c.status <> 'open' or not v_c.active then
    raise exception 'counter_not_open' using errcode = 'P0409';
  end if;

  select * into v_current from public.tickets where counter_id = p_counter and status in ('called', 'serving') for update;
  if found then
    if v_current.status = 'serving' and p_finish_current then
      perform public.finish_ticket_internal(v_current);
    else
      raise exception 'counter_busy' using errcode = 'P0409';
    end if;
  end if;

  select t.* into v_next
  from public.tickets t
  join public.counter_services cs on cs.service_id = t.service_id and cs.counter_id = p_counter
  left join public.counters pc on pc.id = t.preferred_counter_id
  where t.branch_id = v_c.branch_id
    and t.status = 'waiting'
    and t.service_day = public.branch_service_day(v_c.branch_id)
    and (t.preferred_counter_id is null or t.preferred_counter_id = p_counter or pc.status <> 'open')
  order by coalesce(t.preferred_counter_id = p_counter, false) desc, t.priority_level desc, t.sort_key, t.number
  limit 1
  for update of t skip locked;

  if found then
    update public.tickets set status = 'called', counter_id = p_counter, called_at = now()
    where id = v_next.id returning * into v_next;
    perform public.log_ticket_event(v_next, 'called');
    v_result := public.staff_ticket_json(v_next);
  end if;

  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, 'call_next', v_result); end if;
  return v_result;
end;
$$;

/** Verrouille un ticket et vérifie que l'appelant est du personnel de son agence et que son état convient. */
create or replace function public.lock_staff_ticket(p_ticket uuid, p_allowed public.ticket_status[])
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  select * into v_row from public.tickets where id = p_ticket for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_row.branch_id);
  if not (v_row.status = any (p_allowed)) then
    raise exception 'invalid_state' using errcode = 'P0409', detail = v_row.status::text;
  end if;
  return v_row;
end;
$$;

/** Exécute une commande de poste une seule fois par identifiant (rejouable hors ligne). */
create or replace function public.staff_ticket_command(p_ticket uuid, p_command text, p_client_op_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
  v_replay jsonb;
  v_result jsonb;
begin
  if p_client_op_id is not null then
    -- Rejeu possible seulement par le même utilisateur ; l'appartenance à l'agence est revérifiée ci-dessous.
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then
      perform public.assert_branch_staff((select branch_id from public.tickets where id = p_ticket));
      return v_replay -> 'result';
    end if;
  end if;

  case p_command
    when 'admit' then
      -- « Admettre » : le patient entre, le chrono démarre maintenant.
      v_row := public.lock_staff_ticket(p_ticket, array['called']::public.ticket_status[]);
      update public.tickets set status = 'serving', serving_started_at = now() where id = p_ticket returning * into v_row;
      perform public.log_ticket_event(v_row, 'admitted',
        jsonb_build_object('wait_after_call_seconds', round(extract(epoch from now() - v_row.called_at))));
    when 'finish' then
      v_row := public.lock_staff_ticket(p_ticket, array['serving']::public.ticket_status[]);
      v_row := public.finish_ticket_internal(v_row);
    when 'recall' then
      v_row := public.lock_staff_ticket(p_ticket, array['called']::public.ticket_status[]);
      update public.tickets set recall_count = recall_count + 1, recalled_at = now() where id = p_ticket returning * into v_row;
      perform public.log_ticket_event(v_row, 'recalled', jsonb_build_object('recall_count', v_row.recall_count));
    when 'no_show' then
      v_row := public.lock_staff_ticket(p_ticket, array['called']::public.ticket_status[]);
      update public.tickets set status = 'no_show', finished_at = now() where id = p_ticket returning * into v_row;
      perform public.log_ticket_event(v_row, 'no_show');
    when 'cancel' then
      v_row := public.lock_staff_ticket(p_ticket, array['waiting', 'called']::public.ticket_status[]);
      update public.tickets set status = 'cancelled', finished_at = now() where id = p_ticket returning * into v_row;
      perform public.log_ticket_event(v_row, 'cancelled', jsonb_build_object('by', 'staff'));
    else
      raise exception 'invalid_state' using errcode = 'P0409';
  end case;

  v_result := public.staff_ticket_json(v_row);
  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, p_command, v_result); end if;
  return v_result;
end;
$$;

create or replace function public.admit_ticket(p_ticket uuid, p_client_op_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$ select public.staff_ticket_command(p_ticket, 'admit', p_client_op_id); $$;
create or replace function public.finish_ticket(p_ticket uuid, p_client_op_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$ select public.staff_ticket_command(p_ticket, 'finish', p_client_op_id); $$;
create or replace function public.recall_ticket(p_ticket uuid, p_client_op_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$ select public.staff_ticket_command(p_ticket, 'recall', p_client_op_id); $$;
create or replace function public.mark_no_show(p_ticket uuid, p_client_op_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$ select public.staff_ticket_command(p_ticket, 'no_show', p_client_op_id); $$;
create or replace function public.cancel_ticket(p_ticket uuid, p_client_op_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$ select public.staff_ticket_command(p_ticket, 'cancel', p_client_op_id); $$;

/**
 * Réorientation vers un autre service de la même agence : nouveau numéro dans le service cible,
 * même priorité et même ancienneté ; le lien du client (jeton) suit le nouveau ticket.
 */
create or replace function public.transfer_ticket(p_ticket uuid, p_target_service uuid, p_client_op_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.tickets;
  v_new public.tickets;
  v_token text;
  v_replay jsonb;
  v_result jsonb;
begin
  if p_client_op_id is not null then
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then return v_replay -> 'result'; end if;
  end if;
  v_old := public.lock_staff_ticket(p_ticket, array['waiting', 'called', 'serving']::public.ticket_status[]);
  if not exists (select 1 from public.services where id = p_target_service and branch_id = v_old.branch_id and active)
     or p_target_service = v_old.service_id then
    raise exception 'invalid_entry' using errcode = 'P0422';
  end if;
  v_token := v_old.public_token;
  update public.tickets set status = 'transferred', finished_at = now(), public_token = null where id = p_ticket returning * into v_old;
  v_new := public.insert_ticket(p_target_service, v_old.source, v_old.priority_reason, v_old.customer_user_id,
                                (select auth.uid()), v_token, v_old.sort_key, v_old.id);
  perform public.log_ticket_event(v_old, 'transferred', jsonb_build_object('to_ticket_id', v_new.id, 'to_service_id', p_target_service));
  v_result := public.staff_ticket_json(v_new);
  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, 'transfer', v_result); end if;
  return v_result;
end;
$$;

/** Priorité donnée ou retirée par l'accueil (rendez-vous, grossesse, personne âgée…). */
create or replace function public.set_ticket_priority(p_ticket uuid, p_reason public.priority_reason)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  v_row := public.lock_staff_ticket(p_ticket, array['waiting']::public.ticket_status[]);
  update public.tickets
  set priority_reason = p_reason, priority_level = case when p_reason is null then 0 else 1 end
  where id = p_ticket returning * into v_row;
  perform public.log_ticket_event(v_row, 'priority_changed', jsonb_build_object('priority_reason', p_reason));
  perform public.audit(v_row.organization_id, 'ticket.priority_change', 'ticket', v_row.id, jsonb_build_object('priority_reason', p_reason));
  return public.staff_ticket_json(v_row);
end;
$$;

/** Fait reculer un ticket de N places dans sa file (sans renuméroter les autres). */
create or replace function public.move_back_ticket(p_ticket uuid, p_places integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
  v_keys bigint[];
  v_target bigint;
  v_next bigint;
begin
  if p_places not between 1 and 50 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  v_row := public.lock_staff_ticket(p_ticket, array['waiting']::public.ticket_status[]);
  -- Clés des tickets suivants : le ticket se place entre le N-ième et le (N+1)-ième.
  select array_agg(k order by k) into v_keys from (
    select o.sort_key as k
    from public.tickets o
    where o.service_id = v_row.service_id and o.status = 'waiting' and o.id <> v_row.id
      and o.priority_level = v_row.priority_level
      and (o.sort_key, o.number) > (v_row.sort_key, v_row.number)
    order by o.sort_key, o.number
    limit p_places + 1
  ) after_me;
  v_target := v_keys[least(p_places, coalesce(array_length(v_keys, 1), 0))];
  v_next := case when array_length(v_keys, 1) > p_places then v_keys[p_places + 1] end;
  if v_target is not null then
    update public.tickets
    set sort_key = case when v_next is null then v_target + 1 else v_target + greatest(1, (v_next - v_target) / 2) end
    where id = p_ticket returning * into v_row;
    perform public.log_ticket_event(v_row, 'moved_back', jsonb_build_object('places', p_places));
  end if;
  return public.staff_ticket_json(v_row);
end;
$$;

-- ─── Surface publique (clients) ──────────────────────────────────────────────

/**
 * Entrée d'un client : jeton du QR code ou code court de secours (insensible à la casse).
 * Renvoie l'établissement, l'agence et ses services ouverts avec l'attente estimée, sans donnée personnelle.
 */
create or replace function public.resolve_entry(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'entry_code', q.token,
    'source', case when q.token = p_code then 'qr' else 'short_code' end,
    'service_id', q.service_id,
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale, 'type', o.type),
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city, 'is_open', public.branch_is_open(b.id)),
    'priorities_enabled', bs.priorities_enabled,
    'board', public.branch_board(b.id)
  )
  from public.qr_codes q
  join public.branches b on b.id = q.branch_id and b.active
  join public.organizations o on o.id = q.organization_id and o.status = 'active'
  join public.branch_settings bs on bs.branch_id = b.id
  where q.active and (q.token = p_code or q.short_code = upper(trim(p_code)))
  limit 1;
$$;

/** Tableau public d'une agence (écran TV, suivi client) : codes de tickets et postes, jamais de nom. */
create or replace function public.get_branch_board(p_branch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.branch_board(b.id)
  from public.branches b
  join public.organizations o on o.id = b.organization_id and o.status = 'active'
  where b.id = p_branch and b.active;
$$;

/** Ticket d'un client à partir de son jeton (lien /t/<jeton>, aussi envoyé par WhatsApp). */
create or replace function public.get_ticket(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.ticket_view(t.id) from public.tickets t where t.public_token = p_token;
$$;

create or replace function public.cancel_my_ticket(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  select * into v_row from public.tickets where public_token = p_token for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_row.status not in ('waiting', 'called') then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.tickets set status = 'cancelled', finished_at = now() where id = v_row.id returning * into v_row;
  insert into public.ticket_events (organization_id, branch_id, ticket_id, type, payload)
  values (v_row.organization_id, v_row.branch_id, v_row.id, 'cancelled', jsonb_build_object('by', 'customer'));
  return public.ticket_view(v_row.id);
end;
$$;

create or replace function public.rate_ticket(p_token text, p_rating smallint, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  select * into v_row from public.tickets where public_token = p_token for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_row.status <> 'served' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  if v_row.rating is not null then raise exception 'already_rated' using errcode = 'P0409'; end if;
  if not (select rating_enabled from public.branch_settings where branch_id = v_row.branch_id) then
    raise exception 'rating_disabled' using errcode = 'P0409';
  end if;
  if p_rating not between 1 and 5 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.tickets
  set rating = p_rating, rating_comment = nullif(trim(left(p_comment, 500)), ''), rated_at = now()
  where id = v_row.id returning * into v_row;
  insert into public.ticket_events (organization_id, branch_id, ticket_id, type, payload)
  values (v_row.organization_id, v_row.branch_id, v_row.id, 'rated', jsonb_build_object('rating', p_rating));
  return public.ticket_view(v_row.id);
end;
$$;

-- ─── Tâches planifiées ───────────────────────────────────────────────────────

/** Tickets restés ouverts d'un jour précédent : clôturés (la numérotation repart à 1 chaque jour). */
create or replace function public.expire_stale_tickets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with stale as (
    update public.tickets t
    set status = case when t.status = 'serving' then 'served'::public.ticket_status else 'cancelled'::public.ticket_status end,
        finished_at = coalesce(t.finished_at, now())
    from public.branches b
    where b.id = t.branch_id and t.status in ('waiting', 'called', 'serving')
      and t.service_day < (now() at time zone b.timezone)::date
    returning t.*
  )
  insert into public.ticket_events (organization_id, branch_id, ticket_id, type)
  select organization_id, branch_id, id, 'expired' from stale;
  get diagnostics v_count = row_count;
  delete from public.daily_sequences where service_day < current_date - 7;
  return v_count;
end;
$$;

/**
 * Données personnelles effacées après organizations.data_retention_days (défaut 30 j) :
 * jeton du lien client, compte anonyme rattaché, commentaire libre. Restent les statistiques anonymes.
 * (Les modules suivants étendent cette purge : contacts de notification, rendez-vous.)
 */
create or replace function public.purge_personal_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.tickets t
  set public_token = null, customer_user_id = null, rating_comment = null
  from public.organizations o
  where o.id = t.organization_id
    and t.created_at < now() - make_interval(days => o.data_retention_days)
    and (t.public_token is not null or t.customer_user_id is not null or t.rating_comment is not null);
  get diagnostics v_count = row_count;
  delete from public.client_ops where created_at < now() - interval '7 days';
  return v_count;
end;
$$;

/** Comptes anonymes inactifs supprimés, sauf ceux qui suivent encore un ticket actif. */
create or replace function public.purge_inactive_anonymous_users(p_inactive_for interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with doomed as (
    select u.id
    from auth.users u
    where u.is_anonymous is true
      and coalesce(u.last_sign_in_at, u.created_at) < now() - p_inactive_for
      and not exists (
        select 1 from public.tickets t
        where t.customer_user_id = u.id and t.status in ('waiting', 'called', 'serving')
      )
    limit 10000
  )
  delete from auth.users u using doomed where u.id = doomed.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

select cron.schedule('nextin-expire-stale-tickets', '5 0 * * *', $$select public.expire_stale_tickets()$$);
select cron.schedule('nextin-purge-personal-data', '35 2 * * *', $$select public.purge_personal_data()$$);

-- ─── Droits d'exécution ──────────────────────────────────────────────────────

revoke execute on function
  public.branch_service_day(uuid), public.branch_is_open(uuid, timestamptz), public.broadcast(text, text, jsonb, boolean),
  public.service_counter_loads(uuid), public.ticket_position(uuid), public.ticket_wait_seconds(uuid),
  public.record_service_duration(uuid, uuid, uuid, numeric), public.branch_board(uuid), public.ticket_view(uuid),
  public.broadcast_branch(uuid), public.tickets_broadcast_statement(), public.ticket_broadcast_row(),
  public.next_ticket_number(uuid, date),
  public.insert_ticket(uuid, public.ticket_source, public.priority_reason, uuid, uuid, text, bigint, uuid),
  public.assert_can_issue(uuid, public.priority_reason, boolean), public.throttle_ticket_request(uuid, text), public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid),
  public.assert_branch_staff(uuid), public.client_op_replay(uuid), public.client_op_save(uuid, text, jsonb),
  public.log_ticket_event(public.tickets, text, jsonb), public.staff_ticket_json(public.tickets),
  public.set_counter_status(uuid, public.counter_status), public.finish_ticket_internal(public.tickets),
  public.lock_staff_ticket(uuid, public.ticket_status[]), public.staff_ticket_command(uuid, text, uuid),
  public.expire_stale_tickets(), public.purge_personal_data(), public.purge_inactive_anonymous_users(interval)
from public, anon, authenticated;

-- Calcul pur, partagé avec l'application (tests de parité).
grant execute on function public.effective_duration_seconds(integer, numeric, integer), public.estimate_wait_seconds(integer, numeric[], numeric[]),
  public.ticket_display_code(text, integer)
to anon, authenticated;

grant execute on function public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid),
  public.throttle_ticket_request(uuid, text) to service_role;
grant execute on function public.can_access_branch_topic(text) to authenticated;

grant execute on function public.resolve_entry(text), public.get_branch_board(uuid), public.get_ticket(text),
  public.cancel_my_ticket(text), public.rate_ticket(text, smallint, text)
to anon, authenticated;

grant execute on function
  public.reception_create_ticket(uuid, public.priority_reason, uuid),
  public.open_counter(uuid), public.pause_counter(uuid), public.close_counter(uuid),
  public.call_next(uuid, uuid, boolean),
  public.admit_ticket(uuid, uuid), public.finish_ticket(uuid, uuid), public.recall_ticket(uuid, uuid),
  public.mark_no_show(uuid, uuid), public.cancel_ticket(uuid, uuid),
  public.transfer_ticket(uuid, uuid, uuid), public.set_ticket_priority(uuid, public.priority_reason),
  public.move_back_ticket(uuid, integer)
to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.daily_sequences enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.service_time_stats enable row level security;
alter table public.client_ops enable row level security;

revoke all on public.daily_sequences, public.tickets, public.ticket_events, public.service_time_stats, public.client_ops from anon;
revoke all on public.daily_sequences, public.client_ops from authenticated;
-- Écritures uniquement par les RPC ci-dessus.
revoke insert, update, delete, truncate on public.tickets, public.ticket_events, public.service_time_stats from authenticated;

create policy tickets_select on public.tickets for select to authenticated
  using (
    customer_user_id = (select auth.uid())
    or public.can_access_branch(organization_id, branch_id)
    or public.is_platform_admin()
  );
create policy ticket_events_select on public.ticket_events for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin());
create policy service_time_stats_select on public.service_time_stats for select to authenticated
  using (exists (
    select 1 from public.services s
    where s.id = service_id and (public.can_access_branch(s.organization_id, s.branch_id) or public.is_platform_admin())
  ));
