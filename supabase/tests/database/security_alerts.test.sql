-- pgTAP — S3 : alertes de sécurité par e-mail (nouvel appareil d'un administrateur, 10 échecs de connexion en
-- 15 minutes, double authentification supprimée, rôle d'administrateur attribué, export massif), destinataires,
-- dédoublonnage, droits. Journal d'audit inaltérable : vérifié par security.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(17);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.alerts(p_kind text) returns text language sql security definer as $$
  select coalesce(string_agg(to_email, ',' order by to_email), '') from public.security_alerts where kind = p_kind
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

update public.platform_settings set security_alert_email = 'securite@wintek.test';
delete from public.security_alerts;
insert into auth.users (id, instance_id, aud, role, email, created_at, raw_user_meta_data) values
  ('5a000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'directrice@alerte.test', now(), '{"locale":"fr"}'),
  ('5a000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adjoint@alerte.test', now(), '{"locale":"en"}'),
  ('5a000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agent@alerte.test', now(), '{}');

-- ─── Rôle d'administrateur attribué ──────────────────────────────────────────
select tests.login_as('5a000000-0000-0000-0000-0000000000a1');
insert into ids select 'org', public.create_organization('Clinique Alerte', 'pgtap-alerte', 'clinic');
select tests.logout();
select is(tests.alerts('admin_role_granted'), '', 'création de l''établissement : son premier administrateur n''est pas une alerte');
insert into public.memberships (organization_id, user_id, role) values (tests.id('org'), '5a000000-0000-0000-0000-0000000000a3', 'agent');
insert into public.memberships (organization_id, user_id, role) values (tests.id('org'), '5a000000-0000-0000-0000-0000000000a2', 'org_admin');
select is(tests.alerts('admin_role_granted'), 'adjoint@alerte.test,directrice@alerte.test,securite@wintek.test',
  'nouvel administrateur : Wintek, le compte concerné et les administrateurs de l''établissement');
select is((select locale from public.security_alerts where kind = 'admin_role_granted' and to_email = 'adjoint@alerte.test'), 'en',
  'langue du compte');
update public.memberships set role = 'receptionist' where user_id = '5a000000-0000-0000-0000-0000000000a3';
select is((select count(*)::integer from public.security_alerts where kind = 'admin_role_granted'), 3, 'autre rôle : pas d''alerte');

-- ─── Nouvel appareil d'un administrateur ────────────────────────────────────
select tests.login_as('5a000000-0000-0000-0000-0000000000a1');
select is(public.record_staff_login('appareil-numero-un-0001', 'Chrome sur Windows'), false, 'premier appareil : enregistré, pas d''alerte');
select is(public.record_staff_login('appareil-numero-un-0001', 'Chrome sur Windows'), false, 'appareil connu : rien');
select is(public.record_staff_login('appareil-numero-deux-002', 'Safari sur iPhone'), true, 'nouvel appareil : signalé');
select tests.logout();
select is(tests.alerts('admin_new_device'), 'directrice@alerte.test,securite@wintek.test', 'alerte au compte et à Wintek');
select ok((select bool_and(detail ->> 'device' = 'Safari sur iPhone' and not detail ? 'device_id') from public.security_alerts where kind = 'admin_new_device'),
  'appareil décrit par son navigateur, jamais par son identifiant');
-- Un agent (non administrateur) : pas d'alerte.
select tests.login_as('5a000000-0000-0000-0000-0000000000a3');
select public.record_staff_login('agent-appareil-un-00001');
select public.record_staff_login('agent-appareil-deux-0002');
select tests.logout();
select is((select count(*)::integer from public.security_alerts where kind = 'admin_new_device'), 2, 'agent : pas d''alerte de nouvel appareil');

-- ─── 10 échecs de connexion en 15 minutes ───────────────────────────────────
select public.record_login_failure('Directrice@Alerte.test') from generate_series(1, 9);
select is(tests.alerts('login_failures'), '', '9 échecs : pas encore d''alerte');
select is(public.record_login_failure('directrice@alerte.test'), 10, '10e échec');
select public.record_login_failure('directrice@alerte.test');
select is(tests.alerts('login_failures'), 'directrice@alerte.test,securite@wintek.test', '10 échecs : une seule alerte (Wintek et le compte)');

-- ─── Double authentification supprimée ───────────────────────────────────────
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values ('5a000000-0000-0000-0000-00000000f001', '5a000000-0000-0000-0000-0000000000a1', 'Téléphone', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP');
delete from auth.mfa_factors where id = '5a000000-0000-0000-0000-00000000f001';
select is(tests.alerts('mfa_disabled'), 'directrice@alerte.test,securite@wintek.test', 'double authentification supprimée : alerte');

-- ─── Export massif ───────────────────────────────────────────────────────────
select tests.login_as('5a000000-0000-0000-0000-0000000000a1');
select public.stats_export(tests.id('org'), null, current_date - 30, current_date, 'services');
select tests.logout();
select is(tests.alerts('mass_export'), '', 'export de 30 jours : pas d''alerte');
select tests.login_as('5a000000-0000-0000-0000-0000000000a1');
select public.stats_export(tests.id('org'), null, current_date - 200, current_date, 'services');
select tests.logout();
select is(tests.alerts('mass_export'), 'adjoint@alerte.test,directrice@alerte.test,securite@wintek.test',
  'export de plus de 92 jours : Wintek et les administrateurs');

-- ─── Droits ──────────────────────────────────────────────────────────────────
select tests.login_as('5a000000-0000-0000-0000-0000000000a1');
select is((select count(*)::integer from public.security_alerts), 0, 'administrateur d''établissement : ne lit pas les alertes (console seulement)');
select tests.logout();

select * from finish();
rollback;
