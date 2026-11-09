-- pgTAP — Demandes de rendez-vous en ligne vérifiées par e-mail : canal par défaut, adresse exigée, téléphone facultatif,
-- code par e-mail, adresse masquée côté patient et en clair pour l'accueil, doublons et limites par adresse, réponse et
-- rappels par e-mail, notification du navigateur, déplacement, purge, réglage de la console.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(40);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.as_role(p_role text, p_sub uuid default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_sub, 'is_anonymous', false)::text, true);
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
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
create function tests.token(p_name text) returns text language sql as $$ select v ->> 'public_token' from vals where name = p_name $$;
create function tests.req(p_name text) returns uuid language sql security definer as $$
  select id from public.appointment_requests where public_token = tests.token(p_name)
$$;
create function tests.code(p_name text) returns text language sql security definer as $$
  select j.payload ->> 'code' from public.notification_jobs j
  where j.appointment_request_id = tests.req(p_name) and j.event = 'request_code' and j.status <> 'cancelled'
  order by j.created_at desc limit 1
$$;
create function tests.channels(p_request uuid, p_event text) returns text language sql security definer as $$
  select string_agg(distinct j.channel::text, ',' order by j.channel::text) from public.notification_jobs j
  where (j.appointment_request_id = p_request or j.appointment_id = (select appointment_id from public.appointment_requests where id = p_request))
    and j.event::text = p_event and j.status <> 'cancelled'
$$;
create function tests.slot(p_days int, p_time time) returns timestamptz language sql as $$
  select ((((now() at time zone 'Africa/Douala')::date + p_days) + p_time) at time zone 'Africa/Douala')
$$;
create function tests.reset_limits() returns void language sql security definer as $$ delete from public.rate_limits $$;
create function tests.create(p_name text, p_email text, p_phone text, p_starts_at timestamptz, p_customer text default 'c1',
  p_channel text default null)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform tests.as_role('service_role');
  v := public.create_appointment_request(tests.id('branch'), tests.id('service'), null, p_starts_at, null, null, p_phone, null, 'fr',
    tests.id(p_customer), null, null, p_email, p_channel);
  insert into vals values (p_name, v) on conflict (name) do update set v = excluded.v;
  perform tests.logout();
  return v;
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at) values
  ('ee000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@rdv-email.test', false, now()),
  ('ee000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wintek@rdv-email.test', false, now()),
  ('ee000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now()),
  ('ee000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now());
insert into ids values ('admin', 'ee000000-0000-0000-0000-00000000000a'), ('wintek', 'ee000000-0000-0000-0000-00000000000f'),
  ('c1', 'ee000000-0000-0000-0000-0000000000c1'), ('c2', 'ee000000-0000-0000-0000-0000000000c2');
insert into public.platform_admins (user_id) values (tests.id('wintek'));
select tests.as_role('authenticated', tests.id('admin'));
insert into ids select 'org', public.create_organization('Clinique E-mail', 'pgtap-rdv-email', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Akwa');
select tests.logout();
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('org'), tests.id('branch'), 'Consultation', 'C', 600);
insert into ids select 'service', id from public.services where branch_id = tests.id('branch');
insert into public.practitioners (organization_id, branch_id, title, display_name) values (tests.id('org'), tests.id('branch'), 'Dr', 'Ewane');
insert into ids select 'doctor', id from public.practitioners where branch_id = tests.id('branch');
insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
select tests.id('org'), tests.id('branch'), tests.id('doctor'), tests.id('service'), d, '08:00', '18:00', 30 from generate_series(1, 7) d;
update public.branch_settings set appointment_requests_enabled = true, appointment_request_max_pending = 5 where branch_id = tests.id('branch');

-- ─── Canal par défaut ────────────────────────────────────────────────────────
-- Limites d'appels partagées avec les autres données de la base locale : remises à zéro (annulé au rollback).
select tests.reset_limits();
select is((select request_channels from public.platform_settings), '{email}'::text[], 'canal par défaut des demandes : e-mail');
select tests.as_role('anon');
select is(public.request_options(tests.id('branch')) -> 'channels', '["email"]'::jsonb, 'formulaire : canaux proposés');
select tests.logout();

-- ─── Adresse exigée, téléphone facultatif ───────────────────────────────────
select throws_ok($$ select tests.create('X', null, '+237677001001', tests.slot(2, '09:00')) $$, 'P0422', 'email_invalid',
  'e-mail : adresse exigée');
select throws_ok($$ select tests.create('X', 'pas-une-adresse', null, tests.slot(2, '09:00')) $$, 'P0422', 'email_invalid',
  'adresse invalide refusée');
select throws_ok($$ select tests.create('X', 'awa@exemple.cm', '12345', tests.slot(2, '09:00')) $$, 'P0422', 'phone_invalid',
  'téléphone facultatif, mais vérifié s''il est donné');
select throws_ok($$ select tests.create('X', null, '+237677001001', tests.slot(2, '09:00'), 'c1', 'whatsapp') $$, 'P0422', 'channel_unavailable',
  'WhatsApp désactivé dans la console : refusé');

select is(tests.create('A', '  Awa.Ngo@Exemple.cm ', '+237677001001', tests.slot(2, '09:00')) ->> 'channel', 'email',
  'demande par e-mail créée');
select is((select (email, verify_channel, phone_e164)::text from public.appointment_requests where id = tests.req('A')),
  '(awa.ngo@exemple.cm,email,+237677001001)', 'adresse normalisée (minuscules), numéro gardé pour l''accueil');
select is((select string_agg(channel || ':' || coalesce(email, '-') || ':' || coalesce(phone_e164, '-'), ',')
  from public.notification_contacts where appointment_request_id = tests.req('A')),
  'email:awa.ngo@exemple.cm:-', 'un seul contact : l''adresse e-mail (le numéro ne reçoit aucun message)');
select is(tests.channels(tests.req('A'), 'request_code'), 'email', 'code envoyé par e-mail');
select ok(tests.code('A') ~ '^[0-9]{6}$', 'code à 6 chiffres dans la file d''envoi (le temps de sa validité)');
select ok((select code_hash ~ '^[0-9a-f]{64}$' and code_hash <> tests.code('A') from public.appointment_requests where id = tests.req('A')),
  'en base : empreinte du code seulement');

-- ─── Vue du patient : adresse masquée ────────────────────────────────────────
select tests.as_role('anon');
insert into vals select 'viewA', public.get_appointment_request(tests.token('A'));
select tests.logout();
select is(tests.v('viewA') ->> 'email_masked', 'a•••@exemple.cm', 'page de la demande : adresse masquée');
select is(tests.v('viewA') ->> 'verify_channel', 'email', 'page de la demande : canal du code');
select ok(not (tests.v('viewA')::text ilike '%awa.ngo%'), 'page de la demande : jamais l''adresse complète');

-- ─── Vérification ────────────────────────────────────────────────────────────
select tests.as_role('anon');
select is(public.verify_appointment_request(tests.token('A'), '000000') ->> 'error', 'code_invalid', 'mauvais code refusé');
select is(public.verify_appointment_request(tests.token('A'), tests.code('A')) ->> 'status', 'pending', 'bon code : demande en attente');
select tests.logout();
select is(tests.code('A'), null, 'code effacé de la file après vérification');

-- ─── Doublons et limites par adresse ─────────────────────────────────────────
select throws_ok($$ select tests.create('A2', 'AWA.NGO@exemple.cm', null, tests.slot(2, '09:00'), 'c2') $$, 'P0409', 'request_duplicate',
  'même adresse (casse différente), même créneau : doublon refusé');
select tests.reset_limits();
select lives_ok($$ select tests.create('L' || i, 'limite@exemple.cm', null, tests.slot(3, ('08:00'::time + make_interval(mins => 30 * i))), 'c1')
  from generate_series(1, 4) i $$, 'quatre demandes de la même adresse');
select lives_ok($$ select tests.create('L5', 'limite@exemple.cm', null, tests.slot(3, '11:00'), 'c2') $$, 'cinquième, depuis un autre appareil');
select throws_ok($$ select tests.create('L6', 'limite@exemple.cm', null, tests.slot(3, '11:30'), 'c2') $$, 'P0429', 'rate_limited',
  'limite par adresse : 5 demandes par jour, quel que soit l''appareil');
select tests.reset_limits();

-- ─── Accueil : adresse en clair ; réponse et rappels par e-mail ─────────────
select tests.as_role('authenticated', tests.id('admin'));
select is((select r ->> 'email' from jsonb_array_elements(public.list_appointment_requests(tests.id('branch'))) r
  where r ->> 'id' = tests.req('A')::text), 'awa.ngo@exemple.cm', 'accueil : adresse en clair');
select tests.logout();

-- Notification du navigateur autorisée par le patient (en plus de l'e-mail).
select tests.as_role('service_role');
select is(public.register_request_push_contact(tests.token('A'),
  '{"endpoint": "https://push.example/abc", "keys": {"p256dh": "p256dh-key-0123456789", "auth": "auth-key-01"}}', 'fr') ->> 'status',
  'subscribed', 'notification du navigateur enregistrée pour la demande');
select tests.logout();

select tests.as_role('authenticated', tests.id('admin'));
insert into vals select 'acceptA', public.accept_appointment_request(tests.req('A'), tests.id('doctor'), tests.slot(2, '09:00'));
select tests.logout();
select is(tests.v('acceptA') -> 'appointment' ->> 'email', 'awa.ngo@exemple.cm', 'rendez-vous créé avec l''adresse (personnel)');
select is(tests.channels(tests.req('A'), 'request_accepted'), 'email,push', 'réponse de l''accueil : e-mail et notification');
select is(tests.channels(tests.req('A'), 'appointment_reminder_2h'), 'email,push', 'rappel 2 h avant : e-mail et notification');
select is(tests.channels(tests.req('A'), 'appointment_reminder_day_before'), 'email,push', 'rappel la veille : e-mail et notification');
select ok(not exists (select 1 from public.notification_contacts where appointment_id = (tests.v('acceptA') -> 'appointment' ->> 'id')::uuid
  and channel = 'whatsapp'), 'aucun contact WhatsApp pour le numéro donné à l''accueil');
select is(public.appointment_notification_view((tests.v('acceptA') -> 'appointment' ->> 'id')::uuid) ->> 'request_token', tests.token('A'),
  'messages du rendez-vous : lien vers la page de la demande');
select is((select count(*)::integer from jsonb_array_elements(public.claim_notification_jobs(100)) j
  where j -> 'contact' ->> 'email' = 'awa.ngo@exemple.cm'), 2, 'expéditeur : adresse transmise pour les e-mails dus');

-- Déplacement : l'adresse et les rappels suivent ; la demande pointe vers le nouveau rendez-vous.
select tests.as_role('authenticated', tests.id('admin'));
insert into vals select 'moved', public.reschedule_appointment((tests.v('acceptA') -> 'appointment' ->> 'id')::uuid, tests.slot(2, '15:00'));
select tests.logout();
select is(tests.v('moved') ->> 'email', 'awa.ngo@exemple.cm', 'rendez-vous déplacé : adresse reprise');
select is((select appointment_id from public.appointment_requests where id = tests.req('A')), (tests.v('moved') ->> 'id')::uuid,
  'la demande suit le nouveau rendez-vous');
select is(tests.channels(tests.req('A'), 'appointment_rescheduled'), 'email,push', 'déplacement annoncé par e-mail et notification');
select ok(not exists (select 1 from public.notification_contacts where appointment_id = (tests.v('moved') ->> 'id')::uuid and channel = 'whatsapp'),
  'déplacement : toujours aucun contact WhatsApp sans accord');

-- Refus d'une autre demande : motif envoyé par e-mail.
select tests.create('B', 'bilong@exemple.cm', null, tests.slot(4, '10:00'));
select tests.as_role('anon');
select public.verify_appointment_request(tests.token('B'), tests.code('B'));
select tests.as_role('authenticated', tests.id('admin'));
select public.decline_appointment_request(tests.req('B'), 'Praticien en congé');
select tests.logout();
select is(tests.channels(tests.req('B'), 'request_declined'), 'email', 'refus envoyé par e-mail');

-- ─── Purge après la durée de conservation ───────────────────────────────────
update public.appointment_requests set created_at = now() - interval '40 days' where id = tests.req('B');
select public.purge_personal_data();
select is((select email from public.appointment_requests where id = tests.req('B')), null, 'purge : adresse de la demande effacée');
select ok(not exists (select 1 from public.notification_contacts where appointment_request_id = tests.req('B')), 'purge : contact e-mail supprimé');

-- ─── Console Wintek : canaux proposés ────────────────────────────────────────
select tests.as_role('authenticated', tests.id('admin'));
select throws_ok($$ select public.admin_update_settings('{"request_channels": ["whatsapp"]}') $$, '42501', null,
  'canaux : réservés à la console Wintek');
select tests.as_role('authenticated', tests.id('wintek'));
select public.admin_update_settings('{"request_channels": ["whatsapp", "email"]}');
select tests.logout();
select is((select request_channels from public.platform_settings), '{whatsapp,email}'::text[], 'console : canaux dans l''ordre choisi');

select * from finish();
rollback;
