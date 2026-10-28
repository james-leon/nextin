-- pgTAP — M5b : rendez-vous (règle d'équité en parité avec le TS, créneaux, congés, prise, reprogrammation,
-- annulation, arrivée, ordre d'appel, suivi du ticket, absents, notifications, droits, isolation, purge).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(54);

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
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tests to authenticated, service_role;
grant execute on all functions in schema tests to authenticated, service_role;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to authenticated, service_role;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
create function tests.jobs(p_appointment uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(event::text || '/' || status::text order by next_attempt_at, event), '{}')
  from public.notification_jobs where appointment_id = p_appointment and ticket_id is null;
$$;
grant execute on function tests.id(text), tests.v(text), tests.jobs(uuid) to authenticated;

-- ─── Règle d'équité : mêmes cas de référence que packages/shared/src/appointments/fairness.fixtures.json ─
select is(
  public.fair_pick(f -> 'candidates', f ->> 'mode', (f ->> 'ratio')::int, (f ->> 'early')::int, (f ->> 'since')::int, (f ->> 'now')::timestamptz),
  f ->> 'expected', 'équité : ' || (f ->> 'name'))
from jsonb_array_elements($fixtures$[{"name": "file vide", "mode": "ratio", "ratio": 2, "early": 15, "since": null, "now": "2026-10-29T09:00:00Z", "candidates": [], "expected": null}, {"name": "sans rendez-vous : ordre de la file", "mode": "ratio", "ratio": 2, "early": 15, "since": null, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "w1", "at": null}, {"id": "w2", "at": null}], "expected": "w1"}, {"name": "ratio : premier rendez-vous du jour, à l'heure", "mode": "ratio", "ratio": 2, "early": 15, "since": null, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T09:10:00Z"}, {"id": "w1", "at": null}], "expected": "a1"}, {"name": "ratio : quota de patients sans rendez-vous non atteint", "mode": "ratio", "ratio": 2, "early": 15, "since": 1, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T09:00:00Z"}, {"id": "w1", "at": null}, {"id": "w2", "at": null}], "expected": "w1"}, {"name": "ratio : quota atteint", "mode": "ratio", "ratio": 2, "early": 15, "since": 2, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T09:00:00Z"}, {"id": "w1", "at": null}], "expected": "a1"}, {"name": "ratio : personne sans rendez-vous n'attend, le rendez-vous passe", "mode": "ratio", "ratio": 3, "early": 15, "since": 0, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T09:05:00Z"}], "expected": "a1"}, {"name": "rendez-vous trop en avance : pas encore prioritaire", "mode": "ratio", "ratio": 2, "early": 15, "since": null, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T09:30:00Z"}, {"id": "w1", "at": null}], "expected": "w1"}, {"name": "rendez-vous en avance, file vide sinon : il passe", "mode": "strict", "ratio": 2, "early": 15, "since": null, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T10:30:00Z"}], "expected": "a1"}, {"name": "strict : rendez-vous à l'heure avant les patients sans rendez-vous", "mode": "strict", "ratio": 2, "early": 15, "since": 0, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "w1", "at": null}, {"id": "a1", "at": "2026-10-29T09:15:00Z"}], "expected": "a1"}, {"name": "strict : le rendez-vous le plus tôt d'abord", "mode": "strict", "ratio": 2, "early": 15, "since": 0, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a2", "at": "2026-10-29T09:10:00Z"}, {"id": "a1", "at": "2026-10-29T08:50:00Z"}, {"id": "w1", "at": null}], "expected": "a1"}, {"name": "strict : marge d'avance nulle", "mode": "strict", "ratio": 2, "early": 0, "since": 0, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "w1", "at": null}, {"id": "a1", "at": "2026-10-29T09:01:00Z"}], "expected": "w1"}, {"name": "ratio : ordre de la file parmi les patients sans rendez-vous (priorités déjà en tête)", "mode": "ratio", "ratio": 1, "early": 15, "since": 0, "now": "2026-10-29T09:00:00Z", "candidates": [{"id": "a1", "at": "2026-10-29T09:00:00Z"}, {"id": "p1", "at": null}, {"id": "w1", "at": null}], "expected": "p1"}]$fixtures$::jsonb) f;

-- ─── Établissement ───────────────────────────────────────────────────────────
select tests.create_user('a5b00000-0000-0000-0000-00000000000a', 'admin@m5b-clinic.test');
select tests.create_user('b5b00000-0000-0000-0000-00000000000b', 'admin@m5b-eneo.test');
select tests.create_user('d5b00000-0000-0000-0000-00000000000d', 'accueil@m5b-clinic.test');
select tests.login_as('a5b00000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M5b Clinic', 'pgtap-m5b-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch(tests.id('clinic'), 'Akwa');
insert into public.specialties (organization_id, name) values (tests.id('clinic'), 'Médecine générale');
insert into public.practitioners (organization_id, branch_id, title, display_name, specialty_id)
select tests.id('clinic'), tests.id('akwa'), 'Dr', n, (select id from public.specialties where organization_id = tests.id('clinic'))
from unnest(array['Mbarga', 'Nkeng']) n;
insert into ids select lower(display_name), id from public.practitioners where organization_id = tests.id('clinic');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('clinic'), tests.id('akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where branch_id = tests.id('akwa');
insert into public.counters (organization_id, branch_id, kind, number, default_practitioner_id)
values (tests.id('clinic'), tests.id('akwa'), 'cabinet', 1, tests.id('mbarga')),
       (tests.id('clinic'), tests.id('akwa'), 'cabinet', 2, tests.id('nkeng'));
insert into ids select 'cab' || number, id from public.counters where branch_id = tests.id('akwa');
insert into public.counter_services (organization_id, counter_id, service_id)
select tests.id('clinic'), id, tests.id('consult') from public.counters where branch_id = tests.id('akwa');
select tests.login_as('b5b00000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M5b Eneo', 'pgtap-m5b-eneo', 'utility');
select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id)
values (tests.id('clinic'), 'd5b00000-0000-0000-0000-00000000000d', 'receptionist', tests.id('akwa'));
-- Jour de référence : dans une semaine (heure de Douala).
insert into vals select 'day', to_jsonb(public.branch_service_day(tests.id('akwa')) + 7);
insert into vals select 'today_date', to_jsonb(public.branch_service_day(tests.id('akwa')));
create function tests.at(p_time time) returns timestamptz language sql as $$
  select ((tests.v('day') #>> '{}')::date + p_time) at time zone 'Africa/Douala';
$$;
grant execute on function tests.at(time) to authenticated;
create function tests.call(p_counter text) returns text language plpgsql as $$
declare
  v jsonb;
begin
  -- Termine le patient en cours puis alerte et admet le suivant.
  v := public.call_next(tests.id(p_counter), null, true);
  if v is null then return null; end if;
  perform public.admit_ticket((v ->> 'id')::uuid);
  return coalesce((select customer_label from public.appointments where ticket_id = (v ->> 'id')::uuid), 'sans RDV');
end $$;
grant execute on function tests.call(text) to authenticated;

-- ─── Créneaux ────────────────────────────────────────────────────────────────
select tests.login_as('a5b00000-0000-0000-0000-00000000000a');
insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
values (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), tests.id('consult'),
        extract(isodow from (tests.v('day') #>> '{}')::date), '08:00', '10:00', 30);
select throws_ok($$ insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
  values (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), tests.id('consult'),
          extract(isodow from (tests.v('day') #>> '{}')::date), '09:30', '11:00', 15) $$,
  'P0409', 'schedule_overlap', 'plages du même jour : jamais de chevauchement');
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select throws_ok($$ insert into public.practitioner_schedules (organization_id, branch_id, practitioner_id, service_id, weekday, starts_at, ends_at, slot_minutes)
  values (tests.id('clinic'), tests.id('akwa'), tests.id('nkeng'), tests.id('consult'), 1, '08:00', '09:00', 30) $$,
  '42501', null, 'l''accueil ne modifie pas les horaires des praticiens');
select is(jsonb_array_length(public.available_slots(tests.id('mbarga'), (tests.v('day') #>> '{}')::date)), 4, 'quatre créneaux de 30 min');
select is((public.available_slots(tests.id('mbarga'), (tests.v('day') #>> '{}')::date) -> 0 ->> 'starts_at')::timestamptz,
  tests.at('08:00'), 'premier créneau à 8 h (heure de Douala)');
select tests.logout();
insert into public.practitioner_leaves (organization_id, branch_id, practitioner_id, starts_on, ends_on, reason)
values (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), (tests.v('day') #>> '{}')::date - 1, (tests.v('day') #>> '{}')::date, 'Congé');
insert into public.branch_closures (organization_id, branch_id, date) values (tests.id('clinic'), tests.id('akwa'), (tests.v('day') #>> '{}')::date + 7);
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select is(jsonb_array_length(public.available_slots(tests.id('mbarga'), (tests.v('day') #>> '{}')::date)), 0, 'congé : aucun créneau');
select is(jsonb_array_length(public.available_slots(tests.id('mbarga'), (tests.v('day') #>> '{}')::date + 7)), 0, 'agence fermée : aucun créneau');
select tests.logout();
delete from public.practitioner_leaves where practitioner_id = tests.id('mbarga');

-- ─── Prise de rendez-vous ────────────────────────────────────────────────────
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.book_appointment(tests.id('mbarga'), tests.at('08:10'), 'A.B.') $$, 'P0409', 'slot_unavailable', 'hors créneau : refusé');
select throws_ok($$ select public.book_appointment(tests.id('mbarga'), tests.at('08:30'), 'A.B.', '+237677000001', false) $$,
  'P0422', 'consent_required', 'numéro sans l''accord du patient : refusé');
insert into vals select 'r1', public.book_appointment(tests.id('mbarga'), tests.at('08:30'), 'A.B.', '+237677000001', true, 'fr');
select is((select (v ->> 'status', v ->> 'customer_label', v -> 'practitioner' ->> 'name') from vals where name = 'r1'),
  ('confirmed'::text, 'A.B.'::text, 'Dr Mbarga'::text), 'rendez-vous confirmé');
select throws_ok($$ select public.book_appointment(tests.id('mbarga'), tests.at('08:30'), 'C.D.') $$, 'P0409', 'slot_unavailable', 'créneau déjà pris');
select is(jsonb_array_length(public.available_slots(tests.id('mbarga'), (tests.v('day') #>> '{}')::date)), 3, 'le créneau pris disparaît');
select is(tests.jobs((tests.v('r1') ->> 'id')::uuid),
  array['appointment_confirmed/pending', 'appointment_reminder_day_before/pending', 'appointment_reminder_2h/pending'],
  'confirmation, rappel la veille et 2 heures avant');
select tests.logout();
select is((select next_attempt_at from public.notification_jobs where appointment_id = (tests.v('r1') ->> 'id')::uuid and event = 'appointment_reminder_day_before'),
  (((tests.v('day') #>> '{}')::date - 1) + time '18:00') at time zone 'Africa/Douala', 'rappel de la veille à 18 h');
select throws_ok($$ insert into public.appointments (organization_id, branch_id, practitioner_id, service_id, starts_at, ends_at)
  values (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), tests.id('consult'), tests.at('08:45'), tests.at('09:15')) $$,
  '23P01', null, 'la base exclut deux rendez-vous qui se chevauchent');

select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
insert into vals select 'r2', public.reschedule_appointment((tests.v('r1') ->> 'id')::uuid, tests.at('09:00'));
select is((select status::text from public.appointments where id = (tests.v('r1') ->> 'id')::uuid), 'rescheduled', 'ancien rendez-vous : reprogrammé');
select is((select (v ->> 'rescheduled_from_id', v ->> 'phone_e164') from vals where name = 'r2'),
  (tests.v('r1') ->> 'id', '+237677000001'::text), 'nouveau rendez-vous lié à l''ancien, numéro conservé');
select is(tests.jobs((tests.v('r1') ->> 'id')::uuid),
  array['appointment_confirmed/cancelled', 'appointment_reminder_day_before/cancelled', 'appointment_reminder_2h/cancelled'],
  'rappels de l''ancien créneau annulés');
select ok('appointment_rescheduled/pending' = any (tests.jobs((tests.v('r2') ->> 'id')::uuid)), 'message « rendez-vous déplacé »');
select public.cancel_appointment((tests.v('r2') ->> 'id')::uuid, 'Patient indisponible');
select is(tests.jobs((tests.v('r2') ->> 'id')::uuid),
  array['appointment_rescheduled/cancelled', 'appointment_cancelled/pending', 'appointment_reminder_day_before/cancelled', 'appointment_reminder_2h/cancelled'],
  'annulation : message d''annulation, rappels annulés');
select throws_ok(format($$ select public.check_in_appointment(%L) $$, tests.v('r2') ->> 'id'), 'P0409', 'invalid_state', 'rendez-vous annulé : pas d''arrivée');
insert into vals select 'r3', public.book_appointment(tests.id('mbarga'), tests.at('09:30'), 'E.F.');
select throws_ok(format($$ select public.check_in_appointment(%L) $$, tests.v('r3') ->> 'id'), 'P0409', 'appointment_not_today', 'arrivée réservée au jour du rendez-vous');

-- ─── Arrivée et ordre de passage (règle « ratio », 2 sans rendez-vous après un rendez-vous) ─
select tests.logout();
insert into public.appointments (organization_id, branch_id, practitioner_id, service_id, starts_at, ends_at, customer_label, phone_e164)
values (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), tests.id('consult'), now() + interval '5 minutes', now() + interval '10 minutes', 'G.H.', '+237677000002'),
       (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), tests.id('consult'), now() + interval '15 minutes', now() + interval '20 minutes', 'I.J.', null),
       (tests.id('clinic'), tests.id('akwa'), tests.id('nkeng'), tests.id('consult'), now() - interval '30 minutes', now() - interval '15 minutes', 'K.L.', null),
       (tests.id('clinic'), tests.id('akwa'), tests.id('nkeng'), tests.id('consult'), now() - interval '2 hours', now() - interval '105 minutes', 'M.N.', null);
insert into ids select 'a' || row_number() over (order by starts_at desc), id from public.appointments where customer_label in ('G.H.', 'I.J.', 'K.L.', 'M.N.') and organization_id = tests.id('clinic');
-- a1 = I.J. (+15 min), a2 = G.H. (+5 min), a3 = K.L. (-30 min, en retard), a4 = M.N. (-2 h)
insert into public.notification_contacts (organization_id, branch_id, appointment_id, channel, phone_e164, locale, consent_source, consent_at)
values (tests.id('clinic'), tests.id('akwa'), tests.id('a2'), 'whatsapp', '+237677000002', 'fr', 'reception_with_consent', now());
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
insert into vals select 'w1', public.reception_create_ticket(tests.id('consult'));
insert into vals select 'ci2', public.check_in_appointment(tests.id('a2'));
insert into vals select 'w2', public.reception_create_ticket(tests.id('consult'));
insert into vals select 'w3', public.reception_create_ticket(tests.id('consult'));
insert into vals select 'ci1', public.check_in_appointment(tests.id('a1'));
insert into vals select 'ci3', public.check_in_appointment(tests.id('a3'));
select is((select (v -> 'ticket' ->> 'priority_reason', (v ->> 'late')::boolean, v -> 'appointment' ->> 'status') from vals where name = 'ci2'),
  ('appointment'::text, false, 'checked_in'::text), 'arrivée à l''heure : ticket prioritaire « RDV »');
select is((select preferred_counter_id from public.tickets where appointment_id = tests.id('a2')), tests.id('cab1'), 'ticket attitré au cabinet du praticien');
select is((select (v -> 'ticket' ->> 'priority_reason', (v ->> 'late')::boolean) from vals where name = 'ci3'),
  (null::text, true), 'arrivée après la tolérance : ticket ordinaire');
select ok(exists (select 1 from public.notification_contacts where appointment_id = tests.id('a2') and ticket_id is not null),
  'le numéro suit le ticket (alertes de la file)');

select tests.logout();
update public.tickets set preferred_counter_id = null where appointment_id = tests.id('a3');
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select public.open_counter(tests.id('cab1'));
select is(array[tests.call('cab1'), tests.call('cab1'), tests.call('cab1'), tests.call('cab1'), tests.call('cab1'), tests.call('cab1')],
  array['G.H.', 'sans RDV', 'sans RDV', 'I.J.', 'sans RDV', 'K.L.'],
  'ratio 2 : un rendez-vous, deux patients sans rendez-vous, le suivant ; arrivé en retard, K.L. passe comme sans rendez-vous');
select is((select status::text from public.appointments where id = tests.id('a2')), 'completed', 'patient servi : rendez-vous terminé');

select tests.logout();
update public.branch_settings set appointment_mode = 'strict' where branch_id = tests.id('akwa');
insert into public.appointments (organization_id, branch_id, practitioner_id, service_id, starts_at, ends_at, customer_label)
values (tests.id('clinic'), tests.id('akwa'), tests.id('mbarga'), tests.id('consult'), now() + interval '40 minutes', now() + interval '50 minutes', 'O.P.');
insert into ids select 'a5', id from public.appointments where customer_label = 'O.P.' and organization_id = tests.id('clinic');
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select public.reception_create_ticket(tests.id('consult'));
select public.check_in_appointment(tests.id('a5'));
select is(tests.call('cab1'), 'sans RDV', 'strict : rendez-vous trop en avance, le patient sans rendez-vous passe');
select tests.logout();
update public.appointments set starts_at = now() + interval '11 minutes', ends_at = now() + interval '14 minutes' where id = tests.id('a5');
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select public.reception_create_ticket(tests.id('consult'));
select is(tests.call('cab1'), 'O.P.', 'strict : à son heure, le rendez-vous passe avant');
select tests.logout();
select is(public.sweep_appointments(), 1, 'sans arrivée une heure après : absent');
select is((select status::text from public.appointments where id = tests.id('a4')), 'no_show', 'rendez-vous passé : absent');

-- ─── Vue du jour, « en attente », droits ─────────────────────────────────────
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
insert into vals select 'today', public.list_appointments(tests.id('akwa'), (tests.v('today_date') #>> '{}')::date, (tests.v('today_date') #>> '{}')::date);
select is((select jsonb_array_length(v) from vals where name = 'today'), 5, 'rendez-vous du jour');
select ok((select bool_and(not (a ? 'name')) from vals, jsonb_array_elements(v) a where name = 'today'), 'aucun nom de patient');
select public.declare_practitioner_absence(tests.id('nkeng'), 'late', now() + interval '30 minutes');
select tests.logout();
update public.tickets set status = 'waiting', counter_id = null where appointment_id = tests.id('a3');
update public.tickets set appointment_id = tests.id('a3') where id = (select ticket_id from public.appointments where id = tests.id('a3'));
update public.appointments set status = 'checked_in' where id = tests.id('a3');
select is(public.appointment_json(tests.id('a3')) ->> 'display_status', 'waiting', 'arrivé, praticien en retard : « en attente »');
select tests.login_as('b5b00000-0000-0000-0000-00000000000b');
select throws_ok(format($$ select public.list_appointments(%L, current_date, current_date) $$, tests.id('akwa')), '42501', null,
  'isolation : rendez-vous d''un autre établissement inaccessibles');
select is((select count(*)::int from public.appointments), 0, 'isolation : lecture directe');
select throws_ok(format($$ select public.available_slots(%L, current_date) $$, tests.id('mbarga')), '42501', null, 'isolation : créneaux');
select tests.login_as('d5b00000-0000-0000-0000-00000000000d');
select throws_ok($$ update public.appointments set status = 'completed' $$, '42501', null, 'écritures uniquement par RPC');
select tests.logout();
select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.appointments'::regclass, 'public.practitioner_schedules'::regclass, 'public.practitioner_leaves'::regclass)), 'RLS activée');

-- ─── Expéditeur et purge ─────────────────────────────────────────────────────
update public.notification_jobs set status = 'skipped' where status = 'pending' and organization_id <> tests.id('clinic');
select set_config('role', 'service_role', true);
insert into vals select 'claim', public.claim_notification_jobs(100);
select tests.logout();
select ok((select bool_and(j -> 'appointment' ->> 'practitioner' = 'Dr Mbarga' and j -> 'ticket' = 'null'::jsonb)
  from vals, jsonb_array_elements(v) j where name = 'claim' and j ? 'appointment' and j -> 'appointment' <> 'null'::jsonb),
  'message de rendez-vous : praticien et heure, sans ticket');
select ok((select bool_and(not (j::text ~ '(A\.B\.|E\.F\.|G\.H\.)')) from vals, jsonb_array_elements(v) j where name = 'claim'),
  'jamais le libellé du patient dans un message');
update public.organizations set data_retention_days = 7 where id = tests.id('clinic');
update public.appointments set starts_at = starts_at - interval '30 days', ends_at = ends_at - interval '30 days'
where id = (tests.v('r3') ->> 'id')::uuid;
select public.purge_personal_data();
select is((select (customer_label, phone_e164)::text from public.appointments where id = (tests.v('r3') ->> 'id')::uuid), '(,)',
  'purge : libellé et numéro effacés');

select * from finish();
rollback;
