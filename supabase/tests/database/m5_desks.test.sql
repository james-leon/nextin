-- pgTAP — M5 : sessions et pauses des postes, absences et retards des praticiens (réorientation),
-- contact WhatsApp avec consentement, appel d'un ticket précis (rejeu hors ligne).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, false, now())
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
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to authenticated, anon;

select tests.create_user('a5000000-0000-0000-0000-00000000000a', 'admin@m5-clinic.test');
select tests.create_user('b5000000-0000-0000-0000-00000000000b', 'admin@m5-eneo.test');
select tests.create_user('d5000000-0000-0000-0000-00000000000d', 'agent@m5-clinic.test');
select tests.create_user('e5000000-0000-0000-0000-00000000000e', 'anon@m5.test');

-- ─── Mise en place ───────────────────────────────────────────────────────────
select tests.login_as('a5000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M5 Clinic', 'pgtap-m5-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into public.specialties (organization_id, name) values ((select id from ids where name = 'clinic'), 'Médecine générale'),
  ((select id from ids where name = 'clinic'), 'Pédiatrie');
insert into ids select 'mg', id from public.specialties where name = 'Médecine générale' and organization_id = (select id from ids where name = 'clinic');
insert into ids select 'ped', id from public.specialties where name = 'Pédiatrie' and organization_id = (select id from ids where name = 'clinic');
insert into public.practitioners (organization_id, branch_id, title, display_name, specialty_id)
select (select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Dr', n, s
from (values ('Mbarga', (select id from ids where name = 'mg')), ('Nkeng', (select id from ids where name = 'mg')),
             ('Biyong', (select id from ids where name = 'ped'))) v(n, s);
insert into ids select lower(display_name), id from public.practitioners where organization_id = (select id from ids where name = 'clinic');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where prefix = 'C' and branch_id = (select id from ids where name = 'akwa');
insert into public.counters (organization_id, branch_id, kind, number, default_practitioner_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1, (select id from ids where name = 'mbarga')),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 2, (select id from ids where name = 'nkeng')),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 3, null),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 4, (select id from ids where name = 'biyong'));
insert into ids select 'cab' || number, id from public.counters where branch_id = (select id from ids where name = 'akwa');
insert into public.counter_services (organization_id, counter_id, service_id)
select (select id from ids where name = 'clinic'), id, (select id from ids where name = 'consult') from public.counters
where branch_id = (select id from ids where name = 'akwa');

select tests.login_as('b5000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M5 Eneo', 'pgtap-m5-eneo', 'utility');

select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id)
values ((select id from ids where name = 'clinic'), 'd5000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa'));

-- ─── Sessions et pauses ──────────────────────────────────────────────────────
select tests.login_as('d5000000-0000-0000-0000-00000000000d');
select public.open_counter((select id from ids where name = 'cab3'));
select is((select (count(*)::int, max(agent_id::text)) from public.counter_sessions where counter_id = (select id from ids where name = 'cab3') and ended_at is null),
  (1, 'd5000000-0000-0000-0000-00000000000d'::text), 'ouverture : une session au nom de l''agent');
select public.pause_counter((select id from ids where name = 'cab3'));
select is((select count(*)::int from public.counter_pauses where counter_id = (select id from ids where name = 'cab3') and ended_at is null), 1,
  'pause enregistrée');
select public.open_counter((select id from ids where name = 'cab3'));
select is((select count(*)::int from public.counter_pauses where counter_id = (select id from ids where name = 'cab3') and ended_at is not null), 1,
  'reprise : la pause est close');
select is((select count(*)::int from public.counter_sessions where counter_id = (select id from ids where name = 'cab3')), 1,
  'la reprise garde la même session');
select public.close_counter((select id from ids where name = 'cab3'));
select is((select count(*)::int from public.counter_sessions where counter_id = (select id from ids where name = 'cab3') and ended_at is null), 0,
  'fermeture : session close');

-- ─── Accueil : praticien choisi, contact WhatsApp ────────────────────────────
insert into vals select 't1', public.reception_create_ticket((select id from ids where name = 'consult'), null, null, (select id from ids where name = 'mbarga'));
select is((select (v->>'preferred_counter_id')::uuid from vals where name = 't1'), (select id from ids where name = 'cab1'),
  'ticket attitré au cabinet du praticien choisi');
select throws_ok($$ select public.reception_create_ticket((select id from ids where name = 'consult'), null, null, null, '+237677000001', false) $$,
  'P0422', 'consent_required', 'numéro refusé sans l''accord du patient');
select throws_ok($$ select public.reception_create_ticket((select id from ids where name = 'consult'), null, null, null, '0677000001', true) $$,
  'P0422', 'phone_invalid', 'numéro au format E.164 +237 exigé');
insert into vals select 't2', public.reception_create_ticket((select id from ids where name = 'consult'), null, null,
  (select id from ids where name = 'mbarga'), '+237677000001', true, 'en');
select is((select (channel, phone_e164, locale, consent_source, consent_by::text) from public.notification_contacts
  where ticket_id = (select (v->>'id')::uuid from vals where name = 't2')),
  ('whatsapp'::text, '+237677000001'::text, 'en'::text, 'reception_with_consent'::text, 'd5000000-0000-0000-0000-00000000000d'::text),
  'contact WhatsApp enregistré avec le consentement tracé');
select is((select count(*)::int from public.notification_contacts where organization_id = (select id from ids where name = 'clinic')), 1,
  'le personnel de l''agence voit le contact');
insert into vals select 't3', public.reception_create_ticket((select id from ids where name = 'consult'));

select tests.login_as('b5000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.notification_contacts), 0, 'isolation : contacts invisibles d''un autre établissement');
select is((select count(*)::int from public.counter_sessions), 0, 'isolation : sessions');
select throws_ok($$ select public.declare_practitioner_absence((select id from ids where name = 'mbarga'), 'absent') $$, '42501', null,
  'un autre établissement ne déclare pas d''absence');
select tests.login_as('e5000000-0000-0000-0000-00000000000e', true);
select is((select count(*)::int from public.notification_contacts), 0, 'une session client ne lit aucun numéro');

-- ─── Absence : réorientation vers un collègue de la même spécialité ──────────
select tests.login_as('d5000000-0000-0000-0000-00000000000d');
select public.open_counter((select id from ids where name = 'cab2'));
insert into vals select 'abs', public.declare_practitioner_absence((select id from ids where name = 'mbarga'), 'absent', null, 'Urgence');
select is((select (v->>'rerouted')::int from vals where name = 'abs'), 2, 'les deux patients du praticien absent sont réorientés');
select is((select (v->>'to_counter_id')::uuid from vals where name = 'abs'), (select id from ids where name = 'cab2'), 'vers le cabinet du collègue');
select is((select array_agg(distinct preferred_counter_id) from public.tickets
  where id in (select (v->>'id')::uuid from vals where name in ('t1', 't2'))), array[(select id from ids where name = 'cab2')],
  'tickets rattachés au collègue');
select is((select count(*)::int from public.ticket_events where type = 'rerouted'), 2, 'réorientation journalisée');
select tests.logout();
select ok(exists (select 1 from public.audit_log where action = 'practitioner.absent' and entity_id = (select id from ids where name = 'mbarga')),
  'absence inscrite au journal d''audit');
select is((select sort_key from public.tickets where id = (select (v->>'id')::uuid from vals where name = 't1')),
  (select min(sort_key) from public.tickets where service_id = (select id from ids where name = 'consult')), 'ancienneté conservée');
select tests.login_as('d5000000-0000-0000-0000-00000000000d');
insert into vals select 't4', public.reception_create_ticket((select id from ids where name = 'consult'), null, null, (select id from ids where name = 'mbarga'));
select is((select ((v->>'rerouted')::boolean, (v->>'preferred_counter_id')::uuid) from vals where name = 't4'),
  (true, (select id from ids where name = 'cab2')), 'nouveau ticket pour un praticien absent : directement chez le collègue');
insert into vals select 'abs_ped', public.declare_practitioner_absence((select id from ids where name = 'biyong'), 'absent');
select is((select v->'to_counter_id' from vals where name = 'abs_ped'), 'null'::jsonb, 'sans collègue de même spécialité : file commune');

-- ─── Retard : les patients attendent leur praticien ──────────────────────────
select throws_ok($$ select public.declare_practitioner_absence((select id from ids where name = 'nkeng'), 'late', now() - interval '1 minute') $$,
  'P0409', 'invalid_state', 'un retard exige une heure de retour future');
select public.declare_practitioner_absence((select id from ids where name = 'nkeng'), 'late', now() + interval '30 minutes', 'Embouteillage');
select public.close_counter((select id from ids where name = 'cab2'));
select tests.logout();
select ok((public.ticket_view((select (v->>'id')::uuid from vals where name = 't1'))->>'practitioner_late_until') is not null,
  'le client voit l''heure de retour prévue');
select ok((public.ticket_view((select (v->>'id')::uuid from vals where name = 't1'))->>'wait_seconds')::int >= 1790,
  'l''attente intègre le retour du praticien');
select is((select count(*)::int from public.tickets where preferred_counter_id = (select id from ids where name = 'cab2') and status = 'waiting'), 3,
  'en retard (poste fermé), les patients restent rattachés');
select tests.login_as('d5000000-0000-0000-0000-00000000000d');
select public.open_counter((select id from ids where name = 'cab3'));
insert into vals select 'c1', public.call_next((select id from ids where name = 'cab3'));
select is((select (v->>'id')::uuid from vals where name = 'c1'), (select (v->>'id')::uuid from vals where name = 't3'),
  'un autre poste ne prend pas les patients d''un praticien en retard');
select public.mark_no_show((select (v->>'id')::uuid from vals where name = 'c1'));
select is(public.end_practitioner_absence((select id from public.practitioner_absences where practitioner_id = (select id from ids where name = 'nkeng') and ended_at is null))->>'ended',
  'true', 'retour du praticien');
select tests.logout();
select is((public.ticket_view((select (v->>'id')::uuid from vals where name = 't1'))->>'practitioner_late_until'), null, 'plus de retard affiché');

-- ─── Appel d'un ticket précis (rejeu hors ligne) ─────────────────────────────
select tests.login_as('d5000000-0000-0000-0000-00000000000d');
insert into vals select 'ct1', public.call_ticket((select id from ids where name = 'cab3'), (select (v->>'id')::uuid from vals where name = 't4'),
  'f5000000-0000-0000-0000-000000000001');
select is((select (v->>'id', v->>'conflict') from vals where name = 'ct1'), ((select v->>'id' from vals where name = 't4'), 'false'::text),
  'le ticket choisi hors ligne est appelé');
select is(public.call_ticket((select id from ids where name = 'cab3'), (select (v->>'id')::uuid from vals where name = 't4'),
  'f5000000-0000-0000-0000-000000000001')->>'id', (select v->>'id' from vals where name = 'ct1'), 'commande rejouée : même résultat');
select public.mark_no_show((select (v->>'id')::uuid from vals where name = 't4'));
insert into vals select 'ct2', public.call_ticket((select id from ids where name = 'cab3'), (select (v->>'id')::uuid from vals where name = 't4'));
select is((select (v->>'conflict', v->>'requested_code') from vals where name = 'ct2'),
  ('true'::text, (select display_code from public.tickets where id = (select (v->>'id')::uuid from vals where name = 't4'))),
  'ticket déjà traité : conflit signalé avec le code demandé');
select ok((select v->>'id' from vals where name = 'ct2') is not null and (select v->>'id' from vals where name = 'ct2') <> (select v->>'id' from vals where name = 't4'),
  'et le prochain ticket disponible est appelé à la place');
select throws_ok($$ select public.call_ticket((select id from ids where name = 'cab3'), (select (v->>'id')::uuid from vals where name = 't1')) $$,
  'P0409', 'counter_busy', 'pas d''appel tant qu''un patient est alerté');

-- ─── Écritures directes, purge ───────────────────────────────────────────────
select throws_ok($$ insert into public.practitioner_absences (organization_id, branch_id, practitioner_id, kind)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), (select id from ids where name = 'nkeng'), 'absent') $$,
  '42501', null, 'absences : écriture directe interdite (RPC uniquement)');
select throws_ok($$ insert into public.notification_contacts (organization_id, branch_id, ticket_id, channel, consent_source, consent_at)
  values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), (select (v->>'id')::uuid from vals where name = 't3'),
          'whatsapp', 'customer_optin', now()) $$,
  '42501', null, 'contacts : écriture directe interdite');
select tests.logout();
update public.tickets set created_at = now() - interval '31 days' where id = (select (v->>'id')::uuid from vals where name = 't2');
select public.purge_personal_data();
select is((select count(*)::int from public.notification_contacts where ticket_id = (select (v->>'id')::uuid from vals where name = 't2')), 0,
  'numéro effacé après la durée de conservation');

select * from finish();
rollback;
