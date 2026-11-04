-- pgTAP — Style A : photo d'établissement (droits d'écriture, version, résumé public).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(12);

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

select tests.create_user('a8000000-0000-0000-0000-00000000000a', 'admin@photo-clinic.test');
select tests.create_user('b8000000-0000-0000-0000-00000000000b', 'admin@photo-eneo.test');
select tests.create_user('d8000000-0000-0000-0000-00000000000d', 'agent@photo-clinic.test');
select tests.create_user('e8000000-0000-0000-0000-000000000001', 'c1@photo.test', true);

select tests.login_as('a8000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('Photo Clinic', 'pgtap-photo-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
select tests.login_as('b8000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('Photo Eneo', 'pgtap-photo-eneo', 'utility');
select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id)
values ((select id from ids where name = 'clinic'), 'd8000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa'));
insert into vals select 'cover', (select id from ids where name = 'clinic') || '/' || (select id from ids where name = 'akwa') || '/cover.webp';

select tests.login_as('a8000000-0000-0000-0000-00000000000a');
select ok(public.can_write_branch_photo((select v from vals where name = 'cover')), 'le directeur peut téléverser la photo');
select ok(not public.can_write_branch_photo((select id from ids where name = 'clinic') || '/' || (select id from ids where name = 'akwa') || '/autre.png'),
  'nom de fichier imposé (cover.webp ou thumb.webp)');
select ok(not public.can_write_branch_photo('pas-un-uuid/x/cover.webp'), 'chemin invalide refusé');
select tests.login_as('d8000000-0000-0000-0000-00000000000d');
select ok(not public.can_write_branch_photo((select v from vals where name = 'cover')), 'un agent ne change pas la photo');
select tests.login_as('b8000000-0000-0000-0000-00000000000b');
select ok(not public.can_write_branch_photo((select v from vals where name = 'cover')), 'un autre établissement non plus');
select throws_ok($$ select public.set_branch_photo((select id from ids where name = 'akwa'), true) $$, '42501', null,
  'set_branch_photo refusé à un autre établissement');
select tests.login_as('e8000000-0000-0000-0000-000000000001', true);
select ok(not public.can_write_branch_photo((select v from vals where name = 'cover')), 'session client : refusé');

select tests.login_as('a8000000-0000-0000-0000-00000000000a');
select public.set_branch_photo((select id from ids where name = 'akwa'), true);
select tests.as_anon();
select is(public.branch_public((select id from ids where name = 'akwa')) -> 'photo' ->> 'cover', (select v from vals where name = 'cover'),
  'résumé public : chemin de la photo');
select tests.login_as('a8000000-0000-0000-0000-00000000000a');
select public.set_branch_photo((select id from ids where name = 'akwa'), false);
select ok(public.branch_public((select id from ids where name = 'akwa')) -> 'photo' = 'null'::jsonb, 'photo retirée : icône du secteur');

-- ─── Tableau de bord : attente moyenne par jour (période précédente) ─────────
select tests.login_as('a8000000-0000-0000-0000-00000000000a');
select is(jsonb_array_length(public.daily_wait_series((select id from ids where name = 'clinic'), null, current_date - 6, current_date)), 7,
  'une valeur par jour de la période');
select tests.login_as('b8000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.daily_wait_series((select id from ids where name = 'clinic'), null, current_date - 6, current_date) $$, '42501', null,
  'série refusée à un autre établissement');
select tests.login_as('d8000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.daily_wait_series((select id from ids where name = 'clinic'), null, current_date - 6, current_date) $$, '42501', null,
  'un agent n''a pas accès aux statistiques');

select * from finish();
rollback;
