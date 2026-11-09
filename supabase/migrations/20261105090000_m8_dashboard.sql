-- M8 — Tableau de bord (docs/PLAN.md §3.10) : cumuls journaliers par service et par poste (pg_cron chaque nuit,
-- historique repris à l'installation), journée en cours calculée en direct, RPC du tableau de bord et de l'export CSV.
-- Statistiques anonymes : comptes, durées, notes. Jamais de nom, de numéro ni de repère de patient.

-- ─── Cumuls journaliers ──────────────────────────────────────────────────────

/** Par agence, service et jour (jour de service local de l'agence). */
create table public.daily_branch_stats (
  organization_id uuid not null,
  branch_id uuid not null,
  service_id uuid not null,
  day date not null,
  issued integer not null default 0,
  served integer not null default 0,
  no_show integer not null default 0,
  cancelled integer not null default 0,
  transferred integer not null default 0,
  remote integer not null default 0,
  appointment integer not null default 0,
  -- Attente : de la prise du ticket à la première alerte.
  wait_seconds_sum bigint not null default 0,
  wait_count integer not null default 0,
  max_wait_seconds integer not null default 0,
  -- Service : de l'admission à la fin (jamais depuis l'alerte).
  service_seconds_sum bigint not null default 0,
  service_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  -- Tickets pris par heure locale (0 → 23).
  hourly integer[] not null default array_fill(0, array[24]),
  updated_at timestamptz not null default now(),
  primary key (service_id, day),
  check (array_length(hourly, 1) = 24),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete cascade
);
create index daily_branch_stats_branch_day_idx on public.daily_branch_stats (branch_id, day);
create index daily_branch_stats_org_day_idx on public.daily_branch_stats (organization_id, day);

/** Par poste et jour : activité, temps d'ouverture et de pause ; praticien attitré au moment du cumul. */
create table public.daily_counter_stats (
  organization_id uuid not null,
  branch_id uuid not null,
  counter_id uuid not null,
  day date not null,
  practitioner_id uuid,
  called integer not null default 0,
  served integer not null default 0,
  no_show integer not null default 0,
  service_seconds_sum bigint not null default 0,
  service_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  open_seconds integer not null default 0,
  pause_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (counter_id, day),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, counter_id) references public.counters (organization_id, id) on delete cascade,
  foreign key (organization_id, practitioner_id) references public.practitioners (organization_id, id) on delete set null (practitioner_id)
);
create index daily_counter_stats_branch_day_idx on public.daily_counter_stats (branch_id, day);

-- ─── Calcul d'une journée (cumul nocturne et journée en cours) ───────────────

create or replace function public.compute_branch_stats(p_branch uuid, p_day date)
returns setof public.daily_branch_stats
language sql
stable
security definer
set search_path = ''
as $$
  with b as (select id, organization_id, timezone from public.branches where id = p_branch),
  t as (
    select t.*, extract(hour from t.created_at at time zone b.timezone)::int as h
    from public.tickets t join b on b.id = t.branch_id
    where t.service_day = p_day
  )
  select b.organization_id, b.id, s.id, p_day,
    count(t.id)::int,
    (count(*) filter (where t.status = 'served'))::int,
    (count(*) filter (where t.status = 'no_show'))::int,
    (count(*) filter (where t.status = 'cancelled'))::int,
    (count(*) filter (where t.status = 'transferred'))::int,
    (count(*) filter (where t.source = 'remote'))::int,
    (count(*) filter (where t.appointment_id is not null))::int,
    coalesce(sum(extract(epoch from t.called_at - t.created_at)) filter (where t.called_at is not null), 0)::bigint,
    (count(*) filter (where t.called_at is not null))::int,
    coalesce(max(extract(epoch from t.called_at - t.created_at)) filter (where t.called_at is not null), 0)::int,
    coalesce(sum(extract(epoch from t.finished_at - t.serving_started_at))
      filter (where t.status = 'served' and t.serving_started_at is not null), 0)::bigint,
    (count(*) filter (where t.status = 'served' and t.serving_started_at is not null))::int,
    coalesce(sum(t.rating), 0)::int,
    count(t.rating)::int,
    (select array_agg(coalesce(x.n, 0) order by g.h)
     from generate_series(0, 23) g(h)
     left join (select t2.h, count(*)::int as n from t t2 where t2.service_id = s.id group by t2.h) x on x.h = g.h),
    now()
  from b
  join public.services s on s.branch_id = b.id
  left join t on t.service_id = s.id
  group by b.organization_id, b.id, s.id
  having count(t.id) > 0;
$$;

create or replace function public.compute_counter_stats(p_branch uuid, p_day date)
returns setof public.daily_counter_stats
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select id, organization_id, (p_day::timestamp at time zone timezone) as d0, ((p_day + 1)::timestamp at time zone timezone) as d1
    from public.branches where id = p_branch
  ),
  t as (select t.* from public.tickets t join b on b.id = t.branch_id where t.service_day = p_day and t.counter_id is not null),
  c as (
    select c.*,
      (select coalesce(sum(extract(epoch from least(coalesce(cs.ended_at, now()), b.d1) - greatest(cs.started_at, b.d0))), 0)
       from public.counter_sessions cs
       where cs.counter_id = c.id and cs.started_at < b.d1 and coalesce(cs.ended_at, now()) > b.d0)::int as open_s,
      (select coalesce(sum(extract(epoch from least(coalesce(cp.ended_at, now()), b.d1) - greatest(cp.started_at, b.d0))), 0)
       from public.counter_pauses cp
       where cp.counter_id = c.id and cp.started_at < b.d1 and coalesce(cp.ended_at, now()) > b.d0)::int as pause_s
    from public.counters c join b on c.branch_id = b.id
  )
  select b.organization_id, b.id, c.id, p_day, c.default_practitioner_id,
    (count(*) filter (where t.called_at is not null))::int,
    (count(*) filter (where t.status = 'served'))::int,
    (count(*) filter (where t.status = 'no_show'))::int,
    coalesce(sum(extract(epoch from t.finished_at - t.serving_started_at))
      filter (where t.status = 'served' and t.serving_started_at is not null), 0)::bigint,
    (count(*) filter (where t.status = 'served' and t.serving_started_at is not null))::int,
    coalesce(sum(t.rating), 0)::int,
    count(t.rating)::int,
    greatest(c.open_s, 0),
    greatest(c.pause_s, 0),
    now()
  from b
  join c on true
  left join t on t.counter_id = c.id
  group by b.organization_id, b.id, c.id, c.default_practitioner_id, c.open_s, c.pause_s
  having count(t.id) > 0 or c.open_s > 0;
$$;

/** Cumule une journée pour toutes les agences (par défaut : la veille de chaque agence). Idempotent. */
create or replace function public.rollup_daily_stats(p_day date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b record;
  v_day date;
  v_count integer := 0;
begin
  for v_b in select id from public.branches loop
    v_day := coalesce(p_day, public.branch_service_day(v_b.id) - 1);
    delete from public.daily_branch_stats where branch_id = v_b.id and day = v_day;
    insert into public.daily_branch_stats select * from public.compute_branch_stats(v_b.id, v_day);
    delete from public.daily_counter_stats where branch_id = v_b.id and day = v_day;
    insert into public.daily_counter_stats select * from public.compute_counter_stats(v_b.id, v_day);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

/** Reprise de l'historique (installation, données de démo) : chaque jour de la période, jusqu'à la veille. */
create or replace function public.rollup_daily_stats_range(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_count integer := 0;
begin
  if p_from is null or p_to is null or p_to < p_from then return 0; end if;
  for v_day in select d::date from generate_series(p_from, least(p_to, current_date), interval '1 day') d loop
    perform public.rollup_daily_stats(v_day);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Chaque nuit (heure de Douala ≈ UTC+1) : la veille, et l'avant-veille pour les notes données tardivement.
select cron.schedule('nextin-rollup-daily-stats', '20 1 * * *',
  $$select public.rollup_daily_stats(current_date - 2); select public.rollup_daily_stats()$$);

-- ─── Tableau de bord ─────────────────────────────────────────────────────────

/** Le tableau de bord est réservé aux administrateurs (tout l'établissement) et aux responsables d'agence. */
create or replace function public.assert_stats_access(p_org uuid, p_branch uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_platform_admin() then return; end if;
  if public.is_anonymous() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_branch is null then
    if not public.has_org_role(p_org, array['org_admin']::public.member_role[]) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  elsif not exists (select 1 from public.branches where id = p_branch and organization_id = p_org)
     or not public.can_access_branch(p_org, p_branch, array['org_admin', 'branch_manager']::public.member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

/** Lignes de la période : cumuls des jours passés, calcul en direct pour le jour en cours (et la veille non cumulée). */
create or replace function public.stats_branch_rows(p_org uuid, p_branch uuid, p_from date, p_to date)
returns setof public.daily_branch_stats
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.daily_branch_stats r
  where r.organization_id = p_org and (p_branch is null or r.branch_id = p_branch)
    and r.day between p_from and p_to and r.day < public.branch_service_day(r.branch_id)
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
    and r.day between p_from and p_to and r.day < public.branch_service_day(r.branch_id)
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

/** Indicateurs d'une période : volumes, attente et service moyens (s), taux d'abandon (%), note moyenne. */
create or replace function public.stats_totals(p_org uuid, p_branch uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'issued', coalesce(sum(issued), 0),
    'served', coalesce(sum(served), 0),
    'no_show', coalesce(sum(no_show), 0),
    'cancelled', coalesce(sum(cancelled), 0),
    'remote', coalesce(sum(remote), 0),
    'wait_avg_seconds', case when sum(wait_count) > 0 then round(sum(wait_seconds_sum)::numeric / sum(wait_count)) end,
    'max_wait_seconds', max(max_wait_seconds),
    'service_avg_seconds', case when sum(service_count) > 0 then round(sum(service_seconds_sum)::numeric / sum(service_count)) end,
    'abandon_rate', case when sum(issued) > 0 then round(100.0 * (sum(no_show) + sum(cancelled)) / sum(issued), 1) end,
    'rating_avg', case when sum(rating_count) > 0 then round(sum(rating_sum)::numeric / sum(rating_count), 2) end,
    'rating_count', coalesce(sum(rating_count), 0)
  )
  from public.stats_branch_rows(p_org, p_branch, p_from, p_to);
$$;

/**
 * Tableau de bord d'un établissement (toutes agences) ou d'une agence : indicateurs et comparaison, affluence par
 * heure, série par jour, services, postes et praticiens, rendez-vous, files en direct.
 */
create or replace function public.dashboard_stats(
  p_org uuid, p_branch uuid, p_from date, p_to date, p_compare_from date default null, p_compare_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_stats_access(p_org, p_branch);
  if p_to < p_from or p_to - p_from > 400 then raise exception 'invalid_state' using errcode = 'P0409'; end if;

  with rows as (select * from public.stats_branch_rows(p_org, p_branch, p_from, p_to)),
  crow as (select * from public.stats_counter_rows(p_org, p_branch, p_from, p_to)),
  scope as (select id, name, timezone from public.branches where organization_id = p_org and (p_branch is null or id = p_branch))
  select jsonb_build_object(
    'totals', public.stats_totals(p_org, p_branch, p_from, p_to),
    'previous', case when p_compare_from is not null then public.stats_totals(p_org, p_branch, p_compare_from, p_compare_to) end,
    'hourly', (
      select jsonb_agg(coalesce(x.n, 0) order by g.h)
      from generate_series(0, 23) g(h)
      left join (select h, sum(r.hourly[h + 1])::int as n from rows r, generate_series(0, 23) h group by h) x on x.h = g.h
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day, 'issued', d.issued,
        'wait_avg_seconds', case when d.wait_count > 0 then round(d.wait_sum::numeric / d.wait_count) end
      ) order by d.day)
      from (
        select g.d::date as day, coalesce(sum(r.issued), 0)::int as issued, coalesce(sum(r.wait_seconds_sum), 0) as wait_sum,
               coalesce(sum(r.wait_count), 0) as wait_count
        from generate_series(p_from, p_to, interval '1 day') g(d)
        left join rows r on r.day = g.d::date
        group by g.d
      ) d
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color, 'branch', sc.name,
        'issued', x.issued, 'served', x.served,
        'wait_avg_seconds', case when x.wait_count > 0 then round(x.wait_sum::numeric / x.wait_count) end,
        'service_avg_seconds', case when x.service_count > 0 then round(x.service_sum::numeric / x.service_count) end,
        'abandon_rate', case when x.issued > 0 then round(100.0 * x.abandoned / x.issued, 1) end,
        'rating_avg', case when x.rating_count > 0 then round(x.rating_sum::numeric / x.rating_count, 2) end
      ) order by x.issued desc, s.sort_order)
      from (
        select service_id, sum(issued)::int as issued, sum(served)::int as served, sum(no_show + cancelled)::int as abandoned,
               sum(wait_seconds_sum) as wait_sum, sum(wait_count) as wait_count, sum(service_seconds_sum) as service_sum,
               sum(service_count) as service_count, sum(rating_sum) as rating_sum, sum(rating_count) as rating_count
        from rows group by service_id
      ) x
      join public.services s on s.id = x.service_id
      join scope sc on sc.id = s.branch_id
    ), '[]'::jsonb),
    'counters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'number', c.number, 'label', c.label, 'branch', sc.name, 'status', c.status,
        'practitioner', case when p.id is not null then public.practitioner_label(p.id) end,
        'called', x.called, 'served', x.served, 'no_show', x.no_show,
        'service_avg_seconds', case when x.service_count > 0 then round(x.service_sum::numeric / x.service_count) end,
        'rating_avg', case when x.rating_count > 0 then round(x.rating_sum::numeric / x.rating_count, 2) end,
        'open_seconds', x.open_seconds, 'pause_seconds', x.pause_seconds
      ) order by sc.name, c.kind, c.number)
      from (
        select counter_id, sum(called)::int as called, sum(served)::int as served, sum(no_show)::int as no_show,
               sum(service_seconds_sum) as service_sum, sum(service_count) as service_count, sum(rating_sum) as rating_sum,
               sum(rating_count) as rating_count, sum(open_seconds)::int as open_seconds, sum(pause_seconds)::int as pause_seconds
        from crow group by counter_id
      ) x
      join public.counters c on c.id = x.counter_id
      join scope sc on sc.id = c.branch_id
      left join public.practitioners p on p.id = c.default_practitioner_id
    ), '[]'::jsonb),
    'appointments', (
      select jsonb_build_object(
        'booked', count(*) filter (where a.status <> 'rescheduled'),
        'completed', count(*) filter (where a.status = 'completed'),
        'checked_in', count(*) filter (where a.status = 'checked_in'),
        'no_show', count(*) filter (where a.status = 'no_show'),
        'cancelled', count(*) filter (where a.status = 'cancelled'),
        'upcoming', count(*) filter (where a.status = 'confirmed')
      )
      from public.appointments a join scope sc on sc.id = a.branch_id
      where (a.starts_at at time zone sc.timezone)::date between p_from and p_to
    ),
    'practitioners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', public.practitioner_label(p.id), 'branch', sc.name,
        'appointments', (select count(*) from public.appointments a
          where a.practitioner_id = p.id and a.status <> 'rescheduled' and (a.starts_at at time zone sc.timezone)::date between p_from and p_to),
        'appointment_no_show', (select count(*) from public.appointments a
          where a.practitioner_id = p.id and a.status = 'no_show' and (a.starts_at at time zone sc.timezone)::date between p_from and p_to),
        'absences', (select count(*) from public.practitioner_absences ab
          where ab.practitioner_id = p.id and ab.kind = 'absent' and (ab.starts_at at time zone sc.timezone)::date between p_from and p_to),
        'late', (select count(*) from public.practitioner_absences ab
          where ab.practitioner_id = p.id and ab.kind = 'late' and (ab.starts_at at time zone sc.timezone)::date between p_from and p_to),
        'served', coalesce((select sum(r.served) from crow r where r.practitioner_id = p.id), 0),
        'service_avg_seconds', (select case when sum(r.service_count) > 0 then round(sum(r.service_seconds_sum)::numeric / sum(r.service_count)) end
          from crow r where r.practitioner_id = p.id),
        'rating_avg', (select case when sum(r.rating_count) > 0 then round(sum(r.rating_sum)::numeric / sum(r.rating_count), 2) end
          from crow r where r.practitioner_id = p.id)
      ) order by sc.name, p.display_name)
      from public.practitioners p join scope sc on sc.id = p.branch_id
      where p.active
    ), '[]'::jsonb),
    'live', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branch', sc.name, 'id', s ->> 'id', 'name', s ->> 'name', 'name_en', s ->> 'name_en', 'color', s ->> 'color',
        'prefix', s ->> 'prefix', 'open', (s ->> 'open')::boolean,
        'waiting', jsonb_array_length(s -> 'waiting'), 'wait_seconds', (s ->> 'wait_seconds')::int
      ) order by sc.name, ord)
      from scope sc
      cross join lateral jsonb_array_elements(public.branch_board(sc.id) -> 'services') with ordinality as e(s, ord)
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

/** Données de l'export CSV : par jour et service (`services`) ou par jour et poste (`counters`). */
create or replace function public.stats_export(p_org uuid, p_branch uuid, p_from date, p_to date, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_stats_access(p_org, p_branch);
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

-- ─── Droits et RLS ───────────────────────────────────────────────────────────

revoke execute on function
  public.compute_branch_stats(uuid, date), public.compute_counter_stats(uuid, date), public.rollup_daily_stats(date),
  public.rollup_daily_stats_range(date, date), public.assert_stats_access(uuid, uuid),
  public.stats_branch_rows(uuid, uuid, date, date), public.stats_counter_rows(uuid, uuid, date, date),
  public.stats_totals(uuid, uuid, date, date), public.dashboard_stats(uuid, uuid, date, date, date, date),
  public.stats_export(uuid, uuid, date, date, text)
from public, anon, authenticated;
grant execute on function public.dashboard_stats(uuid, uuid, date, date, date, date), public.stats_export(uuid, uuid, date, date, text)
  to authenticated;
grant execute on function public.rollup_daily_stats_range(date, date) to service_role;

alter table public.daily_branch_stats enable row level security;
alter table public.daily_counter_stats enable row level security;
revoke all on public.daily_branch_stats, public.daily_counter_stats from anon;
revoke insert, update, delete, truncate on public.daily_branch_stats, public.daily_counter_stats from authenticated;
create policy daily_branch_stats_select on public.daily_branch_stats for select to authenticated
  using ((not public.is_anonymous() and public.can_access_branch(organization_id, branch_id, array['org_admin', 'branch_manager']::public.member_role[]))
         or public.is_platform_admin());
create policy daily_counter_stats_select on public.daily_counter_stats for select to authenticated
  using ((not public.is_anonymous() and public.can_access_branch(organization_id, branch_id, array['org_admin', 'branch_manager']::public.member_role[]))
         or public.is_platform_admin());

-- Reprise de l'historique existant (tickets d'avant le M8).
select public.rollup_daily_stats_range((select min(service_day) from public.tickets), current_date - 1);
