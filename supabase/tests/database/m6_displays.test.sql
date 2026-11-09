-- pgTAP — M6 : écrans TV (appairage, jeton remis une seule fois, session, révocation, isolation), annonces.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
-- M10a : `create_organization` réservé à l'inscription ; appel direct permis dans ce test (annulé au rollback).
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(24);

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, false, now())
  returning id;
$$;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
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
grant usage on schema tests to authenticated, anon, service_role;
grant execute on all functions in schema tests to authenticated, anon, service_role;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to authenticated, anon, service_role;

select tests.create_user('a6000000-0000-0000-0000-00000000000a', 'admin@m6-clinic.test');
select tests.create_user('b6000000-0000-0000-0000-00000000000b', 'admin@m6-eneo.test');
select tests.create_user('d6000000-0000-0000-0000-00000000000d', 'agent@m6-clinic.test');

select tests.login_as('a6000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M6 Clinic', 'pgtap-m6-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', 600),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Laboratoire', 'L', 300);
insert into ids select 'consult', id from public.services where prefix = 'C' and branch_id = (select id from ids where name = 'akwa');
select tests.login_as('b6000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M6 Eneo', 'pgtap-m6-eneo', 'utility');
select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id)
values ((select id from ids where name = 'clinic'), 'd6000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa'));

-- ─── Appairage ───────────────────────────────────────────────────────────────
select tests.login_as('d6000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.tv_create_pairing(null) $$, '42501', null, 'création d''un code réservée au serveur');
select tests.as_service();
insert into vals select 'pair', public.tv_create_pairing('ip-tv');
select matches((select v->>'code' from vals where name = 'pair'), '^[0-9]{6}$', 'code d''appairage à 6 chiffres');
select is(public.tv_poll_pairing(((select v->>'display_id' from vals where name = 'pair'))::uuid, (select v->>'poll_secret' from vals where name = 'pair'))->>'status',
  'pending', 'écran en attente');
select is(public.tv_poll_pairing(((select v->>'display_id' from vals where name = 'pair'))::uuid, 'mauvais-secret')->>'status',
  'unknown', 'mauvais secret : rien n''est révélé');

select tests.login_as('d6000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.pair_display((select v->>'code' from vals where name = 'pair'), (select id from ids where name = 'akwa'), 'Salle d''attente') $$,
  '42501', null, 'un agent ne peut pas appairer un écran');
select tests.login_as('b6000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.pair_display((select v->>'code' from vals where name = 'pair'), (select id from ids where name = 'akwa'), 'Pirate') $$,
  '42501', null, 'ni un autre établissement');
select tests.login_as('a6000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.pair_display('000000', (select id from ids where name = 'akwa'), 'Salle') $$,
  'P0404', 'pairing_code_invalid', 'code inconnu refusé');
insert into ids select 'tv', public.pair_display((select v->>'code' from vals where name = 'pair'), (select id from ids where name = 'akwa'), 'Salle d''attente');
select is((select (status::text, name) from public.displays where id = (select id from ids where name = 'tv')), ('active'::text, 'Salle d''attente'::text),
  'écran appairé à l''agence');
select is((select count(*)::int from public.display_services where display_id = (select id from ids where name = 'tv')), 2,
  'par défaut, tous les services de l''agence');
select ok(exists (select 1 from public.audit_log where action = 'display.pair'), 'appairage journalisé');
select throws_ok($$ select device_token_hash from public.displays $$, '42501', null, 'l''empreinte du jeton n''est jamais lisible');

select tests.as_service();
insert into vals select 'token', public.tv_poll_pairing(((select v->>'display_id' from vals where name = 'pair'))::uuid, (select v->>'poll_secret' from vals where name = 'pair'));
select is((select v->>'status' from vals where name = 'token'), 'active', 'l''écran reçoit son jeton');
select is(public.tv_poll_pairing(((select v->>'display_id' from vals where name = 'pair'))::uuid, (select v->>'poll_secret' from vals where name = 'pair'))->>'status',
  'unknown', 'le jeton n''est remis qu''une fois');
insert into vals select 'session', public.tv_session((select v->>'device_token' from vals where name = 'token'), '1.0');
select is((select v->'branch'->>'name' from vals where name = 'session'), 'Akwa', 'session : agence de l''écran');
select is((select jsonb_array_length(v->'service_ids') from vals where name = 'session'), 2, 'session : services affichés');
select ok((select v->'entry'->>'short_code' from vals where name = 'session') is not null, 'session : QR code d''entrée de l''agence');
select is((select v->'announcements'->>'repeat_count' from vals where name = 'session'), '1', 'session : réglages d''annonce par défaut');
select is(public.tv_session('jeton-inconnu'), null::jsonb, 'jeton inconnu refusé');
select tests.logout();
select ok((select last_seen_at is not null and app_version = '1.0' from public.displays where id = (select id from ids where name = 'tv')),
  'dernière présence de l''écran enregistrée');

-- ─── Modification, isolation, révocation ─────────────────────────────────────
select tests.login_as('a6000000-0000-0000-0000-00000000000a');
select public.update_display((select id from ids where name = 'tv'), 'Hall', array[(select id from ids where name = 'consult')], true);
select is((select count(*)::int from public.display_services where display_id = (select id from ids where name = 'tv')), 1, 'services affichés modifiés');
insert into public.announcement_settings (organization_id, branch_id, languages, repeat_count)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), array['fr', 'en'], 2);
select tests.login_as('d6000000-0000-0000-0000-00000000000d');
update public.announcement_settings set volume = 10;
select tests.logout();
select is((select volume from public.announcement_settings where branch_id = (select id from ids where name = 'akwa')), 80::smallint,
  'un agent ne modifie pas les annonces (RLS)');
select tests.login_as('b6000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.displays), 0, 'isolation : écrans d''un autre établissement invisibles');
select tests.login_as('a6000000-0000-0000-0000-00000000000a');
select public.revoke_display((select id from ids where name = 'tv'));
select tests.as_service();
select is(public.tv_session((select v->>'device_token' from vals where name = 'token')), null::jsonb, 'révoqué : le jeton ne fonctionne plus');
select tests.logout();
select ok(exists (select 1 from public.audit_log where action = 'display.revoke'), 'révocation journalisée');

select * from finish();
rollback;
