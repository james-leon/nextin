-- pgTAP — Nom du client : réglage par agence, saisie, visibilité (personnel de l'agence uniquement), purge,
-- et absence du nom partout où il ne doit jamais apparaître (tableau public, diffusions, notifications, audit).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(31);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anonymous boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, last_sign_in_at, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          case when p_anonymous then null else p_email end, p_anonymous, now(), now(),
          jsonb_build_object('full_name', split_part(p_email, '@', 1)))
  returning id;
$$;
create function tests.login_as(p_id uuid, p_anonymous boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;
create function tests.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Détail (DETAIL) de l'erreur levée par une requête, ou null.
create function tests.error_detail(p_sql text) returns text language plpgsql as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail;
end $$;
-- Exécute une requête en ignorant son erreur éventuelle (pour consommer un quota).
create function tests.try(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end $$;
grant usage on schema tests to authenticated, anon, service_role;
grant execute on all functions in schema tests to authenticated, anon, service_role;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v text) on commit drop;
grant all on ids, vals to authenticated, anon, service_role;

-- ─── Mise en place ───────────────────────────────────────────────────────────
select tests.create_user('a7000000-0000-0000-0000-00000000000a', 'admin@names-clinic.test');
select tests.create_user('b7000000-0000-0000-0000-00000000000b', 'admin@names-eneo.test');
select tests.create_user('d7000000-0000-0000-0000-00000000000d', 'agent@names-clinic.test');
select tests.create_user('e7000000-0000-0000-0000-000000000001', 'c1@names.test', true);
select tests.create_user('e7000000-0000-0000-0000-000000000002', 'c2@names.test', true);

select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('Names Clinic', 'pgtap-names-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', 600),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Laboratoire', 'L', 300);
insert into ids select 'consult', id from public.services where prefix = 'C' and branch_id = (select id from ids where name = 'akwa');
insert into ids select 'lab', id from public.services where prefix = 'L' and branch_id = (select id from ids where name = 'akwa');
insert into public.counters (organization_id, branch_id, kind, number)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1);
insert into ids select 'cab1', id from public.counters where branch_id = (select id from ids where name = 'akwa');
insert into public.counter_services (organization_id, counter_id, service_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'cab1'), (select id from ids where name = 'consult'));

select tests.login_as('b7000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('Names Eneo', 'pgtap-names-eneo', 'utility');
insert into ids select 'bonanjo', public.create_branch((select id from ids where name = 'eneo'), 'Bonanjo');

select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id)
values ((select id from ids where name = 'clinic'), 'd7000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa'));
delete from public.opening_hours where branch_id = (select id from ids where name = 'akwa');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select (select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), d, '00:00', '23:59:59'
from generate_series(1, 7) d;
insert into vals select 'qr', token from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active;

-- ─── Réglage par agence ──────────────────────────────────────────────────────
select is((select customer_name_mode from public.branch_settings where branch_id = (select id from ids where name = 'akwa')), 'required',
  'clinique : nom obligatoire par défaut');
select is((select customer_name_mode from public.branch_settings where branch_id = (select id from ids where name = 'bonanjo')), 'off',
  'autre secteur : nom non demandé par défaut');
select tests.as_anon();
select is(public.customer_identity_rules((select id from ids where name = 'akwa')), '{"mode": "required", "extra": "none"}'::jsonb,
  'règles lisibles des pages client (sans donnée personnelle)');
select tests.logout();
update public.branch_settings set customer_name_extra = 'age' where branch_id = (select id from ids where name = 'akwa');

-- ─── Prise de ticket par le client ───────────────────────────────────────────
select tests.as_service();
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e7000000-0000-0000-0000-000000000001') $$, 'P0422', 'name_required', 'nom obligatoire : ticket refusé sans nom');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e7000000-0000-0000-0000-000000000001', '   ') $$, 'P0422', 'name_required', 'un nom vide ne compte pas');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e7000000-0000-0000-0000-000000000001', 'Zorobabel Nkou', 140::smallint) $$, 'P0422', 'identity_invalid', 'âge impossible refusé');
insert into vals select 't1', public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e7000000-0000-0000-0000-000000000001', '  Zorobabel   Nkou ', 42::smallint, 'D-123')->>'ticket_id';
select tests.logout();
select is((select (full_name, age, file_number) from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't1')),
  ('Zorobabel Nkou'::text, 42::smallint, null::text), 'nom nettoyé et âge enregistrés ; numéro de dossier ignoré (non demandé)');

-- ─── Visibilité : personnel de l'agence uniquement ───────────────────────────
select tests.login_as('d7000000-0000-0000-0000-00000000000d');
select is((select full_name from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't1')), 'Zorobabel Nkou',
  'le personnel de l''agence voit le nom');
select tests.login_as('b7000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.ticket_identities), 0, 'un autre établissement ne voit aucun nom');
select tests.login_as('e7000000-0000-0000-0000-000000000001', true);
select is((select count(*)::int from public.ticket_identities), 0, 'le client (session anonyme) ne lit pas la table des noms');
select is((select count(*)::int from public.tickets where id = (select v::uuid from vals where name = 't1')), 1, 'il voit pourtant son ticket');
select tests.as_anon();
select throws_ok($$ select count(*) from public.ticket_identities $$, '42501', null, 'visiteur : aucun accès');
select tests.logout();
select ok((select relrowsecurity from pg_class where oid = 'public.ticket_identities'::regclass), 'RLS activée sur ticket_identities');
select ok(not has_table_privilege('authenticated', 'public.ticket_identities', 'INSERT')
  and not has_table_privilege('authenticated', 'public.ticket_identities', 'UPDATE'), 'aucune écriture directe : RPC seulement');

-- ─── Jamais sur le tableau public, la vue client ni les diffusions ───────────
select tests.login_as('d7000000-0000-0000-0000-00000000000d');
select public.open_counter((select id from ids where name = 'cab1'));
select public.call_next((select id from ids where name = 'cab1'));
select tests.logout();
select ok(public.branch_board((select id from ids where name = 'akwa'))::text not like '%Zorobabel%', 'nom absent du tableau (écran TV)');
select ok(public.ticket_view((select v::uuid from vals where name = 't1'))::text not like '%Zorobabel%', 'nom absent de la vue du ticket du client');
select is((select count(*)::int from realtime.messages where payload::text like '%Zorobabel%'), 0, 'nom absent de toutes les diffusions temps réel');
select ok(exists (select 1 from realtime.messages where topic = 'staff:branch:' || (select id from ids where name = 'akwa') and event = 'identity'),
  'les postes sont prévenus d''un changement de nom, sans le nom');

-- ─── Accueil : création avec nom, notifications sans nom ─────────────────────
select tests.login_as('d7000000-0000-0000-0000-00000000000d');
insert into vals select 't2', public.reception_create_ticket((select id from ids where name = 'consult'), null, null, null, '+237677001122', true, 'fr',
  'Bathilde Essomba', 61::smallint)->>'id';
select is((select full_name from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't2')), 'Bathilde Essomba',
  'accueil : nom enregistré à la création');
select public.admit_ticket((select id from public.tickets where counter_id = (select id from ids where name = 'cab1') and status = 'called'));
select public.finish_ticket((select id from public.tickets where counter_id = (select id from ids where name = 'cab1') and status = 'serving'));
select public.call_next((select id from ids where name = 'cab1'));
select tests.logout();
select ok(exists (select 1 from public.notification_jobs where ticket_id = (select v::uuid from vals where name = 't2')),
  'des messages sont bien en file pour ce ticket');
select is((select count(*)::int from public.notification_jobs where payload::text like '%Bathilde%' or payload::text like '%Essomba%'), 0,
  'nom absent des messages WhatsApp / SMS');
select is((select count(*)::int from public.audit_log where diff::text like '%Bathilde%' or diff::text like '%Zorobabel%' or diff::text like '%Kemajou-Pgtap%'), 0,
  'nom absent du journal d''audit');

-- ─── Correction du nom (accueil) ─────────────────────────────────────────────
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into vals select 't3', public.reception_create_ticket((select id from ids where name = 'lab'))->>'id';
select is((select count(*)::int from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't3')), 0,
  'accueil : ticket sans nom accepté (complété ensuite)');
select public.set_ticket_identity((select v::uuid from vals where name = 't3'), 'Hermine Kemajou-Pgtap', 70::smallint);
select is((select full_name from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't3')), 'Hermine Kemajou-Pgtap',
  'nom saisi après coup');
select tests.login_as('b7000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.set_ticket_identity((select v::uuid from vals where name = 't3'), 'Intrus') $$, '42501', null,
  'un autre établissement ne peut pas modifier le nom');
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into vals select 't4', public.transfer_ticket((select v::uuid from vals where name = 't3'), (select id from ids where name = 'consult'))->>'id';
select is((select full_name from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't4')), 'Hermine Kemajou-Pgtap',
  'réorientation : le nom suit le nouveau ticket');
select public.set_ticket_identity((select v::uuid from vals where name = 't4'), '');
select is((select count(*)::int from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't4')), 0,
  'nom effacé par le personnel');
select tests.logout();

-- ─── Agence sans nom demandé : rien n'est enregistré ─────────────────────────
update public.branch_settings set customer_name_mode = 'off' where branch_id = (select id from ids where name = 'akwa');
select tests.as_service();
insert into vals select 't5', public.take_ticket((select id from ids where name = 'lab'), 'qr', (select v from vals where name = 'qr'), null,
  'e7000000-0000-0000-0000-000000000002', 'Ignoré')->>'ticket_id';
select tests.logout();
select is((select count(*)::int from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't5')), 0,
  'nom non demandé : aucune identité enregistrée');

-- ─── Purge après la durée de conservation ────────────────────────────────────
update public.tickets set created_at = now() - interval '40 days' where id = (select v::uuid from vals where name = 't1');
select public.purge_personal_data();
select is((select count(*)::int from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't1')), 0,
  'identité purgée après data_retention_days');
select is((select count(*)::int from public.ticket_identities where ticket_id = (select v::uuid from vals where name = 't2')), 1,
  'identité récente conservée');
select ok(pg_get_functiondef('public.purge_personal_data()'::regprocedure) like '%customer_age = null%',
  'purge : nom, âge et numéro de dossier des rendez-vous et des demandes');

select * from finish();
rollback;
