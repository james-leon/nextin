-- pgTAP — M7 : notifications (mise en file, opt-in WhatsApp, STOP, statuts, SMS de secours, push, droits, purge).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(42);

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
grant usage on schema tests to authenticated, service_role;
grant execute on all functions in schema tests to authenticated, service_role;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to authenticated, service_role;

select tests.create_user('a7000000-0000-0000-0000-00000000000a', 'admin@m7-clinic.test');
select tests.create_user('b7000000-0000-0000-0000-00000000000b', 'admin@m7-eneo.test');
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M7 Clinic', 'pgtap-m7-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into public.specialties (organization_id, name) values ((select id from ids where name = 'clinic'), 'Médecine générale');
insert into public.practitioners (organization_id, branch_id, title, display_name, specialty_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Dr', 'Mbarga',
        (select id from public.specialties where organization_id = (select id from ids where name = 'clinic')));
insert into ids select 'mbarga', id from public.practitioners where organization_id = (select id from ids where name = 'clinic');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where branch_id = (select id from ids where name = 'akwa');
insert into public.counters (organization_id, branch_id, kind, number, default_practitioner_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1, (select id from ids where name = 'mbarga')),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 2, null);
insert into ids select 'cab' || number, id from public.counters where branch_id = (select id from ids where name = 'akwa');
insert into public.counter_services (organization_id, counter_id, service_id)
select (select id from ids where name = 'clinic'), id, (select id from ids where name = 'consult') from public.counters
where branch_id = (select id from ids where name = 'akwa');
-- Seuil « bientôt votre tour » : 1 personne devant.
update public.branch_settings set almost_turn_threshold = 1 where branch_id = (select id from ids where name = 'akwa');

-- Huit tickets : t1 avec un numéro saisi à l'accueil (accord du patient), t6 suivi par WhatsApp (opt-in client).
insert into vals select 't1', public.reception_create_ticket((select id from ids where name = 'consult'), null, null, null, '+237677000001', true, 'fr');
insert into vals select 't' || i, public.reception_create_ticket((select id from ids where name = 'consult')) from generate_series(2, 8) i;
select tests.login_as('b7000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M7 Eneo', 'pgtap-m7-eneo', 'utility');
select tests.logout();
create function tests.ticket(p_name text) returns uuid language sql as $$ select (v->>'id')::uuid from vals where name = p_name $$;
create function tests.job_count(p_ticket uuid, p_event text) returns int language sql security definer as $$
  select count(*)::int from public.notification_jobs where ticket_id = p_ticket and event::text = p_event;
$$;
create function tests.jobs(p_ticket uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(event::text || '/' || channel::text || '/' || status::text order by created_at, event), '{}')
  from public.notification_jobs where ticket_id = p_ticket;
$$;

-- ─── Mise en file ────────────────────────────────────────────────────────────
select is(tests.jobs(tests.ticket('t1')), array['ticket_confirmed/whatsapp/pending', 'almost_your_turn/whatsapp/skipped'],
  'numéro saisi à l''accueil : confirmation en file (premier de la file : « bientôt » couvert par la confirmation)');
select is(tests.jobs(tests.ticket('t2')), '{}'::text[], 'ticket sans contact : aucun message');

select tests.as_service();
select is((select v->>'status' from (select public.whatsapp_opt_in('237690000006', 'C-006', 'XXXX') v) x), 'not_found',
  'opt-in : suffixe du jeton erroné refusé');
insert into vals select 'optin', public.whatsapp_opt_in('237690000006', 'c-006',
  right((select public_token from public.tickets where id = tests.ticket('t6')), 4), 'en');
select is((select v->>'status' from vals where name = 'optin'), 'linked', 'opt-in : « NEXTIN C-006 xxxx » lie le numéro au ticket');
select is((select v->>'status' from (select public.whatsapp_opt_in('237690000006', 'C-006',
  right((select public_token from public.tickets where id = tests.ticket('t6')), 4), 'en') v) x), 'already', 'opt-in rejoué : déjà lié');
select tests.logout();
select is((select (channel, phone_e164, wa_id, locale, consent_source, window_expires_at > now() + interval '23 hours')::text
  from public.notification_contacts where ticket_id = tests.ticket('t6')),
  ('whatsapp', '+237690000006', '237690000006', 'en', 'customer_optin', true)::text, 'contact créé : consentement du client, fenêtre de 24 h');
select is(tests.jobs(tests.ticket('t6')), array['ticket_confirmed/whatsapp/pending'], 'opt-in : confirmation en file (une seule)');
select ok((public.ticket_view(tests.ticket('t6')) -> 'alerts' ->> 'whatsapp')::boolean, 'Mon ticket : alertes WhatsApp activées');
select ok(not (public.ticket_view(tests.ticket('t2')) -> 'alerts' ->> 'whatsapp')::boolean, 'ticket sans opt-in : alertes désactivées');

select tests.login_as('a7000000-0000-0000-0000-00000000000a');
select public.open_counter((select id from ids where name = 'cab2'));
insert into vals select 'c1', public.call_next((select id from ids where name = 'cab2'));
select is(tests.jobs(tests.ticket('t1')), array['ticket_confirmed/whatsapp/pending', 'almost_your_turn/whatsapp/skipped', 'your_turn/whatsapp/pending'],
  'alerte du patient : « c''est votre tour »');
select public.recall_ticket(tests.ticket('t1'));
select is(tests.job_count(tests.ticket('t1'), 'your_turn'), 2,
  'rappel : nouveau message');
select public.admit_ticket(tests.ticket('t1'));
select public.call_next((select id from ids where name = 'cab2'), null, true);
select public.mark_no_show(tests.ticket('t2'));
select public.call_next((select id from ids where name = 'cab2'));
select is(tests.jobs(tests.ticket('t6')), array['ticket_confirmed/whatsapp/pending'], 'deux personnes devant : pas encore');
select public.mark_no_show(tests.ticket('t3'));
select public.call_next((select id from ids where name = 'cab2'));
select is(tests.jobs(tests.ticket('t6')), array['ticket_confirmed/whatsapp/pending', 'almost_your_turn/whatsapp/pending'],
  'une personne devant : « bientôt votre tour »');
select public.move_back_ticket(tests.ticket('t6'), 1);
select public.move_back_ticket(tests.ticket('t7'), 1);
select is(tests.job_count(tests.ticket('t6'), 'almost_your_turn'), 1,
  '« bientôt votre tour » envoyé une seule fois');
select is(tests.job_count(tests.ticket('t6'), 'ticket_moved_back'), 1,
  'recul : message au patient');

-- Opt-in d'un ticket déjà proche : la confirmation suffit.
select tests.as_service();
select public.whatsapp_opt_in('237690000005', 'C-005', right((select public_token from public.tickets where id = tests.ticket('t5')), 4));
select tests.logout();
select is(tests.jobs(tests.ticket('t5')), array['ticket_confirmed/whatsapp/pending', 'almost_your_turn/whatsapp/skipped'],
  'opt-in d''un ticket déjà proche : la confirmation suffit');

-- Retard puis absence du praticien : patients attitrés prévenus.
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into vals select 't9', public.reception_create_ticket((select id from ids where name = 'consult'), null, null,
  (select id from ids where name = 'mbarga'), '+237677000009', true, 'fr');
select public.declare_practitioner_absence((select id from ids where name = 'mbarga'), 'late', now() + interval '20 minutes');
select tests.logout();
select is((select payload ? 'until' from public.notification_jobs where ticket_id = tests.ticket('t9') and event = 'practitioner_late'), true,
  'retard : message avec l''heure de retour');
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
select public.declare_practitioner_absence((select id from ids where name = 'mbarga'), 'absent');
select is(tests.job_count(tests.ticket('t9'), 'practitioner_rerouted'), 1,
  'absence : message de réorientation');

-- ─── Droits ──────────────────────────────────────────────────────────────────
select throws_ok($$ select public.claim_notification_jobs(10) $$, '42501', null, 'personnel : pas d''accès à l''expéditeur');
select throws_ok($$ select public.whatsapp_opt_in('237690000001', 'C-001', 'abcd') $$, '42501', null, 'personnel : pas d''opt-in direct');
select throws_ok($$ select * from public.notification_jobs $$, '42501', null, 'file d''envoi illisible pour le personnel');
select throws_ok($$ select * from public.whatsapp_opt_outs $$, '42501', null, 'STOP illisibles');
select throws_ok($$ select * from public.provider_webhook_events $$, '42501', null, 'webhooks illisibles');
select tests.login_as('b7000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.notification_contacts), 0, 'isolation : contacts d''un autre établissement invisibles');
select tests.logout();
select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.notification_jobs'::regclass, 'public.whatsapp_opt_outs'::regclass, 'public.provider_webhook_events'::regclass)), 'RLS activée');

-- ─── Expéditeur ──────────────────────────────────────────────────────────────
select tests.as_service();
insert into vals select 'claim', public.claim_notification_jobs(100);
select ok((select jsonb_array_length(v) >= 8 from vals where name = 'claim'), 'réservation des jobs dus');
select is((select count(*)::int from public.notification_jobs where status = 'pending' and ticket_id in (select tests.ticket(name) from vals where name ~ '^t')), 0,
  'jobs réservés (sending)');
select ok((select bool_and(j ? 'token' and j -> 'ticket' ? 'display_code' and j -> 'contact' ? 'locale') from vals, jsonb_array_elements(v) j where name = 'claim'),
  'chaque job porte le ticket, son lien et le contact');
select ok((select bool_and(not (j::text ~ '(customer|display_name|Mbarga)')) from vals, jsonb_array_elements(v) j where name = 'claim'),
  'aucun nom dans les données d''envoi');

insert into ids select 'job_turn', id from public.notification_jobs where ticket_id = tests.ticket('t1') and event = 'your_turn' order by created_at limit 1;
select public.complete_notification_job((select id from ids where name = 'job_turn'), 'sent', 'wamid.TEST1', null, null, 'cest_votre_tour',
  '{"text": "C''est votre tour"}');
select public.schedule_sms_fallback((select id from ids where name = 'job_turn'), 120, true);
select is((select (status, guard, next_attempt_at > now() + interval '100 seconds')::text from public.notification_jobs
  where fallback_of = (select id from ids where name = 'job_turn')), ('pending', true, true)::text, 'délai de garde SMS de 2 minutes programmé');
select public.whatsapp_message_status('wamid.TEST1', 'delivered');
select public.whatsapp_message_status('wamid.TEST1', 'sent');
select is((select status::text from public.notification_jobs where id = (select id from ids where name = 'job_turn')), 'delivered',
  'statuts : jamais de retour en arrière');
select public.whatsapp_message_status('wamid.TEST1', 'failed', 'Message undeliverable');
select is((select (status, guard, next_attempt_at <= now())::text from public.notification_jobs
  where fallback_of = (select id from ids where name = 'job_turn')), ('pending', false, true)::text, 'échec signalé : SMS de secours immédiat');
select public.complete_notification_job((select id from ids where name = 'job_turn'), 'failed', null, 'timeout', 60);
select is((select status::text from public.notification_jobs where id = (select id from ids where name = 'job_turn')), 'pending',
  'erreur temporaire : nouvel essai programmé');

select ok(public.record_webhook_event('whatsapp', 'wamid.X:delivered', '{}'), 'webhook : premier passage traité');
select ok(not public.record_webhook_event('whatsapp', 'wamid.X:delivered', '{}'), 'webhook rejoué : ignoré');

-- ─── STOP ────────────────────────────────────────────────────────────────────
update public.notification_jobs set status = 'pending' where ticket_id = tests.ticket('t6') and event = 'ticket_moved_back';
select public.whatsapp_set_opt_out('237690000006', true);
select is((select status::text from public.notification_jobs where ticket_id = tests.ticket('t6') and event = 'ticket_moved_back'), 'cancelled',
  'STOP : messages en attente annulés');
select ok(exists (select 1 from public.whatsapp_opt_outs where phone_hash = public.sha256_hex('+237690000006')), 'STOP : numéro haché conservé');
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
select public.move_back_ticket(tests.ticket('t6'), 1);
select tests.logout();
select is((select count(*)::int from public.notification_jobs where ticket_id = tests.ticket('t6') and status = 'pending'), 0,
  'après STOP : plus aucun message');

-- ─── Web push ────────────────────────────────────────────────────────────────
select tests.as_service();
select throws_ok(format($$ select public.register_push_contact(%L, '{"endpoint": "http://evil.test"}') $$,
  (select public_token from public.tickets where id = tests.ticket('t7'))), 'P0422', 'invalid_subscription', 'abonnement push invalide refusé');
select public.register_push_contact((select public_token from public.tickets where id = tests.ticket('t7')),
  '{"endpoint": "https://push.example.test/abc", "keys": {"p256dh": "k", "auth": "a"}}', 'fr');
select tests.logout();
select is(tests.jobs(tests.ticket('t7')), array['ticket_confirmed/push/pending', 'almost_your_turn/push/skipped'],
  'abonnement push : confirmation sur ce canal');

-- ─── Purge ───────────────────────────────────────────────────────────────────
update public.organizations set data_retention_days = 7 where id = (select id from ids where name = 'clinic');
update public.tickets set created_at = now() - interval '8 days' where organization_id = (select id from ids where name = 'clinic');
select public.purge_personal_data();
select is((select count(*)::int from public.notification_contacts where organization_id = (select id from ids where name = 'clinic')), 0,
  'purge : contacts supprimés');
select is((select count(*)::int from public.notification_jobs where organization_id = (select id from ids where name = 'clinic') and payload <> '{}'::jsonb), 0,
  'purge : textes envoyés effacés, statistiques conservées');

select * from finish();
rollback;
