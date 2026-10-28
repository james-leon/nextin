-- pgTAP — M1 : isolation multi-tenant, rôles, invitations, audit, rate limiting, purge des anonymes.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
-- M10a : `create_organization` réservé à l'inscription ; appel direct permis dans ce test (annulé au rollback).
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(50);

-- ─── Aides de test ───────────────────────────────────────────────────────────
create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anonymous boolean default false, p_last_sign_in timestamptz default now())
returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, last_sign_in_at, created_at, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_anonymous,
          p_last_sign_in, p_last_sign_in, jsonb_build_object('full_name', split_part(coalesce(p_email, 'anon'), '@', 1)))
  returning id;
$$;
create function tests.login_as(p_id uuid, p_anonymous boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'admin@douala-clinic.test');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 'admin@eneo.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'manager@douala-clinic.test');
select tests.create_user('d0000000-0000-0000-0000-00000000000d', 'agent@douala-clinic.test');
select tests.create_user('e0000000-0000-0000-0000-00000000000e', null, true);
select tests.create_user('f0000000-0000-0000-0000-00000000000f', null, true, now() - interval '30 days');
select tests.create_user('99999999-0000-0000-0000-000000000099', 'root@wintek.test');
insert into public.platform_admins (user_id) values ('99999999-0000-0000-0000-000000000099');

-- ─── Socle ───────────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS est activée sur toutes les tables publiques');

select ok(exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'),
  'un profil est créé pour un compte du personnel');
select ok(not exists (select 1 from public.profiles where id = 'e0000000-0000-0000-0000-00000000000e'),
  'aucun profil pour une session anonyme');

-- ─── Création d'établissements ───────────────────────────────────────────────
select tests.login_as('e0000000-0000-0000-0000-00000000000e', true);
select throws_ok($$ select public.create_organization('Spam SARL', 'spam-sarl', 'other') $$,
  '42501', null, 'une session anonyme ne peut pas créer d''établissement');

select tests.login_as('a0000000-0000-0000-0000-00000000000a');
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids select 'clinic', public.create_organization('Douala Clinic', 'pgtap-douala-clinic', 'clinic');
insert into ids select 'branch1', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into ids select 'branch2', public.create_branch((select id from ids where name = 'clinic'), 'Bonapriso');
select is((select status::text from public.organizations where id = (select id from ids where name = 'clinic')),
  'active', 'un nouvel établissement est actif immédiatement (aucune validation manuelle)');
select is((select role::text from public.memberships where organization_id = (select id from ids where name = 'clinic')
  and user_id = 'a0000000-0000-0000-0000-00000000000a'), 'org_admin', 'le créateur devient org_admin');

select tests.login_as('b0000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('Eneo Cameroon', 'pgtap-eneo-cameroon', 'utility');

-- ─── Isolation ───────────────────────────────────────────────────────────────
select is((select count(*)::int from public.organizations), 1, 'Eneo ne voit que son établissement');
select is((select count(*)::int from public.memberships), 1, 'Eneo ne voit que ses membres');
select is((select count(*)::int from public.organizations where slug = 'pgtap-douala-clinic'), 0,
  'Eneo ne voit pas Douala Clinic');

update public.organizations set name = 'Piratage' where slug = 'pgtap-douala-clinic';
select tests.logout();
select is((select name from public.organizations where slug = 'pgtap-douala-clinic'), 'Douala Clinic',
  'Eneo ne peut pas modifier Douala Clinic');

select tests.login_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.organizations set status = 'suspended' where slug = 'pgtap-eneo-cameroon' or slug = 'pgtap-douala-clinic' $$,
  '42501', null, 'un org_admin ne peut pas changer le statut de son établissement');
select lives_ok($$ update public.organizations set name = 'DOUALA CLINIC', data_retention_days = 60 where slug = 'pgtap-douala-clinic' $$,
  'un org_admin modifie les informations de son établissement');
select throws_ok($$ update public.organizations set data_retention_days = 2 where slug = 'pgtap-douala-clinic' $$,
  '23514', null, 'la durée de conservation est bornée (7 à 365 jours)');
select throws_ok($$ insert into public.organizations (name, slug, type) values ('X', 'xxx', 'other') $$,
  '42501', null, 'insertion directe interdite (passer par create_organization)');

-- ─── Super admin ─────────────────────────────────────────────────────────────
select tests.login_as('99999999-0000-0000-0000-000000000099');
select is((select count(*)::int from public.organizations where slug like 'pgtap-%'), 2,
  'le super admin voit les établissements des deux organisations');
select lives_ok($$ update public.organizations set status = 'suspended', suspended_reason = 'test'
  where slug = 'pgtap-douala-clinic' $$, 'le super admin suspend un établissement');
select lives_ok($$ update public.organizations set status = 'active', suspended_reason = null
  where slug = 'pgtap-douala-clinic' $$, 'le super admin réactive un établissement');

-- ─── Personnel et rôles ──────────────────────────────────────────────────────
select tests.login_as('a0000000-0000-0000-0000-00000000000a');
insert into public.memberships (organization_id, user_id, role, branch_id)
values ((select id from ids where name = 'clinic'), 'c0000000-0000-0000-0000-00000000000c', 'branch_manager',
        (select id from ids where name = 'branch1'));
select is((select count(*)::int from public.memberships), 2, 'l''org_admin ajoute un responsable d''agence');

select throws_ok($$ insert into public.memberships (organization_id, user_id, role)
  values ((select id from ids where name = 'eneo'), 'a0000000-0000-0000-0000-00000000000a', 'org_admin') $$,
  '42501', null, 'impossible de s''ajouter dans un autre établissement');

select tests.login_as('c0000000-0000-0000-0000-00000000000c');
select lives_ok($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  values ((select id from ids where name = 'clinic'), 'd0000000-0000-0000-0000-00000000000d', 'agent',
          (select id from ids where name = 'branch1')) $$,
  'le responsable ajoute un agent dans son agence');
select throws_ok($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  values ((select id from ids where name = 'clinic'), 'd0000000-0000-0000-0000-00000000000d', 'receptionist',
          (select id from ids where name = 'branch2')) $$,
  '42501', null, 'le responsable ne peut pas recruter dans une autre agence');
select throws_ok($$ insert into public.memberships (organization_id, user_id, role)
  values ((select id from ids where name = 'clinic'), 'd0000000-0000-0000-0000-00000000000d', 'org_admin') $$,
  '42501', null, 'le responsable ne peut pas attribuer org_admin');
update public.memberships set branch_id = null, role = 'org_admin'
  where user_id = 'c0000000-0000-0000-0000-00000000000c';
select is((select role::text from public.memberships where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  'branch_manager', 'le responsable ne peut pas s''auto-promouvoir');

select tests.login_as('d0000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.memberships), 3, 'un agent voit ses collègues');
select is((select count(*)::int from public.profiles), 3, 'un agent voit les profils de ses collègues uniquement');
select is((select count(*)::int from public.audit_log), 0, 'un agent ne lit pas le journal d''audit');
select is((select count(*)::int from public.invitations), 0, 'un agent ne voit pas les invitations');

select tests.login_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$ delete from public.memberships where user_id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'P0001', null, 'impossible de retirer le dernier org_admin');

-- ─── Invitations ─────────────────────────────────────────────────────────────
create temp table tokens (name text primary key, token text) on commit drop;
grant all on tokens to authenticated, anon;
insert into tokens values
  ('email', public.create_invitation((select id from ids where name = 'clinic'), 'receptionist',
     (select id from ids where name = 'branch1'), 'ADMIN@eneo.test')),
  ('expired', public.create_invitation((select id from ids where name = 'clinic'), 'agent',
     (select id from ids where name = 'branch1'), 'admin@eneo.test'));
select tests.logout();
update public.invitations set expires_at = now() - interval '1 minute' where role = 'agent';
select is((select count(*)::int from public.invitations
  where organization_id = (select id from ids where name = 'clinic') and token_hash ~ '^[0-9a-f]{64}$'), 2,
  'seule l''empreinte SHA-256 du jeton est stockée');

select tests.login_as('d0000000-0000-0000-0000-00000000000d');
select throws_ok(format('select public.accept_invitation(%L)', (select token from tokens where name = 'email')),
  '42501', null, 'une invitation nominative ne peut être acceptée par une autre adresse');

select tests.logout();
set local role anon;
select is((select state from public.get_invitation((select token from tokens where name = 'email'))), 'valid',
  'un visiteur non connecté voit l''état d''une invitation');
select is((select organization_name from public.get_invitation((select token from tokens where name = 'email'))), 'DOUALA CLINIC',
  'l''aperçu donne le nom de l''établissement');
select is((select email_hint from public.get_invitation((select token from tokens where name = 'email'))), 'a•••@eneo.test',
  'l''adresse invitée est masquée');
select is((select state from public.get_invitation((select token from tokens where name = 'expired'))), 'expired',
  'une invitation expirée est signalée');
select is((select count(*)::int from public.get_invitation('jeton-inconnu')), 0, 'un jeton inconnu ne renvoie rien');
select tests.logout();
select tests.login_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.accept_invitation(%L)', (select token from tokens where name = 'expired')),
  'P0002', null, 'une invitation expirée est refusée');
select is(public.accept_invitation((select token from tokens where name = 'email')),
  (select id from ids where name = 'clinic'), 'l''invité rejoint l''établissement');
select throws_ok(format('select public.accept_invitation(%L)', (select token from tokens where name = 'email')),
  'P0002', null, 'une invitation ne sert qu''une fois');
select is((select count(*)::int from public.organizations), 2, 'l''invité voit désormais ses deux établissements');

-- ─── Audit ───────────────────────────────────────────────────────────────────
select tests.login_as('a0000000-0000-0000-0000-00000000000a');
select ok((select count(*) from public.audit_log where action = 'org.create') = 1,
  'la création est journalisée (seulement celle de son établissement)');
select ok(exists (select 1 from public.audit_log where action = 'member.add'
  and diff ->> 'role' = 'agent'), 'les ajouts de membres sont journalisés');
select ok(exists (select 1 from public.audit_log where action = 'org.status_change'),
  'la suspension par le super admin est journalisée');
select throws_ok($$ update public.audit_log set action = 'org.tampered' $$,
  '42501', null, 'le journal d''audit n''est pas modifiable depuis l''API');
select throws_ok($$ delete from public.audit_log $$,
  '42501', null, 'le journal d''audit ne peut pas être effacé depuis l''API');
select tests.logout();

-- ─── Rate limiting ───────────────────────────────────────────────────────────
select tests.login_as('e0000000-0000-0000-0000-00000000000e', true);
select throws_ok($$ select public.check_rate_limit('x', 1, interval '1 minute') $$,
  '42501', null, 'check_rate_limit n''est pas appelable depuis l''API');
select tests.logout();
select ok(public.check_rate_limit('test:k', 2, interval '1 hour') and public.check_rate_limit('test:k', 2, interval '1 hour'),
  'les deux premiers appels passent');
select ok(not public.check_rate_limit('test:k', 2, interval '1 hour'), 'le troisième est bloqué');

-- ─── Purge des anonymes ──────────────────────────────────────────────────────
select is(public.purge_inactive_anonymous_users(), 1, 'un seul anonyme inactif est supprimé');
select ok(exists (select 1 from auth.users where id = 'e0000000-0000-0000-0000-00000000000e')
  and not exists (select 1 from auth.users where id = 'f0000000-0000-0000-0000-00000000000f'),
  'l''anonyme récent est conservé, l''ancien supprimé');
select ok(exists (select 1 from cron.job where jobname = 'nextin-purge-anonymous-users'),
  'la purge est planifiée chaque jour');

select * from finish();
rollback;
