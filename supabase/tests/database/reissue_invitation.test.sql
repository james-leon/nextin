-- pgTAP — P2 : renvoi d'une invitation en attente. Nouveau jeton (l'ancien lien ne fonctionne plus), 7 nouveaux jours,
-- mêmes droits que l'invitation (administrateur, responsable de l'agence pour ses rôles, super admin), limité, journalisé.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(11);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
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
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('7d000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@renvoi.test', now()),
  ('7d000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'autre@renvoi.test', now()),
  ('7d000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recep@renvoi.test', now()),
  ('7d000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wintek@renvoi.test', now());
insert into public.platform_admins (user_id) values ('7d000000-0000-0000-0000-0000000000a4');

select tests.login_as('7d000000-0000-0000-0000-0000000000a1');
insert into vals select 'org', public.create_organization('Clinique Renvoi', 'pgtap-renvoi', 'clinic')::text;
insert into vals select 'branch', public.create_branch(tests.v('org')::uuid, 'Akwa')::text;
insert into vals select 'old', public.create_invitation(tests.v('org')::uuid, 'receptionist', tests.v('branch')::uuid, 'recep@renvoi.test');
insert into vals select 'inv', id::text from public.invitations where email = 'recep@renvoi.test';
select tests.logout();
-- Invitation presque expirée.
update public.invitations set expires_at = now() + interval '1 hour' where id = tests.v('inv')::uuid;

-- Un compte étranger à l'établissement : refusé.
select tests.login_as('7d000000-0000-0000-0000-0000000000a2');
select throws_ok(format($$ select public.reissue_invitation(%L) $$, tests.v('inv')), '42501', null, 'compte étranger : refusé');

-- L'administratrice renvoie : nouveau jeton, 7 jours.
select tests.login_as('7d000000-0000-0000-0000-0000000000a1');
insert into vals select 'r', public.reissue_invitation(tests.v('inv')::uuid)::text;
select tests.logout();
select ok((tests.v('r')::jsonb ->> 'token') ~ '^[A-Za-z0-9_-]{32}$' and (tests.v('r')::jsonb ->> 'token') <> tests.v('old'), 'nouveau jeton');
select is((tests.v('r')::jsonb ->> 'email') || ':' || (tests.v('r')::jsonb ->> 'role') || ':' || (tests.v('r')::jsonb ->> 'organization'),
  'recep@renvoi.test:receptionist:Clinique Renvoi', 'destinataire, rôle et établissement pour l''e-mail');
select ok((select expires_at > now() + interval '6 days 23 hours' from public.invitations where id = tests.v('inv')::uuid), '7 nouveaux jours');
select is((select count(*)::integer from public.audit_log where action = 'member.invite_resent' and entity_id = tests.v('inv')::uuid), 1, 'renvoi journalisé');

-- L'ancien lien ne fonctionne plus, le nouveau oui.
select tests.login_as('7d000000-0000-0000-0000-0000000000a3');
select throws_ok(format($$ select public.accept_invitation(%L) $$, tests.v('old')), null, null, 'ancien lien : refusé');
select lives_ok(format($$ select public.accept_invitation(%L) $$, tests.v('r')::jsonb ->> 'token'), 'nouveau lien : accepté');
select tests.logout();

-- Invitation acceptée : plus rien à renvoyer.
select tests.login_as('7d000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.reissue_invitation(%L) $$, tests.v('inv')), 'P0002', 'invitation_invalid', 'invitation acceptée : rien à renvoyer');

-- Super admin (responsable invité depuis la console) et limite de trois renvois par heure.
insert into vals select 'inv2', null;
select public.create_invitation(tests.v('org')::uuid, 'agent', tests.v('branch')::uuid, 'agent@renvoi.test');
update vals set v = (select id::text from public.invitations where email = 'agent@renvoi.test') where name = 'inv2';
select tests.login_as('7d000000-0000-0000-0000-0000000000a4');
select lives_ok(format($$ select public.reissue_invitation(%L) $$, tests.v('inv2')), 'super admin : autorisé');
select public.reissue_invitation(tests.v('inv2')::uuid);
select public.reissue_invitation(tests.v('inv2')::uuid);
select throws_ok(format($$ select public.reissue_invitation(%L) $$, tests.v('inv2')), 'P0429', null, 'quatrième renvoi dans l''heure : refusé');
select tests.logout();
insert into vals select 'anon_sql', format('select public.reissue_invitation(%L)', tests.v('inv2'));
set local role anon;
select throws_ok((select v from vals where name = 'anon_sql'), '42501', null, 'visiteur : pas de droit d''exécution');
reset role;

select * from finish();
rollback;
