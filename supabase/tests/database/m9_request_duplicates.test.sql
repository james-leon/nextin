-- pgTAP — M9 (correctif) : demandes de rendez-vous en double (même créneau) et limite de demandes en attente par numéro.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
-- M10a : `create_organization` réservé à l'inscription ; appel direct permis dans ce test (annulé au rollback).
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(12);

create schema tests;
create function tests.as_role(p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role)::text, true);
  perform set_config('role', p_role, true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tests to anon, authenticated, service_role;
create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to anon, authenticated, service_role;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.token(p_name text) returns text language sql as $$ select v ->> 'public_token' from vals where name = p_name $$;
create function tests.code(p_name text) returns text language sql security definer as $$
  select j.payload ->> 'code' from public.notification_jobs j join public.appointment_requests r on r.id = j.appointment_request_id
  where r.public_token = tests.token(p_name) and j.event = 'request_code' and j.status <> 'cancelled' order by j.created_at desc limit 1
$$;
create function tests.status(p_name text) returns text language sql security definer as $$
  select status::text from public.appointment_requests where public_token = tests.token(p_name)
$$;
create function tests.slot(p_days int, p_time time) returns timestamptz language sql as $$
  select ((((now() at time zone 'Africa/Douala')::date + p_days) + p_time) at time zone 'Africa/Douala')
$$;
-- Demande créée (serveur) puis vérifiée par le patient avec le code reçu.
-- La limitation par numéro (5 envois par jour) n'est pas l'objet de ce test : remise à zéro avant chaque envoi.
create function tests.reset_limits() returns void language sql security definer as $$ delete from public.rate_limits $$;
create function tests.request(p_name text, p_phone text, p_starts_at timestamptz, p_day date default null, p_period text default null)
returns void language plpgsql as $$
begin
  perform tests.reset_limits();
  perform tests.as_role('service_role');
  insert into vals select p_name, public.create_appointment_request(tests.id('branch'), tests.id('service'), null, p_starts_at,
    p_day, p_period, p_phone, null, 'fr', tests.id('customer'));
  perform tests.as_role('anon');
  perform public.verify_appointment_request(tests.token(p_name), tests.code(p_name));
  perform tests.logout();
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at) values
  ('e9000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@m9-dup.test', false, now()),
  ('e9000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now());
insert into ids values ('customer', 'e9000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claims', json_build_object('sub', 'e9000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into ids select 'org', public.create_organization('M9 Doublons', 'pgtap-m9-dup', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Akwa');
select tests.logout();
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('org'), tests.id('branch'), 'Consultation', 'C', 600);
insert into ids select 'service', id from public.services where branch_id = tests.id('branch');
insert into public.practitioners (organization_id, branch_id, title, display_name) values (tests.id('org'), tests.id('branch'), 'Dr', 'Ewane');
insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
select tests.id('org'), tests.id('branch'), p.id, tests.id('service'), d, '08:00', '18:00', 30
from public.practitioners p, generate_series(1, 7) d where p.branch_id = tests.id('branch');
update public.branch_settings set appointment_requests_enabled = true where branch_id = tests.id('branch');

select is((select appointment_request_max_pending from public.branch_settings where branch_id = tests.id('branch')), 2::smallint,
  'limite par défaut : 2 demandes en attente par numéro');

select tests.request('A', '+237677001001', tests.slot(1, '09:00'));
select is(tests.status('A'), 'pending', 'première demande : en attente');

-- Même numéro, même créneau : refusé dès l'envoi.
select tests.reset_limits();
select tests.as_role('service_role');
select throws_ok(format($$ select public.create_appointment_request(%L, %L, null, %L, null, null, '+237677001001', null, 'fr', %L) $$,
  tests.id('branch'), tests.id('service'), tests.slot(1, '09:00'), tests.id('customer')), 'P0409', 'request_duplicate',
  'même numéro, même créneau, déjà en attente : refusé');
select tests.logout();

-- Deux demandes non vérifiées pour le même créneau : la seconde remplace la première.
select tests.reset_limits();
select tests.as_role('service_role');
insert into vals select 'B1', public.create_appointment_request(tests.id('branch'), tests.id('service'), null, tests.slot(2, '10:00'),
  null, null, '+237677001001', null, 'fr', tests.id('customer'));
insert into vals select 'B2', public.create_appointment_request(tests.id('branch'), tests.id('service'), null, tests.slot(2, '10:00'),
  null, null, '+237677001001', null, 'fr', tests.id('customer'));
select tests.logout();
select is(tests.status('B1'), 'cancelled', 'nouvel envoi du même créneau avant vérification : l''ancienne demande est remplacée');
select tests.as_role('anon');
select is(public.verify_appointment_request(tests.token('B2'), tests.code('B2')) ->> 'status', 'pending', 'autre créneau : accepté (2 sur 2)');
select tests.logout();

-- Limite atteinte : troisième créneau refusé, à l'envoi comme à la vérification.
select tests.reset_limits();
select tests.as_role('service_role');
select throws_ok(format($$ select public.create_appointment_request(%L, %L, null, null, %L, 'morning', '+237677001001', null, 'fr', %L) $$,
  tests.id('branch'), tests.id('service'), ((now() at time zone 'Africa/Douala')::date + 3), tests.id('customer')), 'P0409', 'request_limit',
  'limite de demandes en attente atteinte : refusé à l''envoi');
select tests.logout();
update public.branch_settings set appointment_request_max_pending = 3 where branch_id = tests.id('branch');
select tests.reset_limits();
select tests.as_role('service_role');
insert into vals select 'C', public.create_appointment_request(tests.id('branch'), tests.id('service'), null, null,
  ((now() at time zone 'Africa/Douala')::date + 3), 'morning', '+237677001001', null, 'fr', tests.id('customer'));
select tests.logout();
update public.branch_settings set appointment_request_max_pending = 2 where branch_id = tests.id('branch');
select tests.as_role('anon');
select throws_ok(format('select public.verify_appointment_request(%L, %L)', tests.token('C'), tests.code('C')), 'P0409', 'request_limit',
  'limite abaissée entre-temps : refusé à la vérification');
select tests.logout();
select is(tests.status('C'), 'unverified', 'demande refusée : reste non vérifiée, invisible de l''accueil');

-- Même créneau « jour + moment » : la clé de créneau tient compte du moment de la journée.
update public.branch_settings set appointment_request_max_pending = 5 where branch_id = tests.id('branch');
select tests.request('D', '+237677001001', null, ((now() at time zone 'Africa/Douala')::date + 4), 'morning');
select tests.request('E', '+237677001001', null, ((now() at time zone 'Africa/Douala')::date + 4), 'afternoon');
select is(tests.status('E'), 'pending', 'même jour, autre moment : accepté');
select tests.reset_limits();
select tests.as_role('service_role');
select throws_ok(format($$ select public.create_appointment_request(%L, %L, null, null, %L, 'afternoon', '+237677001001', null, 'fr', %L) $$,
  tests.id('branch'), tests.id('service'), ((now() at time zone 'Africa/Douala')::date + 4), tests.id('customer')), 'P0409', 'request_duplicate',
  'même jour, même moment : refusé');
select tests.logout();

-- Autre numéro, même créneau : accepté. Garantie de la base : index unique sur numéro + créneau en attente.
select tests.request('F', '+237677001002', tests.slot(1, '09:00'));
select is(tests.status('F'), 'pending', 'autre numéro, même créneau : accepté (l''accueil départage)');
select throws_ok(format($$ update public.appointment_requests set status = 'pending' where public_token = %L $$, tests.token('B1')),
  '23505', null, 'index unique : jamais deux demandes en attente pour le même numéro et le même créneau');

select * from finish();
rollback;
