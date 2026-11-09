-- pgTAP — M8 : cumuls journaliers (exactitude, idempotence), journée en cours et veille en direct, tableau de bord,
-- export, droits (administrateur, responsable d'agence, agent, autre établissement), RLS.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
-- M10a : `create_organization` réservé à l'inscription ; appel direct permis dans ce test (annulé au rollback).
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(28);

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, false, now())
  returning id;
$$;
create function tests.login_as(p_id uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to authenticated;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
grant execute on function tests.id(text), tests.v(text) to authenticated;

select tests.create_user('a8000000-0000-0000-0000-00000000000a', 'admin@m8-clinic.test');
select tests.create_user('b8000000-0000-0000-0000-00000000000b', 'admin@m8-eneo.test');
select tests.create_user('c8000000-0000-0000-0000-00000000000c', 'manager@m8-clinic.test');
select tests.create_user('d8000000-0000-0000-0000-00000000000d', 'agent@m8-clinic.test');
select tests.login_as('a8000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M8 Clinic', 'pgtap-m8-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch(tests.id('clinic'), 'Akwa');
insert into ids select 'bonapriso', public.create_branch(tests.id('clinic'), 'Bonapriso');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('clinic'), tests.id('akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where branch_id = tests.id('akwa');
insert into public.counters (organization_id, branch_id, kind, number) values (tests.id('clinic'), tests.id('akwa'), 'cabinet', 1);
insert into ids select 'cab1', id from public.counters where branch_id = tests.id('akwa');
insert into public.counter_services (organization_id, counter_id, service_id) values (tests.id('clinic'), tests.id('cab1'), tests.id('consult'));
select tests.login_as('b8000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M8 Eneo', 'pgtap-m8-eneo', 'utility');
select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id) values
  (tests.id('clinic'), 'c8000000-0000-0000-0000-00000000000c', 'branch_manager', tests.id('akwa')),
  (tests.id('clinic'), 'd8000000-0000-0000-0000-00000000000d', 'agent', tests.id('akwa'));

-- ─── Jours de référence (heure de Douala) ────────────────────────────────────
insert into vals select 'today', to_jsonb(public.branch_service_day(tests.id('akwa')));
create function tests.day(p_back int) returns date language sql as $$ select (tests.v('today') #>> '{}')::date - p_back $$;
create function tests.at(p_back int, p_time time) returns timestamptz language sql as $$
  select (tests.day(p_back) + p_time) at time zone 'Africa/Douala'
$$;
grant execute on function tests.day(int), tests.at(int, time) to authenticated;

-- Trois jours avant : servi (attente 10 min, service 5 min, note 4), absent à l'appel (attente 20 min), annulé.
insert into public.tickets (organization_id, branch_id, service_id, service_day, number, display_code, source, status, sort_key,
  counter_id, created_at, called_at, serving_started_at, finished_at, rating)
values
  (tests.id('clinic'), tests.id('akwa'), tests.id('consult'), tests.day(3), 1, 'C-001', 'qr', 'served', 1, tests.id('cab1'),
   tests.at(3, '09:00'), tests.at(3, '09:10'), tests.at(3, '09:11'), tests.at(3, '09:16'), 4),
  (tests.id('clinic'), tests.id('akwa'), tests.id('consult'), tests.day(3), 2, 'C-002', 'reception', 'no_show', 2, tests.id('cab1'),
   tests.at(3, '09:30'), tests.at(3, '09:50'), null, tests.at(3, '09:53'), null),
  (tests.id('clinic'), tests.id('akwa'), tests.id('consult'), tests.day(3), 3, 'C-003', 'qr', 'cancelled', 3, null,
   tests.at(3, '10:15'), null, null, tests.at(3, '10:20'), null);
insert into public.counter_sessions (organization_id, branch_id, counter_id, started_at, ended_at)
values (tests.id('clinic'), tests.id('akwa'), tests.id('cab1'), tests.at(3, '08:00'), tests.at(3, '12:00'));

-- ─── Cumul nocturne ──────────────────────────────────────────────────────────
select public.rollup_daily_stats(tests.day(3));
select public.rollup_daily_stats(tests.day(3));
select is((select count(*)::int from public.daily_branch_stats where branch_id = tests.id('akwa') and day = tests.day(3)), 1,
  'cumul idempotent : une ligne par service et par jour');
select is((select (issued, served, no_show, cancelled)::text from public.daily_branch_stats where service_id = tests.id('consult') and day = tests.day(3)),
  '(3,1,1,1)', 'volumes : émis, servis, absents, annulés');
select is((select (wait_seconds_sum / wait_count, max_wait_seconds, service_seconds_sum / service_count, rating_sum, rating_count)::text
  from public.daily_branch_stats where service_id = tests.id('consult') and day = tests.day(3)),
  '(900,1200,300,4,1)', 'attente jusqu''à l''alerte, service depuis l''admission, notes');
select is((select (hourly[10], hourly[11], hourly[12])::text from public.daily_branch_stats where service_id = tests.id('consult') and day = tests.day(3)),
  '(2,1,0)', 'affluence par heure locale (9 h : 2, 10 h : 1)');
select is((select (called, served, no_show, open_seconds)::text from public.daily_counter_stats where counter_id = tests.id('cab1') and day = tests.day(3)),
  '(2,1,1,14400)', 'poste : appels, servis, absents, 4 h d''ouverture');

-- Veille, pas encore cumulée : calculée en direct, sans double compte après le cumul.
insert into public.tickets (organization_id, branch_id, service_id, service_day, number, display_code, source, status, sort_key, created_at)
values (tests.id('clinic'), tests.id('akwa'), tests.id('consult'), tests.day(1), 1, 'C-001', 'qr', 'cancelled', 10, tests.at(1, '11:00'));

-- ─── Tableau de bord ─────────────────────────────────────────────────────────
select tests.login_as('a8000000-0000-0000-0000-00000000000a');
select public.reception_create_ticket(tests.id('consult'));
insert into vals select 'week', public.dashboard_stats(tests.id('clinic'), null, tests.day(6), tests.day(0), tests.day(13), tests.day(7));
select is((select v -> 'totals' ->> 'issued' from vals where name = 'week'), '5', 'période : jours cumulés + veille + journée en cours');
select is((select (v -> 'totals' ->> 'wait_avg_seconds', v -> 'totals' ->> 'service_avg_seconds', v -> 'totals' ->> 'abandon_rate')::text from vals where name = 'week'),
  '(900,300,60.0)', 'indicateurs : attente et service moyens, taux d''abandon (absents + annulés)');
select is((select v -> 'totals' ->> 'rating_avg' from vals where name = 'week'), '4.00', 'note moyenne');
select is((select jsonb_array_length(v -> 'hourly') from vals where name = 'week'), 24, 'affluence : 24 heures');
select is((select jsonb_array_length(v -> 'daily') from vals where name = 'week'), 7, 'série : un point par jour, jours sans activité compris');
select is((select v -> 'previous' ->> 'issued' from vals where name = 'week'), '0', 'comparaison : période précédente');
select is((select v -> 'services' -> 0 ->> 'issued' from vals where name = 'week'), '5', 'par service');
select is((select v -> 'counters' -> 0 ->> 'served' from vals where name = 'week'), '1', 'par poste');
select ok((select jsonb_array_length(v -> 'live') >= 1 from vals where name = 'week'), 'files en direct');
select ok((select not (v::text ~* '(customer|phone|public_token)') from vals where name = 'week'), 'aucune donnée personnelle');
select tests.logout();
select public.rollup_daily_stats(tests.day(1));
select tests.login_as('a8000000-0000-0000-0000-00000000000a');
select is(public.dashboard_stats(tests.id('clinic'), null, tests.day(6), tests.day(0)) -> 'totals' ->> 'issued', '5',
  'veille cumulée : pas de double compte');
select throws_ok($$ select public.dashboard_stats(tests.id('clinic'), null, tests.day(0), tests.day(1)) $$, 'P0409', 'invalid_state',
  'période invalide refusée');

select is(jsonb_array_length(public.stats_export(tests.id('clinic'), tests.id('akwa'), tests.day(6), tests.day(0), 'services')), 3,
  'export par jour et service');
select is(public.stats_export(tests.id('clinic'), tests.id('akwa'), tests.day(6), tests.day(0), 'counters') -> 0 ->> 'kind', 'cabinet',
  'export par jour et poste');

-- ─── Droits ──────────────────────────────────────────────────────────────────
select tests.login_as('c8000000-0000-0000-0000-00000000000c');
select is(public.dashboard_stats(tests.id('clinic'), tests.id('akwa'), tests.day(6), tests.day(0)) -> 'totals' ->> 'issued', '5',
  'responsable d''agence : son agence');
select throws_ok($$ select public.dashboard_stats(tests.id('clinic'), null, tests.day(6), tests.day(0)) $$, '42501', null,
  'responsable d''agence : pas la vue de tout l''établissement');
select throws_ok($$ select public.dashboard_stats(tests.id('clinic'), tests.id('bonapriso'), tests.day(6), tests.day(0)) $$, '42501', null,
  'responsable d''agence : pas une autre agence');
select is((select count(*)::int from public.daily_branch_stats), 2, 'lecture directe : son agence seulement');
select tests.login_as('d8000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.dashboard_stats(tests.id('clinic'), tests.id('akwa'), tests.day(6), tests.day(0)) $$, '42501', null,
  'agent : pas de tableau de bord');
select is((select count(*)::int from public.daily_branch_stats), 0, 'agent : statistiques illisibles');
select tests.login_as('b8000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.dashboard_stats(tests.id('clinic'), null, tests.day(6), tests.day(0)) $$, '42501', null,
  'isolation : autre établissement');
select throws_ok($$ select public.stats_export(tests.id('clinic'), null, tests.day(6), tests.day(0), 'services') $$, '42501', null,
  'isolation : export');
select tests.logout();
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.daily_branch_stats'::regclass, 'public.daily_counter_stats'::regclass)),
  'RLS activée');

select * from finish();
rollback;
