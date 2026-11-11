-- pgTAP — « Mon ticket » : état d'ouverture dans `get_ticket` / `ticket_view` (agence ouverte, horaires, poste
-- ouvert pour le service, type de poste), pour ne jamais annoncer « D'un instant à l'autre » quand personne ne
-- peut appeler. Aucune donnée personnelle ajoutée.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(9);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v text) on commit drop;
grant all on ids, vals to anon, authenticated;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.view() returns jsonb language sql as $$
  select public.get_ticket((select v from vals where name = 'token'))
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email, created_at)
values ('0b000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@opening.test', now());
select set_config('request.jwt.claims', json_build_object('sub', '0b000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into ids select 'org', public.create_organization('Clinique Ouverture', 'pgtap-opening', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('org'), tests.id('branch'), 'Consultation', 'C', 600);
insert into ids select 'svc', id from public.services where branch_id = tests.id('branch');
insert into public.counters (organization_id, branch_id, kind, number) values (tests.id('org'), tests.id('branch'), 'cabinet', 1);
insert into ids select 'cab', id from public.counters where branch_id = tests.id('branch');
insert into public.counter_services (organization_id, counter_id, service_id) values (tests.id('org'), tests.id('cab'), tests.id('svc'));
select set_config('role', 'postgres', true);
delete from public.opening_hours where branch_id = tests.id('branch');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.id('org'), tests.id('branch'), d, '00:00', '23:59:59' from generate_series(1, 7) d;
select set_config('role', 'authenticated', true);
select public.open_counter(tests.id('cab'));
insert into ids select 'ticket', (public.reception_create_ticket(tests.id('svc')) ->> 'id')::uuid;
select set_config('role', 'postgres', true);
insert into vals select 'token', public_token from public.tickets where id = tests.id('ticket');

-- Visiteur sans compte.
select set_config('role', 'anon', true);
select is(tests.view() -> 'branch' ->> 'is_open', 'true', 'agence ouverte');
select is(jsonb_array_length(tests.view() -> 'branch' -> 'hours'), 7, 'horaires publics transmis');
select is(tests.view() -> 'branch' ->> 'timezone', 'Africa/Douala', 'fuseau de l''agence');
select is(tests.view() -> 'service' ->> 'open', 'true', 'un cabinet ouvert sert le service');
select is(tests.view() -> 'service' ->> 'counter_kind', 'cabinet', 'type de poste du service');

-- Cabinet fermé : le service n'a plus de poste ouvert.
select set_config('role', 'authenticated', true);
select public.close_counter(tests.id('cab'));
select set_config('role', 'anon', true);
select is(tests.view() -> 'service' ->> 'open', 'false', 'aucun poste ouvert : service fermé');
select is(tests.view() ->> 'status', 'waiting', 'le ticket reste en attente');

-- Fermeture exceptionnelle aujourd'hui : agence fermée.
select set_config('role', 'postgres', true);
insert into public.branch_closures (organization_id, branch_id, date)
values (tests.id('org'), tests.id('branch'), (now() at time zone 'Africa/Douala')::date);
select set_config('role', 'anon', true);
select is(tests.view() -> 'branch' ->> 'is_open', 'false', 'fermeture exceptionnelle : agence fermée');

-- Jamais de donnée personnelle (nom, téléphone, e-mail) dans ce que reçoit le visiteur.
select ok(not (tests.view()::text ~* '(customer|phone|email|e164)'), 'aucune donnée personnelle dans la vue du ticket');

select set_config('role', 'postgres', true);
select * from finish();
rollback;
