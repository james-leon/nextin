-- pgTAP — Pages client : prise de ticket et demande de rendez-vous en ligne indisponibles connues dès l'ouverture
-- (`online_open`, `requests_open`), sans jamais la raison (abonnement, paiement, quota). Lecture seule, suspension,
-- quota de tickets du mois bloquant.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(14);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v text) on commit drop;
grant all on ids, vals to anon, authenticated;
create schema tests;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.code() returns text language sql as $$ select v from vals where name = 'code' $$;
create function tests.entry() returns jsonb language sql as $$ select public.resolve_entry(tests.code()) $$;
create function tests.branch() returns jsonb language sql as $$ select public.branch_public(tests.id('branch')) $$;
create function tests.request() returns jsonb language sql as $$ select public.request_options(tests.id('branch')) $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email, created_at)
values ('0a000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@online.test', now());
select set_config('request.jwt.claims', json_build_object('sub', '0a000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into ids select 'org', public.create_organization('Clinique En Ligne', 'pgtap-online', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Akwa');
select set_config('role', 'postgres', true);
insert into public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
select tests.id('org'), id, 'active', now() - interval '1 day', now() + interval '29 days' from public.plans where code = 'business';
update public.branch_settings set remote_tickets_enabled = true, appointment_requests_enabled = true where branch_id = tests.id('branch');
insert into vals select 'code', short_code from public.qr_codes where branch_id = tests.id('branch') and active limit 1;

-- Visiteur sans compte.
select set_config('role', 'anon', true);
select is(tests.entry() ->> 'online_open', 'true', 'abonnement actif : prise de ticket en ligne ouverte');
select is(tests.branch() ->> 'online_open', 'true', 'abonnement actif : ticket à distance ouvert');
select is(tests.branch() ->> 'requests_open', 'true', 'abonnement actif : demandes de rendez-vous ouvertes');
select is(tests.request() ->> 'online_open', 'true', 'formulaire de demande : ouvert');

-- Quota de tickets du mois épuisé depuis la veille : plus de ticket en ligne, les demandes restent possibles.
select set_config('role', 'postgres', true);
update public.subscriptions set limit_overrides = '{"tickets_per_month": 1}' where organization_id = tests.id('org');
insert into public.messaging_usage (organization_id, month, tickets_created, tickets_reached_on)
values (tests.id('org'), date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date, 5,
        (now() at time zone 'Africa/Douala')::date - 1)
on conflict (organization_id, month) do update set tickets_created = 5, tickets_reached_on = excluded.tickets_reached_on;
select set_config('role', 'anon', true);
select is(tests.entry() ->> 'online_open', 'false', 'quota bloquant : prise de ticket fermée dès l''ouverture de la page');
select is(tests.branch() ->> 'online_open', 'false', 'quota bloquant : ticket à distance fermé');
select is(tests.branch() ->> 'requests_open', 'true', 'quota de tickets : les demandes de rendez-vous restent ouvertes');

-- Lecture seule, puis suspension : tout est fermé.
select set_config('role', 'postgres', true);
update public.subscriptions set limit_overrides = '{}', status = 'read_only', read_only_since = now() where organization_id = tests.id('org');
delete from public.messaging_usage where organization_id = tests.id('org');
select set_config('role', 'anon', true);
select is(tests.entry() ->> 'online_open', 'false', 'lecture seule : prise de ticket fermée');
select is(tests.branch() ->> 'requests_open', 'false', 'lecture seule : demandes fermées');
select is(tests.request() ->> 'online_open', 'false', 'lecture seule : formulaire de demande fermé');
select set_config('role', 'postgres', true);
update public.subscriptions set status = 'suspended', suspended_since = now() where organization_id = tests.id('org');
select set_config('role', 'anon', true);
select is(tests.entry() ->> 'online_open', 'false', 'suspendu : prise de ticket fermée');
select ok(tests.entry() -> 'board' is not null and jsonb_array_length(tests.entry() -> 'board' -> 'services') >= 0,
  'suspendu : la page s''ouvre quand même (services affichés)');

-- Jamais la raison : ni abonnement, ni paiement, ni quota dans ce que reçoit le visiteur.
select ok(not (tests.entry()::text ~* '(subscription|read_only|suspended|quota|invoice|payment|plan_)'),
  'page /q : aucune information sur l''abonnement, le paiement ou le quota');
select ok(not ((tests.branch()::text || tests.request()::text) ~* '(subscription|read_only|suspended|quota|invoice|payment|plan_)'),
  'pages /b et /rdv : aucune information sur l''abonnement, le paiement ou le quota');

select set_config('role', 'postgres', true);
select * from finish();
rollback;
