-- pgTAP — M2 : agences, services, guichets, praticiens, QR codes (isolation, rôles, cohérence).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(43);

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, false, now(),
          jsonb_build_object('full_name', split_part(p_email, '@', 1)))
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

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, anon;

select tests.create_user('a2000000-0000-0000-0000-00000000000a', 'admin@m2-clinic.test');
select tests.create_user('b2000000-0000-0000-0000-00000000000b', 'admin@m2-eneo.test');
select tests.create_user('c2000000-0000-0000-0000-00000000000c', 'manager@m2-clinic.test');
select tests.create_user('d2000000-0000-0000-0000-00000000000d', 'agent@m2-clinic.test');
select tests.create_user('e2000000-0000-0000-0000-00000000000e', 'anon@m2.test');

-- ─── Mise en place ───────────────────────────────────────────────────────────
select tests.login_as('a2000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M2 Clinic', 'pgtap-m2-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa', 'Rue Joss', 'Douala', '+237677000001', 4.05, 9.70);
insert into ids select 'bonapriso', public.create_branch((select id from ids where name = 'clinic'), 'Bonapriso');

select tests.login_as('b2000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M2 Eneo', 'pgtap-m2-eneo', 'utility');
insert into ids select 'bonanjo', public.create_branch((select id from ids where name = 'eneo'), 'Bonanjo');

-- ─── create_branch ───────────────────────────────────────────────────────────
select tests.login_as('a2000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.branch_settings where branch_id = (select id from ids where name = 'akwa')), 1,
  'une agence reçoit ses réglages');
select is((select remote_tickets_enabled from public.branch_settings where branch_id = (select id from ids where name = 'akwa')), false,
  'le ticket à distance est désactivé par défaut');
select is((select count(*)::int from public.opening_hours where branch_id = (select id from ids where name = 'akwa')), 6,
  'horaires par défaut du lundi au samedi');
select is((select count(*)::int from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active), 1,
  'une agence reçoit un QR code actif');
select matches((select short_code from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active),
  '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$', 'code court de 6 caractères sans 0/O/1/I');
select ok((select abs(latitude - 4.05) < 0.0001 and abs(longitude - 9.70) < 0.0001 from public.branches where id = (select id from ids where name = 'akwa')),
  'la position GPS est enregistrée');
select throws_ok($$ select public.create_branch((select id from ids where name = 'eneo'), 'Pirate') $$,
  '42501', null, 'impossible de créer une agence dans un autre établissement');
select throws_ok($$ insert into public.branches (organization_id, name) values ((select id from ids where name = 'clinic'), 'Direct') $$,
  '42501', null, 'création directe d''agence interdite (RPC uniquement)');

-- ─── Spécialités, praticiens, services, guichets ─────────────────────────────
insert into public.specialties (organization_id, name) values ((select id from ids where name = 'clinic'), 'Pédiatrie');
insert into ids select 'pediatrics', id from public.specialties where name = 'Pédiatrie' and organization_id = (select id from ids where name = 'clinic');
select throws_ok($$ insert into public.specialties (organization_id, name) values ((select id from ids where name = 'clinic'), 'pédiatrie') $$,
  '23505', null, 'nom de spécialité unique (insensible à la casse)');

insert into public.practitioners (organization_id, branch_id, title, display_name, specialty_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Dr', 'Mbarga', (select id from ids where name = 'pediatrics'));
insert into ids select 'mbarga', id from public.practitioners where display_name = 'Mbarga';

insert into public.services (organization_id, branch_id, name, prefix, color, default_service_seconds, specialty_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', '#1A6BB5', 600, null),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Pédiatrie', 'P', '#2E8B57', 720, (select id from ids where name = 'pediatrics'));
insert into ids select 'consult', id from public.services where prefix = 'C' and branch_id = (select id from ids where name = 'akwa');
insert into ids select 'peds', id from public.services where prefix = 'P' and branch_id = (select id from ids where name = 'akwa');

select throws_ok($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Caisse', 'C', 300) $$,
  '23505', null, 'préfixe unique par agence');
select throws_ok($$ insert into public.services (organization_id, branch_id, name, prefix)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Labo', 'L') $$,
  '23502', null, 'la durée de service par défaut est obligatoire');
select throws_ok($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Labo', 'l1', 300) $$,
  '23514', null, 'préfixe : 1 ou 2 lettres majuscules');
select lives_ok($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'bonapriso'), 'Consultation', 'C', 600) $$,
  'le même préfixe est permis dans une autre agence');

insert into public.counters (organization_id, branch_id, kind, number, default_practitioner_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1, (select id from ids where name = 'mbarga'));
insert into ids select 'cab1', id from public.counters where branch_id = (select id from ids where name = 'akwa') and number = 1;
select lives_ok($$ insert into public.counter_services (organization_id, counter_id, service_id)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'cab1'), (select id from ids where name = 'consult')) $$,
  'un cabinet sert un service de son agence');
select throws_ok($$ insert into public.counter_services (organization_id, counter_id, service_id)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'cab1'),
          (select id from public.services where branch_id = (select id from ids where name = 'bonapriso') limit 1)) $$,
  '23514', null, 'un cabinet ne sert pas un service d''une autre agence');
select throws_ok($$ insert into public.counters (organization_id, branch_id, kind, number)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1) $$,
  '23505', null, 'numéro de cabinet unique par agence');

-- ─── Cohérence multi-tenant (clés composites) ────────────────────────────────
select tests.logout();
select throws_ok($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  values ((select id from ids where name = 'eneo'), (select id from ids where name = 'akwa'), 'Fraude', 'F', 300) $$,
  '23503', null, 'même avec tous les droits, un service ne peut pas lier l''agence d''un autre établissement');
select throws_ok($$ insert into public.practitioners (organization_id, branch_id, display_name, specialty_id)
  values ((select id from ids where name = 'eneo'), (select id from ids where name = 'bonanjo'), 'Dr X', (select id from ids where name = 'pediatrics')) $$,
  '23503', null, 'un praticien ne peut pas recevoir la spécialité d''un autre établissement');
select throws_ok($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  values ((select id from ids where name = 'eneo'), 'd2000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa')) $$,
  '23503', null, 'une affectation ne peut pas viser l''agence d''un autre établissement');

-- Personnel de la clinique : responsable d'Akwa et agent d'Akwa.
insert into public.memberships (organization_id, user_id, role, branch_id) values
  ((select id from ids where name = 'clinic'), 'c2000000-0000-0000-0000-00000000000c', 'branch_manager', (select id from ids where name = 'akwa')),
  ((select id from ids where name = 'clinic'), 'd2000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa'));

-- ─── Isolation ───────────────────────────────────────────────────────────────
select tests.login_as('b2000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.branches where organization_id = (select id from ids where name = 'clinic')), 0,
  'Eneo ne voit aucune agence de la clinique');
select is((select count(*)::int from public.services where organization_id = (select id from ids where name = 'clinic')), 0,
  'Eneo ne voit aucun service de la clinique');
select is((select count(*)::int from public.qr_codes where organization_id = (select id from ids where name = 'clinic')), 0,
  'Eneo ne voit aucun QR code de la clinique');
select is((select count(*)::int from public.practitioners), 0, 'Eneo ne voit aucun praticien de la clinique');
update public.services set name = 'Piraté' where organization_id = (select id from ids where name = 'clinic');
select throws_ok($$ select public.regenerate_qr_code((select id from ids where name = 'akwa')) $$,
  '42501', null, 'Eneo ne peut pas régénérer le QR de la clinique');
select is((select count(*)::int from public.list_org_members((select id from ids where name = 'clinic'))), 0,
  'Eneo ne voit pas le personnel de la clinique');

select tests.login_as('e2000000-0000-0000-0000-00000000000e', true);
select is((select count(*)::int from public.branches), 0, 'une session anonyme ne voit aucune agence');

select tests.logout();
select is((select name from public.services where id = (select id from ids where name = 'consult')), 'Consultation',
  'la modification par un autre établissement est sans effet');

-- ─── Rôles dans l'établissement ──────────────────────────────────────────────
select tests.login_as('c2000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.branches), 1, 'le responsable ne voit que son agence');
select lives_ok($$ update public.services set default_service_seconds = 540 where id = (select id from ids where name = 'consult') $$,
  'le responsable modifie un service de son agence');
select is((select default_service_seconds from public.services where id = (select id from ids where name = 'consult')), 540,
  'modification prise en compte');
select throws_ok($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'bonapriso'), 'Caisse', 'K', 300) $$,
  '42501', null, 'le responsable ne peut rien créer dans une autre agence');
select throws_ok($$ select public.create_branch((select id from ids where name = 'clinic'), 'Nouvelle') $$,
  '42501', null, 'le responsable ne crée pas d''agence');
select throws_ok($$ insert into public.specialties (organization_id, name) values ((select id from ids where name = 'clinic'), 'Cardiologie') $$,
  '42501', null, 'seul l''org_admin gère les spécialités');
select is((select count(*)::int from public.list_org_members((select id from ids where name = 'clinic'))), 2,
  'le responsable voit le personnel de son agence (lui-même et l''agent)');

select tests.login_as('d2000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.services), 2, 'l''agent lit les services de son agence');
update public.services set name = 'Modifié par l''agent';
select tests.logout();
select is((select count(*)::int from public.services where name = 'Modifié par l''agent'), 0, 'l''agent ne modifie pas les services');
select tests.login_as('d2000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.list_org_members((select id from ids where name = 'clinic'))), 0,
  'un agent ne liste pas le personnel');

-- ─── QR codes ────────────────────────────────────────────────────────────────
select tests.login_as('a2000000-0000-0000-0000-00000000000a');
insert into ids select 'old_qr', id from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active;
select lives_ok($$ select public.regenerate_qr_code((select id from ids where name = 'akwa')) $$, 'l''org_admin régénère le QR code');
select ok((select not active and revoked_at is not null from public.qr_codes where id = (select id from ids where name = 'old_qr')),
  'l''ancien QR code est révoqué');
select lives_ok($$ select public.regenerate_qr_code((select id from ids where name = 'akwa'), (select id from ids where name = 'peds')) $$,
  'QR code propre à un service');
select is((select count(*)::int from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active), 2,
  'un QR actif pour l''agence et un pour le service');
select ok(exists (select 1 from public.audit_log where action = 'qr.regenerate' and organization_id = (select id from ids where name = 'clinic')),
  'la régénération est journalisée');
select ok(exists (select 1 from public.audit_log where action = 'service.update' and organization_id = (select id from ids where name = 'clinic')),
  'la modification de service est journalisée');

select * from finish();
rollback;
