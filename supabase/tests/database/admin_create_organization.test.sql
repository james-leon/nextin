-- pgTAP — P1 : création d'un établissement depuis la console Wintek pour un client (formule, essai, première agence,
-- services d'un modèle, invitation du responsable). Le super admin n'en devient pas membre ; le responsable devient
-- administrateur en acceptant l'invitation ; limites de la formule appliquées ; motif journalisé ; droits.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);
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
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on vals to authenticated;
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
create function tests.fields(p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'name', 'Clinique Console', 'type', 'clinic', 'locale', 'fr', 'slug', 'pgtap-console',
    'plan_id', (select id from public.plans where code = 'business'), 'trial_days', 45,
    'owner_email', 'Responsable@Console.test', 'owner_phone', '+237690112233',
    'branch_name', 'Akwa', 'branch_city', 'Douala',
    'services', jsonb_build_array(
      jsonb_build_object('name', 'Consultation', 'name_en', 'Consultation', 'prefix', 'C', 'seconds', 900, 'color', '#1A6BB5'),
      jsonb_build_object('name', 'Laboratoire', 'name_en', 'Laboratory', 'prefix', 'L', 'seconds', 600, 'color', '#2E8B57'),
      jsonb_build_object('name', 'Pharmacie', 'name_en', 'Pharmacy', 'prefix', 'P', 'seconds', 300, 'color', '#8E5BB5')),
    'reason', 'Contrat signé le 10 novembre') || p_extra
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('6c000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wintek@console.test', now()),
  ('6c000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'responsable@console.test', now()),
  ('6c000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quelquun@console.test', now());
insert into public.platform_admins (user_id) values ('6c000000-0000-0000-0000-0000000000a1');

-- ─── Droits ──────────────────────────────────────────────────────────────────
select tests.login_as('6c000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.admin_create_organization(tests.fields()) $$, '42501', null, 'compte ordinaire : refusé');
select tests.logout();
set local role anon;
select throws_ok($$ select public.admin_create_organization('{}') $$, '42501', null, 'visiteur : pas de droit d''exécution');
reset role;

-- ─── Validation ──────────────────────────────────────────────────────────────
select tests.login_as('6c000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.admin_create_organization(tests.fields('{"reason":"  "}')) $$, '22023', 'reason_required', 'motif obligatoire');
select throws_ok($$ select public.admin_create_organization(tests.fields('{"trial_days":0}')) $$, '22023', 'invalid_trial_days', 'essai d''au moins un jour');
select throws_ok($$ select public.admin_create_organization(tests.fields('{"owner_email":"pas-une-adresse"}')) $$, '22023', 'invalid_email', 'adresse du responsable vérifiée');
select throws_ok($$ select public.admin_create_organization(tests.fields(jsonb_build_object('services', jsonb_build_array(
    jsonb_build_object('name', 'Consultation', 'prefix', 'C', 'seconds', 900, 'color', '#1A6BB5'),
    jsonb_build_object('name', 'Contrôle', 'prefix', 'C', 'seconds', 900, 'color', '#1A6BB5'))))) $$,
  '22023', 'invalid_services', 'préfixes de services uniques');

-- ─── Création ────────────────────────────────────────────────────────────────
insert into vals select 'r', public.admin_create_organization(tests.fields());
select tests.logout();
select ok((tests.v('r') ->> 'token') ~ '^[A-Za-z0-9_-]{32}$', 'jeton d''invitation renvoyé une fois');
select is((select status::text from public.organizations where id = (tests.v('r') ->> 'organization_id')::uuid), 'active', 'établissement actif');
select is((select count(*)::integer from public.memberships where organization_id = (tests.v('r') ->> 'organization_id')::uuid), 0,
  'le super admin n''en devient pas membre');
select is((select status::text || ':' || (trial_ends_at::date - current_date) || ':' || billing_email from public.subscriptions
  where organization_id = (tests.v('r') ->> 'organization_id')::uuid), 'trialing:45:responsable@console.test', 'essai de 45 jours sur la formule choisie');
select is((select p.code from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.organization_id = (tests.v('r') ->> 'organization_id')::uuid), 'business', 'formule choisie');
select is((select string_agg(prefix || ':' || name, ',' order by sort_order) from public.services
  where organization_id = (tests.v('r') ->> 'organization_id')::uuid), 'C:Consultation,L:Laboratoire,P:Pharmacie', 'services du modèle, dans l''ordre');
select is((select name || ':' || city from public.branches where id = (tests.v('r') ->> 'branch_id')::uuid), 'Akwa:Douala', 'première agence');
select ok(exists (select 1 from public.qr_codes where branch_id = (tests.v('r') ->> 'branch_id')::uuid), 'QR code de l''agence émis');
select is((select role::text || ':' || email from public.invitations where id = (tests.v('r') ->> 'invitation_id')::uuid),
  'org_admin:responsable@console.test', 'invitation du responsable (administrateur)');
select ok(exists (select 1 from public.trial_email_claims where email_hash = public.email_fingerprint('responsable@console.test')),
  'adresse du responsable réservée : pas de second essai en libre-service');
select is((select diff ->> 'reason' from public.audit_log where action = 'org.create_by_platform'
  and organization_id = (tests.v('r') ->> 'organization_id')::uuid), 'Contrat signé le 10 novembre', 'motif journalisé');

-- ─── Le responsable accepte : administrateur de l'établissement ─────────────
select tests.login_as('6c000000-0000-0000-0000-0000000000a2');
select is(public.accept_invitation(tests.v('r') ->> 'token'), (tests.v('r') ->> 'organization_id')::uuid, 'invitation acceptée');
select is((select role::text from public.memberships where user_id = '6c000000-0000-0000-0000-0000000000a2'), 'org_admin', 'responsable administrateur');
select is((select count(*)::integer from public.services where organization_id = (tests.v('r') ->> 'organization_id')::uuid), 3,
  'le responsable voit ses services');
select tests.logout();

-- ─── Même nom : adresse d'URL distincte ; limites de la formule appliquées ────
select tests.login_as('6c000000-0000-0000-0000-0000000000a1');
insert into vals select 'r2', public.admin_create_organization(tests.fields('{"owner_email":"autre@console.test","services":[]}'));
select ok((tests.v('r2') ->> 'slug') ~ '^pgtap-console-[0-9a-f]{4}$', 'identifiant déjà pris : suffixe aléatoire');
select tests.logout();
-- Pendant l'essai, droits de la formule d'essai (Business, règle existante d'org_entitlements).
update public.plans set max_services = 2 where trial_eligible;
select tests.login_as('6c000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.admin_create_organization(tests.fields('{"owner_email":"trois@console.test"}')) $$,
  'P0403', 'plan_limit', 'services au-delà de la formule : refusé (rien n''est créé)');
select tests.logout();

select * from finish();
rollback;
