-- pgTAP — Resynchronisation de 20261118090000 (migration 20261129090000) : état final attendu sur toute base,
-- y compris la base distante qui avait reçu la version provisoire (`org_is_public`, `online_intake_open`,
-- clé `online_available`). Fonctions présentes, droits, clés renvoyées aux pages client, et valeurs pour un
-- établissement actif, au quota de tickets bloqué, en lecture seule, suspendu pour impayé (visible, fermé) et
-- suspendu par la modération (introuvable).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(40);
alter table public.branch_settings alter column customer_name_mode set default 'off';

-- ─── Structure ───────────────────────────────────────────────────────────────
select has_function('public', 'online_tickets_open', array['uuid', 'boolean'], 'online_tickets_open présente');
select has_function('public', 'online_requests_open', array['uuid'], 'online_requests_open présente');
select has_function('public', 'org_is_public', array['org_status', 'text'], 'org_is_public(statut, motif) présente');
select is((select count(*)::integer from pg_proc where proname = 'org_is_public'), 1, 'une seule org_is_public (variante provisoire retirée)');
select ok(public.org_is_public('active', null), 'actif : visible');
select ok(public.org_is_public('suspended', 'subscription'), 'suspendu pour impayé : visible');
select ok(not public.org_is_public('suspended', 'moderation: contenu'), 'suspendu par la modération : masqué');
select ok(not public.org_is_public('pending', null), 'en attente de validation : masqué');
select hasnt_function('public', 'online_intake_open', 'version provisoire : online_intake_open absente');
select function_privs_are('public', 'online_tickets_open', array['uuid', 'boolean'], 'anon', array[]::text[],
  'online_tickets_open : jamais appelable par un visiteur');
select function_privs_are('public', 'online_requests_open', array['uuid'], 'authenticated', array[]::text[],
  'online_requests_open : jamais appelable par une session');
select function_privs_are('public', 'org_is_public', array['org_status', 'text'], 'anon', array[]::text[],
  'org_is_public : jamais appelable par un visiteur');
select function_privs_are('public', 'resolve_entry', array['text'], 'anon', array['EXECUTE'], 'resolve_entry : pages publiques');
select function_privs_are('public', 'branch_public', array['uuid'], 'anon', array['EXECUTE'], 'branch_public : pages publiques');
select function_privs_are('public', 'request_options', array['uuid'], 'anon', array['EXECUTE'], 'request_options : pages publiques');
select is((select count(*)::integer from pg_trigger where tgfoid = 'public.enforce_subscription_on_write'::regproc), 3,
  'écriture refusée selon l''abonnement : déclencheurs sur tickets, rendez-vous et demandes');

-- ─── Données ─────────────────────────────────────────────────────────────────
create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v text) on commit drop;
grant all on ids, vals to anon, authenticated;
create schema tests;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.entry() returns jsonb language sql as $$ select public.resolve_entry((select v from vals where name = 'code')) $$;
create function tests.branch() returns jsonb language sql as $$ select public.branch_public(tests.id('branch')) $$;
create function tests.request() returns jsonb language sql as $$ select public.request_options(tests.id('branch')) $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email, created_at)
values ('0b000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@resync.test', now());
select set_config('request.jwt.claims', json_build_object('sub', '0b000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into ids select 'org', public.create_organization('Clinique Resync', 'pgtap-resync', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Bonanjo');
select set_config('role', 'postgres', true);
insert into public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
select tests.id('org'), id, 'active', now() - interval '1 day', now() + interval '29 days' from public.plans where code = 'business';
update public.branch_settings set remote_tickets_enabled = true, appointment_requests_enabled = true where branch_id = tests.id('branch');
insert into vals select 'code', short_code from public.qr_codes where branch_id = tests.id('branch') and active limit 1;

-- ─── Établissement actif : clés présentes et ouvertes ───────────────────────
select set_config('role', 'anon', true);
select ok(tests.entry() ? 'online_open' and not (tests.entry() ? 'online_available'), 'resolve_entry : clé online_open (plus online_available)');
select ok(tests.branch() ? 'online_open' and tests.branch() ? 'requests_open' and not (tests.branch() ? 'online_available'),
  'branch_public : clés online_open et requests_open');
select ok(tests.request() ? 'online_open' and not (tests.request() ? 'online_available'), 'request_options : clé online_open');
select is(tests.entry() -> 'online_open', 'true'::jsonb, 'actif : resolve_entry ouvert');
select is(tests.branch() -> 'online_open', 'true'::jsonb, 'actif : branch_public, ticket à distance ouvert');
select is(tests.branch() -> 'requests_open', 'true'::jsonb, 'actif : branch_public, demandes ouvertes');
select is(tests.request() -> 'online_open', 'true'::jsonb, 'actif : request_options ouvert');

-- ─── Quota de tickets du mois bloqué (atteint la veille) ─────────────────────
select set_config('role', 'postgres', true);
update public.subscriptions set limit_overrides = '{"tickets_per_month": 1}' where organization_id = tests.id('org');
insert into public.messaging_usage (organization_id, month, tickets_created, tickets_reached_on)
values (tests.id('org'), date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date, 5,
        (now() at time zone 'Africa/Douala')::date - 1)
on conflict (organization_id, month) do update set tickets_created = 5, tickets_reached_on = excluded.tickets_reached_on;
select set_config('role', 'anon', true);
select is(tests.entry() -> 'online_open', 'false'::jsonb, 'quota bloqué : resolve_entry fermé');
select is(tests.branch() -> 'online_open', 'false'::jsonb, 'quota bloqué : branch_public, ticket à distance fermé');
-- Les demandes de rendez-vous en ligne sont fermées aussi (le patient passerait un ticket à son arrivée).
select is(tests.branch() -> 'requests_open', 'false'::jsonb, 'quota bloqué : branch_public, demandes fermées');
select is(tests.request() -> 'online_open', 'false'::jsonb, 'quota bloqué : request_options fermé');
select set_config('role', 'postgres', true);
select throws_ok(format($$ insert into public.appointment_requests (organization_id, branch_id, service_id, status)
  select %L, %L, (select id from public.services where branch_id = %L limit 1), 'pending' $$,
  tests.id('org'), tests.id('branch'), tests.id('branch')),
  'P0410', 'monthly_quota_reached', 'quota bloqué : demande refusée par la base aussi');
select set_config('role', 'anon', true);

-- ─── Lecture seule : tout est fermé ─────────────────────────────────────────
select set_config('role', 'postgres', true);
update public.subscriptions set limit_overrides = '{}', status = 'read_only', read_only_since = now() where organization_id = tests.id('org');
delete from public.messaging_usage where organization_id = tests.id('org');
select set_config('role', 'anon', true);
select is(tests.entry() -> 'online_open', 'false'::jsonb, 'lecture seule : resolve_entry fermé');
select is(tests.branch() -> 'online_open', 'false'::jsonb, 'lecture seule : branch_public, ticket à distance fermé');
select is(tests.branch() -> 'requests_open', 'false'::jsonb, 'lecture seule : branch_public, demandes fermées');
select is(tests.request() -> 'online_open', 'false'::jsonb, 'lecture seule : request_options fermé');

-- ─── Suspendu pour impayé : pages visibles, prise en ligne fermée ───────────
select set_config('role', 'postgres', true);
update public.subscriptions set status = 'suspended', suspended_since = now() where organization_id = tests.id('org');
update public.organizations set status = 'suspended', suspended_reason = 'subscription' where id = tests.id('org');
select set_config('role', 'anon', true);
select ok(tests.entry() is not null, 'suspendu pour impayé : /q visible');
select is(tests.entry() -> 'online_open', 'false'::jsonb, 'suspendu pour impayé : resolve_entry fermé');
select is(tests.branch() -> 'online_open', 'false'::jsonb, 'suspendu pour impayé : branch_public visible, ticket à distance fermé');
select is(tests.branch() -> 'requests_open', 'false'::jsonb, 'suspendu pour impayé : branch_public, demandes fermées');
select is(tests.request() -> 'online_open', 'false'::jsonb, 'suspendu pour impayé : request_options visible et fermé');

-- ─── Suspendu par la modération : introuvable ───────────────────────────────
select set_config('role', 'postgres', true);
update public.organizations set suspended_reason = 'moderation: contenu non conforme' where id = tests.id('org');
select set_config('role', 'anon', true);
select ok(tests.entry() is null, 'suspendu par la modération : /q introuvable');
select ok(tests.branch() is null, 'suspendu par la modération : branch_public introuvable');
select throws_ok('select tests.request()', 'P0404', 'not_found', 'suspendu par la modération : request_options introuvable');

select set_config('role', 'postgres', true);
select * from finish();
rollback;
