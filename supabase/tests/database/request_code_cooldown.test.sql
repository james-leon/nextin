-- pgTAP — LOT 5a (B10) : « Renvoyer le code » d'une demande de rendez-vous au plus une fois par minute, vérifié par la
-- base (`issue_request_code`, migration 20261201090000) ; la limite de trois codes reste en place.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(7);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.as_role(p_role text, p_sub uuid default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_sub, 'is_anonymous', false)::text, true);
  perform set_config('role', p_role, true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tests to anon, authenticated, service_role;
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to anon, authenticated, service_role;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.slot(p_days int, p_time time) returns timestamptz language sql as $$
  select ((((now() at time zone 'Africa/Douala')::date + p_days) + p_time) at time zone 'Africa/Douala')
$$;
-- Recule l'heure du dernier envoi (le code expire 10 minutes après son envoi).
create function tests.age_code(p_seconds int) returns void language sql security definer as $$
  update public.appointment_requests set code_expires_at = code_expires_at - make_interval(secs => p_seconds)
  where id = tests.id('request')
$$;
create function tests.sent() returns int language sql security definer as $$
  select codes_sent from public.appointment_requests where id = tests.id('request')
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at) values
  ('ea000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@cooldown.test', false, now()),
  ('ea000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now());
insert into ids values ('admin', 'ea000000-0000-0000-0000-00000000000a'), ('c1', 'ea000000-0000-0000-0000-0000000000c1');
select tests.as_role('authenticated', tests.id('admin'));
insert into ids select 'org', public.create_organization('Clinique Délai', 'pgtap-cooldown', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Akwa');
select tests.logout();
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('org'), tests.id('branch'), 'Consultation', 'C', 600);
insert into ids select 'service', id from public.services where branch_id = tests.id('branch');
insert into public.practitioners (organization_id, branch_id, title, display_name) values (tests.id('org'), tests.id('branch'), 'Dr', 'Ewane');
insert into ids select 'doctor', id from public.practitioners where branch_id = tests.id('branch');
insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
select tests.id('org'), tests.id('branch'), tests.id('doctor'), tests.id('service'), d, '08:00', '18:00', 30 from generate_series(1, 7) d;
update public.branch_settings set appointment_requests_enabled = true, appointment_request_max_pending = 5 where branch_id = tests.id('branch');
delete from public.rate_limits;

-- Demande par e-mail : premier code envoyé à la création.
select tests.as_role('service_role');
create temp table created on commit drop as
select public.create_appointment_request(tests.id('branch'), tests.id('service'), null, tests.slot(2, '09:00'), null, null,
  null, null, 'fr', tests.id('c1'), null, null, 'delai@exemple.cm', null) ->> 'public_token' as token;
select tests.logout();
insert into ids select 'request', r.id from public.appointment_requests r join created c on c.token = r.public_token;
select is(tests.sent(), 1, 'premier code envoyé à la création');

-- Renvoi immédiat : refusé par la base, même erreur que la limite de codes.
select throws_ok($$ select public.issue_request_code(tests.id('request')) $$, 'P0429', 'rate_limited',
  'renvoi moins de 60 s après le code précédent : refusé');
select tests.age_code(45);
select throws_ok($$ select public.issue_request_code(tests.id('request')) $$, 'P0429', 'rate_limited',
  '45 s plus tard : toujours refusé');
select is(tests.sent(), 1, 'aucun code envoyé pendant le délai');

-- Après 60 s : nouveau code.
select tests.age_code(16);
select lives_ok($$ select public.issue_request_code(tests.id('request')) $$, 'plus de 60 s après : nouveau code');
select is(tests.sent(), 2, 'deuxième code envoyé');

-- La limite de trois codes reste en place.
select tests.age_code(61);
select public.issue_request_code(tests.id('request'));
select tests.age_code(61);
select throws_ok($$ select public.issue_request_code(tests.id('request')) $$, 'P0429', 'rate_limited',
  'quatrième code : toujours refusé (trois au plus)');

select * from finish();
rollback;
