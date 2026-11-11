-- pgTAP — C2 : page Aide du patient. Coordonnées publiques de l'établissement du ticket, lisibles avec le lien du
-- ticket (visiteur anonyme), jamais une donnée du patient ; jeton inconnu : rien.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(5);
alter table public.branch_settings alter column customer_name_mode set default 'optional';

create schema tests;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create temp table vals (name text primary key, v text) on commit drop;
grant all on vals to authenticated, anon;
create function tests.v(p_name text) returns text language sql as $$ select v from vals where name = p_name $$;
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('9c000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@aide.test', now());
select tests.login_as('9c000000-0000-0000-0000-0000000000a1');
insert into vals select 'org', public.create_organization('Clinique Aide', 'pgtap-aide', 'clinic')::text;
insert into vals select 'branch', public.create_branch(tests.v('org')::uuid, 'Akwa', '12 rue Joss', 'Douala', '+237233421100')::text;
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.v('org')::uuid, tests.v('branch')::uuid, 'Consultation', 'C', 600);
select tests.logout();
delete from public.opening_hours where branch_id = tests.v('branch')::uuid;
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.v('org')::uuid, tests.v('branch')::uuid, d, '00:00', '23:59:59' from generate_series(1, 7) d;
select tests.login_as('9c000000-0000-0000-0000-0000000000a1');
insert into vals select 'token', public.reception_create_ticket((select id from public.services where branch_id = tests.v('branch')::uuid),
  null, null, null, '+237690001111', true, 'fr', 'Awa Ngono') ->> 'public_token';
select tests.logout();
insert into vals select 'token', public_token from public.tickets where branch_id = tests.v('branch')::uuid
  on conflict (name) do update set v = excluded.v;

set local role anon;
select is((select public.ticket_help(tests.v('token')) ->> 'phone_e164'), '+237233421100', 'visiteur avec le lien : téléphone de l''agence');
select is((select public.ticket_help(tests.v('token')) ->> 'organization'), 'Clinique Aide', 'nom de l''établissement');
select is((select array_agg(k order by k) from jsonb_object_keys(public.ticket_help(tests.v('token'))) k),
  array['address', 'branch', 'city', 'hours', 'is_open', 'organization', 'phone_e164', 'timezone'],
  'coordonnées publiques seulement : ni nom ni numéro du patient');
select is(jsonb_array_length(public.ticket_help(tests.v('token')) -> 'hours'), 7, 'horaires de l''agence');
select is(public.ticket_help('JetonInconnu00000000xx'), null, 'jeton inconnu : rien');
reset role;

select * from finish();
rollback;
