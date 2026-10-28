-- pgTAP — M9 : établissements à proximité, ticket à distance (trajet, présence, recul puis annulation, messages),
-- demandes de rendez-vous (vérification du numéro, confirmation, modification, refus, expiration), droits, purge.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(63);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anon boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_anon, now())
  returning id;
$$;
create function tests.login_as(p_id uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
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
grant usage on schema tests to anon, authenticated, service_role;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to anon, authenticated, service_role;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
create function tests.ticket(p_name text) returns uuid language sql as $$
  select coalesce((v ->> 'ticket_id')::uuid, (v ->> 'id')::uuid) from vals where name = p_name
$$;
create function tests.token(p_name text) returns text language sql security definer as $$
  select public_token from public.tickets where id = tests.ticket(p_name)
$$;
create function tests.jobs(p_ticket uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(event::text order by created_at, event), '{}')
  from public.notification_jobs where ticket_id = p_ticket and status <> 'skipped';
$$;
create function tests.request(p_name text) returns uuid language sql security definer as $$
  select id from public.appointment_requests where public_token = (select v ->> 'public_token' from vals where name = p_name)
$$;
create function tests.request_token(p_name text) returns text language sql as $$ select v ->> 'public_token' from vals where name = p_name $$;
create function tests.request_code(p_request uuid) returns text language sql security definer as $$
  select payload ->> 'code' from public.notification_jobs
  where appointment_request_id = p_request and event = 'request_code' and status <> 'cancelled' order by created_at desc limit 1
$$;
create function tests.qr(p_col text) returns text language sql security definer as $$
  select case p_col when 'token' then token else short_code end from public.qr_codes
  where branch_id = (select id from ids where name = 'akwa') limit 1
$$;
create function tests.has_job(p_subject uuid, p_event text) returns boolean language sql security definer as $$
  select exists (select 1 from public.notification_jobs
    where p_subject in (ticket_id, appointment_id, appointment_request_id) and event::text = p_event)
$$;
create function tests.state(p_ticket uuid) returns text language sql security definer as $$
  select (delay_count, public.ticket_position(id))::text from public.tickets where id = p_ticket
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ─── Données : clinique à Akwa (Douala), agence masquée, agence lointaine (Yaoundé), autre établissement ───
select tests.create_user('a9000000-0000-0000-0000-00000000000a', 'admin@m9-clinic.test');
select tests.create_user('b9000000-0000-0000-0000-00000000000b', 'admin@m9-eneo.test');
select tests.create_user('c9000000-0000-0000-0000-00000000000c', 'client1@m9.test', true);
select tests.create_user('c9000000-0000-0000-0000-00000000000d', 'client2@m9.test', true);
select tests.create_user('c9000000-0000-0000-0000-00000000000e', 'client3@m9.test', true);
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M9 Clinic Zeta', 'pgtap-m9-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch(tests.id('clinic'), 'Akwa', 'Rue Joss', 'Douala', null, 4.0500, 9.7000);
insert into ids select 'hidden', public.create_branch(tests.id('clinic'), 'Bonapriso', null, 'Douala', null, 4.0300, 9.6900);
insert into ids select 'far', public.create_branch(tests.id('clinic'), 'Bastos', null, 'Yaoundé', null, 3.8900, 11.5100);
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('clinic'), tests.id('akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where branch_id = tests.id('akwa');
insert into public.practitioners (organization_id, branch_id, title, display_name)
values (tests.id('clinic'), tests.id('akwa'), 'Dr', 'Mbarga'), (tests.id('clinic'), tests.id('akwa'), 'Dr', 'Ngo');
insert into ids select 'mbarga', id from public.practitioners where display_name = 'Mbarga' and branch_id = tests.id('akwa');
insert into ids select 'ngo', id from public.practitioners where display_name = 'Ngo' and branch_id = tests.id('akwa');
insert into public.counters (organization_id, branch_id, kind, number) values (tests.id('clinic'), tests.id('akwa'), 'cabinet', 1);
insert into ids select 'cab1', id from public.counters where branch_id = tests.id('akwa');
insert into public.counter_services (organization_id, counter_id, service_id) values (tests.id('clinic'), tests.id('cab1'), tests.id('consult'));
-- Rendez-vous possibles tous les jours de 8 h à 18 h (30 min) pour les deux praticiens.
insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
select tests.id('clinic'), tests.id('akwa'), p.id, tests.id('consult'), d, '08:00', '18:00', 30
from public.practitioners p, generate_series(1, 7) d where p.branch_id = tests.id('akwa');
select tests.login_as('b9000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M9 Eneo', 'pgtap-m9-eneo', 'utility');
select tests.logout();
-- Agence ouverte jour et nuit (le test ne dépend pas de l'heure).
delete from public.opening_hours where branch_id = tests.id('akwa');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.id('clinic'), tests.id('akwa'), d, '00:00', '23:59:59' from generate_series(1, 7) d;
update public.branch_settings set public_listing_enabled = false where branch_id = tests.id('hidden');
insert into vals select 'today', to_jsonb(public.branch_service_day(tests.id('akwa')));
create function tests.slot(p_days int, p_time time) returns timestamptz language sql as $$
  select (((tests.v('today') #>> '{}')::date + p_days) + p_time) at time zone 'Africa/Douala'
$$;
grant execute on function tests.slot(int, time) to anon, authenticated, service_role;

-- ─── Établissements à proximité ──────────────────────────────────────────────
select tests.as_anon();
insert into vals select 'near', public.nearby_branches(4.0510, 9.7010, 25, 'Zeta');
select is((select jsonb_agg(b ->> 'name') from jsonb_array_elements(tests.v('near')) b), '["Akwa"]'::jsonb,
  'à proximité : agence visible dans le rayon ; agence masquée et agence lointaine exclues');
select ok((tests.v('near') -> 0 ->> 'distance_m')::numeric between 100 and 300, 'distance calculée (environ 160 m)');
select is(public.branch_public(tests.id('akwa')) -> 'services' -> 0 ->> 'name', 'Consultation',
  'page de l''agence : files et attente en direct par service (la liste reste légère, sans détail)');
select is((select jsonb_agg(b ->> 'name' order by b ->> 'name') from jsonb_array_elements(public.nearby_branches(null, null, 25, 'Zeta')) b),
  '["Akwa", "Bastos"]'::jsonb, 'sans position : toutes les agences visibles, triées par ville');
select throws_ok($$ select public.nearby_branches(4.05, null) $$, 'P0409', 'invalid_state', 'position incomplète refusée');
select is(public.branch_public(tests.id('hidden')), null, 'agence masquée : pas de page publique');
select is(public.branch_public(tests.id('akwa')) -> 'remote' ->> 'enabled', 'false', 'ticket à distance désactivé par défaut');

-- ─── Ticket à distance ───────────────────────────────────────────────────────
select tests.as_service();
select throws_ok($$ select public.take_remote_ticket(tests.id('consult'), 4.06, 9.71, null, 'c9000000-0000-0000-0000-00000000000c') $$,
  'P0422', 'remote_not_allowed', 'option désactivée : refusé');
select tests.logout();
update public.branch_settings set remote_tickets_enabled = true, remote_max_distance_km = 10, almost_turn_threshold = 1,
  remote_confirm_threshold = 2
where branch_id = tests.id('akwa');
select tests.as_service();
select throws_ok($$ select public.take_remote_ticket(tests.id('consult'), null, null, null, 'c9000000-0000-0000-0000-00000000000c') $$,
  'P0422', 'location_required', 'distance maximale : position exigée');
select throws_ok($$ select public.take_remote_ticket(tests.id('consult'), 3.89, 11.51, null, 'c9000000-0000-0000-0000-00000000000c') $$,
  'P0422', 'too_far', 'trop loin : refusé');
-- R : client à environ 2 km.
insert into vals select 'R', public.take_remote_ticket(tests.id('consult'), 4.0680, 9.7000, null, 'c9000000-0000-0000-0000-00000000000c');
select is((select (is_remote, source, remote_travel_seconds between 440 and 500)::text from public.tickets where id = tests.ticket('R')),
  '(t,remote,t)', 'ticket à distance : trajet estimé (≈ 2 km × 1,3 à 20 km/h), sans coordonnées enregistrées');
select throws_ok($$ select public.take_remote_ticket(tests.id('consult'), 4.068, 9.70, null, 'c9000000-0000-0000-0000-00000000000c') $$,
  'P0422', 'active_ticket_exists', 'un seul ticket actif par client et par agence');
select tests.logout();
select tests.login_as('c9000000-0000-0000-0000-00000000000d', true);
select throws_ok($$ select public.take_remote_ticket(tests.id('consult'), 4.068, 9.70, null, 'c9000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'prise directe par un client interdite (serveur seulement)');
select tests.logout();
select is(public.ticket_view(tests.ticket('R')) -> 'remote' ->> 'delay_count', '0', 'Mon ticket : état du ticket à distance');
select ok(public.ticket_view(tests.ticket('R')) -> 'branch' ? 'latitude', 'Mon ticket : coordonnées de l''agence (itinéraire)');

select tests.as_anon();
select is(public.set_remote_travel(tests.token('R'), 30) -> 'remote' ->> 'travel_seconds', '1800', 'trajet saisi par le client');
select ok(public.signal_on_my_way(tests.token('R')) -> 'remote' ->> 'on_my_way_at' is not null, '« Je suis en route » enregistré');
select throws_ok(format('select public.confirm_presence(%L, %L)', tests.token('R'), 'ZZZZZZ'), 'P0422', 'invalid_entry',
  'présence : code d''une autre agence refusé');
select throws_ok($$ select public.confirm_presence('AAAAAAAAAAAAAAAAAAAAAA', 'ZZZZZZ') $$, 'P0404', 'not_found', 'présence : lien inconnu');
select tests.logout();

-- Opt-in WhatsApp du client R (M7) : il recevra les messages du ticket à distance.
select tests.as_service();
select public.whatsapp_opt_in('237690000901', (select display_code from public.tickets where id = tests.ticket('R')),
  right(tests.token('R'), 4), 'fr');
select tests.logout();

-- Quatre patients sur place derrière R.
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
insert into vals select 'W' || i, public.reception_create_ticket(tests.id('consult')) from generate_series(1, 4) i;
select public.open_counter(tests.id('cab1'));
select is(public.call_next(tests.id('cab1')) ->> 'id', tests.ticket('W1')::text,
  'R non confirmé en tête : le patient suivant est appelé');
select is(tests.state(tests.ticket('R')), '(1,3)',
  'R recule de 2 places (W2, W3 devant) : premier retard');
select ok(tests.jobs(tests.ticket('R')) @> array['ticket_moved_back', 'presence_reminder'],
  'R prévenu : ticket reculé, « confirmez votre présence »');
select ok(not tests.jobs(tests.ticket('R')) @> array['almost_your_turn'], 'pas de « bientôt votre tour » sans présence confirmée');
select public.admit_ticket(tests.ticket('W1'));
select public.call_next(tests.id('cab1'), null, true);
select public.admit_ticket(tests.ticket('W2'));
select public.call_next(tests.id('cab1'), null, true);
select public.admit_ticket(tests.ticket('W3'));
select is(public.call_next(tests.id('cab1'), null, true) ->> 'id', tests.ticket('W4')::text,
  'R de nouveau en tête, toujours absent : W4 appelé');
select is((select status::text from public.tickets where id = tests.ticket('R')), 'cancelled', 'deuxième retard : R annulé');
select tests.logout();
select ok((public.ticket_view(tests.ticket('R')) -> 'remote' ->> 'cancelled_for_absence')::boolean, 'Mon ticket : annulé faute de présence');
select ok(tests.jobs(tests.ticket('R')) @> array['remote_cancelled'], 'R prévenu de l''annulation');
select tests.login_as('a9000000-0000-0000-0000-00000000000a');

-- S : seul dans la file, non confirmé → jamais appelé, sans pénalité ; confirmé par scan → appelé.
select public.admit_ticket(tests.ticket('W4'));
select public.finish_ticket(tests.ticket('W4'));
select tests.logout();
select tests.as_service();
insert into vals select 'S', public.take_remote_ticket(tests.id('consult'), 4.06, 9.70, null, 'c9000000-0000-0000-0000-00000000000d');
select tests.logout();
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
select is(public.call_next(tests.id('cab1')), null, 'seul et non confirmé : personne n''est appelé');
select is((select (status, delay_count)::text from public.tickets where id = tests.ticket('S')), '(waiting,0)', 'seul : pas de pénalité');
select tests.logout();
select tests.as_anon();
insert into vals select 'S_confirm', public.confirm_presence(tests.token('S'),
  tests.qr('short_code'));
select ok(tests.v('S_confirm') -> 'remote' ->> 'presence_confirmed_at' is not null, 'présence confirmée par le code de l''agence');
select is(public.confirm_presence(tests.token('S'), tests.qr('token'))
  -> 'remote' ->> 'presence_confirmed_at', tests.v('S_confirm') -> 'remote' ->> 'presence_confirmed_at', 'confirmation idempotente (QR code)');
select tests.logout();
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
select is(public.call_next(tests.id('cab1')) ->> 'id', tests.ticket('S')::text, 'présence confirmée : appelé normalement');

-- T : « il est temps de partir » quand l'attente ne couvre plus le trajet (+ marge), confirmation par l'accueil.
select tests.logout();
select tests.as_service();
insert into vals select 'T', public.take_remote_ticket(tests.id('consult'), 4.06, 9.70, null, 'c9000000-0000-0000-0000-00000000000e');
select public.whatsapp_opt_in('237690000903', (select display_code from public.tickets where id = tests.ticket('T')),
  right(tests.token('T'), 4), 'fr');
select tests.logout();
select tests.as_anon();
select public.set_remote_travel(tests.token('T'), 120);
select tests.logout();
select public.sweep_remote_tickets();
select ok(tests.jobs(tests.ticket('T')) @> array['time_to_leave'], '« il est temps de partir » mis en file');
select public.sweep_remote_tickets();
select is((select count(*)::int from public.notification_jobs where ticket_id = tests.ticket('T') and event = 'time_to_leave'), 1,
  '« il est temps de partir » envoyé une seule fois');
select tests.login_as('b9000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.staff_confirm_presence(%L)', tests.ticket('T')), '42501', null,
  'confirmation par l''accueil : autre établissement refusé');
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
select public.staff_confirm_presence(tests.ticket('T'));
select ok((select presence_confirmed_at is not null from public.tickets where id = tests.ticket('T')), 'présence confirmée par l''accueil');
select tests.logout();

-- ─── Demandes de rendez-vous ─────────────────────────────────────────────────
select tests.as_anon();
select throws_ok(format('select public.request_options(%L)', tests.id('akwa')), 'P0422', 'requests_disabled',
  'demandes désactivées par défaut');
select tests.logout();
update public.branch_settings set appointment_requests_enabled = true where branch_id = tests.id('akwa');
select tests.as_anon();
insert into vals select 'options', public.request_options(tests.id('akwa'));
select is(jsonb_array_length(tests.v('options') -> 'services' -> 0 -> 'practitioners'), 2, 'formulaire : service et ses praticiens');
select ok(exists (select 1 from jsonb_array_elements(tests.v('options') -> 'slots') s
  where (s ->> 'starts_at')::timestamptz = tests.slot(1, '10:00')), 'formulaire : créneaux libres (demain 10 h)');
select throws_ok(format($$ select public.create_appointment_request(%L, %L, null, %L, null, null, '+237677000901', null, 'fr', 'c9000000-0000-0000-0000-00000000000c') $$,
  tests.id('akwa'), tests.id('consult'), tests.slot(1, '10:00')), '42501', null, 'demande directe par un client interdite (serveur seulement)');
select tests.logout();

select tests.as_service();
insert into vals select 'Q1', public.create_appointment_request(tests.id('akwa'), tests.id('consult'), tests.id('mbarga'),
  tests.slot(1, '10:00'), null, null, '+237677000901', 'J.M.', 'fr', 'c9000000-0000-0000-0000-00000000000c');
select throws_ok(format($$ select public.create_appointment_request(%L, %L, null, %L, null, null, '+237677000902', null, 'fr', 'c9000000-0000-0000-0000-00000000000d') $$,
  tests.id('akwa'), tests.id('consult'), tests.slot(1, '03:00')), 'P0409', 'slot_unavailable', 'créneau hors horaires refusé');
select tests.logout();
select is((select (status, phone_e164)::text from public.appointment_requests where id = tests.request('Q1')),
  '(unverified,+237677000901)', 'demande créée, numéro à vérifier');
select ok(tests.request_code(tests.request('Q1')) ~ '^[0-9]{6}$', 'code de vérification envoyé par WhatsApp');
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
select is(jsonb_array_length(public.list_appointment_requests(tests.id('akwa'))), 0, 'numéro non vérifié : invisible de l''accueil');
select tests.logout();
select tests.as_anon();
select is(public.verify_appointment_request(tests.request_token('Q1'), '000000') ->> 'error', 'code_invalid', 'mauvais code refusé');
select is(public.verify_appointment_request(tests.request_token('Q1'), tests.request_code(tests.request('Q1'))) ->> 'status', 'pending',
  'bon code : demande en attente de l''accueil');
select tests.logout();
select is(tests.request_code(tests.request('Q1')), null, 'code effacé de la file d''envoi après vérification');
select tests.as_service();
select throws_ok(format($$ select public.create_appointment_request(%L, %L, null, null, %L, 'morning', '+237677000901', null, 'fr', 'c9000000-0000-0000-0000-00000000000c') $$,
  tests.id('akwa'), tests.id('consult'), (tests.v('today') #>> '{}')::date + 2), 'P0409', 'request_exists',
  'une seule demande en attente par numéro et par agence');
insert into vals select 'Q1bis', public.create_appointment_request(tests.id('akwa'), tests.id('consult'), null,
  null, ((tests.v('today') #>> '{}')::date + 2), 'morning', '+237677000904', null, 'fr', 'c9000000-0000-0000-0000-00000000000c');
select tests.logout();
select tests.as_anon();
select throws_ok($$ select public.verify_appointment_request('AAAAAAAAAAAAAAAAAAAAAA', '123456') $$, 'P0404', 'not_found', 'lien inconnu');
select is(public.get_appointment_request(tests.request_token('Q1')) ->> 'phone_masked', '+2376•• •• •• 01', 'lien du patient : numéro masqué');
select tests.logout();

select tests.login_as('b9000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.list_appointment_requests(%L)', tests.id('akwa')), '42501', null, 'demandes : autre établissement refusé');
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
select is(public.list_appointment_requests(tests.id('akwa')) -> 0 ->> 'phone_e164', '+237677000901', 'accueil : demande et numéro');
insert into vals select 'A1', public.accept_appointment_request(tests.request('Q1'), tests.id('mbarga'), tests.slot(1, '10:00'));
select is((select (r.status, a.phone_e164, a.customer_label)::text from public.appointment_requests r join public.appointments a on a.id = r.appointment_id
  where r.id = tests.request('Q1')), '(accepted,+237677000901,J.M.)', 'confirmée en un clic : rendez-vous créé avec le numéro vérifié');
select ok(tests.has_job((tests.v('A1') -> 'appointment' ->> 'id')::uuid, 'request_accepted'), 'réponse WhatsApp « demande confirmée »');
select tests.logout();

-- Q2 : jour + matinée ; l'accueil propose un autre jour → « modifiée ». Q3 : refusée.
select tests.as_service();
insert into vals select 'Q2', public.create_appointment_request(tests.id('akwa'), tests.id('consult'), null,
  null, ((tests.v('today') #>> '{}')::date + 1), 'morning', '+237677000902', null, 'en', 'c9000000-0000-0000-0000-00000000000d');
insert into vals select 'Q3', public.create_appointment_request(tests.id('akwa'), tests.id('consult'), tests.id('ngo'),
  tests.slot(1, '11:00'), null, null, '+237677000903', null, 'fr', 'c9000000-0000-0000-0000-00000000000e');
select tests.logout();
select tests.as_anon();
select public.verify_appointment_request(tests.request_token('Q2'), tests.request_code(tests.request('Q2')));
select public.verify_appointment_request(tests.request_token('Q3'), tests.request_code(tests.request('Q3')));
select tests.logout();
select tests.login_as('a9000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.accept_appointment_request(%L, %L, %L)', tests.request('Q2'), tests.id('mbarga'), tests.slot(1, '10:00')),
  'P0409', 'slot_unavailable', 'créneau déjà pris : refusé');
select is(public.accept_appointment_request(tests.request('Q2'), tests.id('ngo'), tests.slot(2, '09:00')) -> 'request' ->> 'status', 'modified',
  'autre jour proposé : demande modifiée');
select is(public.decline_appointment_request(tests.request('Q3'), 'Praticien en congé') ->> 'status', 'declined', 'demande refusée');
select ok(tests.has_job(tests.request('Q3'), 'request_declined'),
  'réponse WhatsApp « demande refusée »');
select tests.logout();
select tests.as_anon();
select is(public.cancel_my_appointment_request(tests.request_token('Q1bis')) ->> 'status', 'cancelled', 'le patient retire sa demande');
select tests.logout();

-- Expiration et purge.
update public.appointment_requests set status = 'pending', preferred_day = (tests.v('today') #>> '{}')::date - 1
where id = tests.request('Q1bis');
select public.sweep_appointment_requests();
select is((select status::text from public.appointment_requests where id = tests.request('Q1bis')), 'expired', 'jour passé : demande expirée');
update public.appointment_requests set created_at = now() - interval '400 days' where id = tests.request('Q3');
select public.purge_personal_data();
select is((select (phone_e164, customer_user_id)::text from public.appointment_requests where id = tests.request('Q3')), '(,)',
  'purge : numéro et session effacés');
select tests.login_as('c9000000-0000-0000-0000-00000000000c', true);
select is((select count(*)::int from public.appointment_requests), 0, 'RLS : un client ne lit pas les demandes');
select tests.logout();
select ok((select relrowsecurity from pg_class where oid = 'public.appointment_requests'::regclass), 'RLS activée');

select * from finish();
rollback;
