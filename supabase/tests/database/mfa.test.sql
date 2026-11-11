-- pgTAP — B5 : double authentification. Désactivée par défaut (compatibilité) ; obligatoire pour le super admin et
-- les administrateurs quand la plateforme l'exige ; pour tout le personnel d'un établissement qui l'exige ; pour tout
-- compte ayant enregistré un facteur. Session aal2 exigée dans les fonctions sensibles, code récent (amr < 5 min) pour
-- une suppression, un changement de rôle et un export. Réinitialisation du facteur par le super admin, journalisée.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(27);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, now())
  returning id;
$$;
-- Session : niveau (aal1 / aal2) et code TOTP saisi il y a `p_totp_age` secondes (null : jamais).
create function tests.login_as(p_id uuid, p_aal text default 'aal1', p_totp_age integer default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_id, 'role', 'authenticated', 'aal', p_aal,
    'amr', case when p_totp_age is null then json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint))
                else json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - 3600),
                                      json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - p_totp_age)) end
  )::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function tests.add_factor(p_user uuid) returns void language sql as $$
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), p_user, 'Téléphone', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP');
$$;
grant usage on schema tests to authenticated;
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
grant execute on all functions in schema tests to authenticated;

-- ─── Données : un établissement, une administratrice, un agent, le super admin ─
select tests.create_user('5f000000-0000-0000-0000-0000000000a1', 'admin@mfa.test');
select tests.create_user('5f000000-0000-0000-0000-0000000000a2', 'agent@mfa.test');
select tests.create_user('5f000000-0000-0000-0000-0000000000a3', 'wintek@mfa.test');
insert into public.platform_admins (user_id) values ('5f000000-0000-0000-0000-0000000000a3');
select tests.login_as('5f000000-0000-0000-0000-0000000000a1');
insert into ids select 'org', public.create_organization('Clinique MFA', 'pgtap-mfa', 'clinic');
select tests.logout();
insert into public.memberships (organization_id, user_id, role)
values (tests.id('org'), '5f000000-0000-0000-0000-0000000000a2', 'agent');
insert into ids select 'agent_m', id from public.memberships where user_id = '5f000000-0000-0000-0000-0000000000a2';

-- ─── Désactivée par défaut : rien ne change pour le code en ligne ────────────
select is((select mfa_required from public.platform_settings), false, 'obligation désactivée par défaut');
select tests.login_as('5f000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$ select public.billing_overview(%L) $$, tests.id('org')), 'sans obligation : administratrice en aal1 acceptée');
select lives_ok($$ update public.memberships set role = 'receptionist' where id = tests.id('agent_m') $$, 'sans obligation : changement de rôle en aal1');
select is((public.my_mfa_status() ->> 'required')::boolean, false, 'statut : non exigée');
select tests.login_as('5f000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select public.admin_subscriptions() $$, 'sans obligation : console en aal1');
select tests.logout();

-- ─── Obligation de la plateforme : super admin et administrateurs ───────────
update public.platform_settings set mfa_required = true;
select tests.login_as('5f000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.admin_revenue() $$, 'P0401', 'mfa_required', 'console : aal2 exigé du super admin');
select throws_ok($$ select public.admin_subscriptions() $$, 'P0401', 'mfa_required', 'console : liste des abonnements refusée en aal1');
select tests.login_as('5f000000-0000-0000-0000-0000000000a3', 'aal2', 30);
select lives_ok($$ select public.admin_subscriptions() $$, 'console : acceptée en aal2');
select tests.login_as('5f000000-0000-0000-0000-0000000000a1');
select is((public.my_mfa_status() ->> 'required')::boolean, true, 'statut : exigée pour l''administratrice');
select throws_ok(format($$ select public.billing_overview(%L) $$, tests.id('org')), 'P0401', 'mfa_required', 'abonnement et paiements : aal2 exigé');
select throws_ok($$ update public.memberships set role = 'agent' where id = tests.id('agent_m') $$, 'P0401', 'mfa_required',
  'changement de rôle refusé en aal1');
select throws_ok(format($$ select public.create_invitation(%L, 'agent', null, 'nouveau@mfa.test') $$, tests.id('org')), 'P0401', 'mfa_required',
  'invitation refusée en aal1');
-- aal2, code saisi il y a 20 minutes : action courante acceptée, changement de rôle et export refusés.
select tests.login_as('5f000000-0000-0000-0000-0000000000a1', 'aal2', 1200);
select lives_ok(format($$ select public.billing_overview(%L) $$, tests.id('org')), 'abonnement : accepté en aal2');
select lives_ok($$ update public.memberships set active = false where id = tests.id('agent_m') $$, 'désactivation d''un membre : aal2 suffit');
select throws_ok($$ update public.memberships set role = 'agent' where id = tests.id('agent_m') $$, 'P0401', 'mfa_recent_required',
  'changement de rôle : code de moins de 5 minutes exigé');
select throws_ok(format($$ select public.stats_export(%L, null, current_date - 7, current_date, 'services') $$, tests.id('org')), 'P0401',
  'mfa_recent_required', 'export : code de moins de 5 minutes exigé');
-- Code saisi il y a une minute.
select tests.login_as('5f000000-0000-0000-0000-0000000000a1', 'aal2', 60);
select lives_ok($$ update public.memberships set role = 'agent', active = true where id = tests.id('agent_m') $$, 'changement de rôle : accepté avec un code récent');
select lives_ok(format($$ select public.stats_export(%L, null, current_date - 7, current_date, 'services') $$, tests.id('org')), 'export : accepté avec un code récent');

-- L'agent (rôle sans obligation, sans facteur) n'est pas concerné.
select tests.login_as('5f000000-0000-0000-0000-0000000000a2');
select is((public.my_mfa_status() ->> 'required')::boolean, false, 'agent : 2FA facultative');

-- ─── Obligation pour tout le personnel de l'établissement ───────────────────
select tests.login_as('5f000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ update public.organizations set mfa_required_all = true where id = %L $$, tests.id('org')), 'P0401', 'mfa_required',
  'réglage de l''établissement : modifiable seulement en aal2');
select tests.login_as('5f000000-0000-0000-0000-0000000000a1', 'aal2', 60);
update public.organizations set mfa_required_all = true where id = tests.id('org');
select tests.login_as('5f000000-0000-0000-0000-0000000000a2');
select is((public.my_mfa_status() ->> 'required')::boolean, true, 'agent : 2FA exigée par l''établissement');
select tests.logout();
select is((select count(*)::integer from public.audit_log where action = 'security.mfa_required_all' and organization_id = tests.id('org')), 1,
  'activation journalisée');

-- ─── Facteur enregistré volontairement : aal2 exigé pour ce compte ──────────
update public.platform_settings set mfa_required = false;
update public.organizations set mfa_required_all = false where id = tests.id('org');
select tests.add_factor('5f000000-0000-0000-0000-0000000000a2');
select tests.login_as('5f000000-0000-0000-0000-0000000000a2');
select is(public.my_mfa_status() ->> 'enrolled', 'true', 'facteur enregistré');
select tests.logout();

-- ─── Réinitialisation par le super admin, journalisée ───────────────────────
update public.platform_settings set mfa_required = true;
select tests.login_as('5f000000-0000-0000-0000-0000000000a1', 'aal2', 60);
select throws_ok($$ select public.admin_reset_mfa('agent@mfa.test', 'Téléphone perdu') $$, '42501', 'not_allowed', 'réinitialisation : super admin uniquement');
select tests.login_as('5f000000-0000-0000-0000-0000000000a3', 'aal2', 60);
select throws_ok($$ select public.admin_reset_mfa('agent@mfa.test', '') $$, 'P0422', 'reason_required', 'réinitialisation : motif obligatoire');
select is(public.admin_reset_mfa('agent@mfa.test', 'Téléphone perdu'), 1, 'facteur supprimé');
select tests.logout();
select is((select diff ->> 'reason' from public.audit_log where action = 'security.mfa_reset' order by created_at desc limit 1),
  'Téléphone perdu', 'réinitialisation journalisée avec le motif');

select * from finish();
rollback;
