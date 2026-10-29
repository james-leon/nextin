-- pgTAP — Backlog : présence d'un ticket à distance confirmée par le QR code tournant de l'écran TV ; option d'agence
-- « seulement par l'écran » (le QR imprimé ne suffit plus) ; secret jamais lisible ; code de l'écran par jeton d'appareil.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(14);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anon boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_anon, now())
  returning id;
$$;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
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
create function tests.token(p_name text) returns text language sql security definer as $$
  select public_token from public.tickets where id = (select coalesce((v ->> 'ticket_id')::uuid, (v ->> 'id')::uuid) from vals where name = p_name)
$$;
create function tests.code(p_minutes_ago int) returns text language sql security definer as $$
  select public.presence_code(tests.id('akwa'), public.presence_minute() - p_minutes_ago)
$$;
create function tests.qr(p_col text) returns text language sql security definer as $$
  select case p_col when 'token' then token else short_code end from public.qr_codes where branch_id = tests.id('akwa') limit 1
$$;
create function tests.confirmed(p_name text) returns boolean language sql security definer as $$
  select presence_confirmed_at is not null from public.tickets where public_token = tests.token(p_name)
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.create_user('ae000000-0000-0000-0000-00000000000a', 'admin@presence.test');
select tests.create_user('ae000000-0000-0000-0000-0000000000c1', null, true);
select tests.create_user('ae000000-0000-0000-0000-0000000000c2', null, true);
select tests.create_user('ae000000-0000-0000-0000-0000000000c3', null, true);
select tests.create_user('ae000000-0000-0000-0000-0000000000c4', null, true);
select tests.login_as('ae000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('Clinique Présence', 'pgtap-presence', 'clinic');
insert into ids select 'akwa', public.create_branch(tests.id('clinic'), 'Akwa', null, 'Douala', null, 4.05, 9.70);
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('clinic'), tests.id('akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where branch_id = tests.id('akwa');
select tests.logout();
delete from public.opening_hours where branch_id = tests.id('akwa');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.id('clinic'), tests.id('akwa'), d, '00:00', '23:59:59' from generate_series(1, 7) d;
update public.branch_settings set remote_tickets_enabled = true, remote_max_distance_km = null where branch_id = tests.id('akwa');
select tests.as_role('service_role');
insert into vals select 'U' || n, public.take_remote_ticket(tests.id('consult'), null, null, null, ('ae000000-0000-0000-0000-0000000000c' || n)::uuid)
from generate_series(1, 4) n;
select tests.logout();

-- ─── Code tournant de l'écran ─────────────────────────────────────────────────
select ok(tests.code(0) ~ '^[0-9A-F]{6}$', 'code de présence : 6 caractères, secret de l''agence créé au premier usage');
select isnt(tests.code(0), tests.code(1), 'le code change chaque minute');
select tests.as_role('anon');
select ok(public.confirm_presence(tests.token('U1'), lower(tests.code(0))) -> 'remote' ->> 'presence_confirmed_at' is not null,
  'code de la minute (QR de l''écran TV) : présence confirmée');
select ok(public.confirm_presence(tests.token('U2'), tests.code(1)) -> 'remote' ->> 'presence_confirmed_at' is not null,
  'code de la minute précédente accepté (rafraîchissement de l''écran)');
select throws_ok(format('select public.confirm_presence(%L, %L)', tests.token('U3'), tests.code(2)), 'P0422', 'invalid_entry',
  'code périmé (photo de l''écran) : refusé');
select tests.logout();
select is((select payload ->> 'by' from public.ticket_events where ticket_id = (select coalesce((v ->> 'ticket_id')::uuid, (v ->> 'id')::uuid) from vals where name = 'U1')
  and type = 'presence_confirmed'), 'tv', 'journal : présence confirmée par l''écran');

-- ─── Option « seulement par l'écran » ─────────────────────────────────────────
select tests.as_role('anon');
select ok(public.confirm_presence(tests.token('U3'), tests.qr('token')) -> 'remote' ->> 'presence_confirmed_at' is not null,
  'par défaut, le QR imprimé confirme encore la présence');
select tests.logout();
update public.branch_settings set remote_presence_tv_only = true where branch_id = tests.id('akwa');
select tests.as_role('anon');
select throws_ok(format('select public.confirm_presence(%L, %L)', tests.token('U4'), tests.qr('token')), 'P0422', 'presence_tv_only',
  'option activée : QR imprimé refusé pour la présence');
select throws_ok(format('select public.confirm_presence(%L, %L)', tests.token('U4'), tests.qr('short_code')), 'P0422', 'presence_tv_only',
  'option activée : code court refusé pour la présence');
select ok(public.confirm_presence(tests.token('U4'), tests.code(0)) -> 'remote' ->> 'presence_confirmed_at' is not null,
  'option activée : code de l''écran accepté');
select tests.logout();

-- ─── Secret et droits ─────────────────────────────────────────────────────────
select tests.login_as('ae000000-0000-0000-0000-00000000000a');
select throws_ok($$ select * from public.branch_presence_secrets $$, '42501', null, 'secret jamais lisible par un compte');
select throws_ok(format('select public.presence_code(%L, 1)', tests.id('akwa')), '42501', null, 'code non calculable par un compte');
select tests.logout();
insert into public.displays (organization_id, branch_id, name, status, device_token_hash)
values (tests.id('clinic'), tests.id('akwa'), 'Salle', 'active', public.sha256_hex('device-presence-token-1234567890'));
select tests.as_role('service_role');
select is(public.tv_presence_code('device-presence-token-1234567890') ->> 'code', tests.code(0), 'écran appairé : code de la minute');
select is(public.tv_presence_code('inconnu-inconnu-inconnu'), null, 'écran inconnu : aucun code');
select tests.logout();

select * from finish();
rollback;
