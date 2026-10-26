-- pgTAP — M3 : moteur de file d'attente (numérotation, appel en deux temps, estimation, idempotence, RLS, purges).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(114);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anonymous boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, last_sign_in_at, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          case when p_anonymous then null else p_email end, p_anonymous, now(), now(),
          jsonb_build_object('full_name', split_part(p_email, '@', 1)))
  returning id;
$$;
create function tests.login_as(p_id uuid, p_anonymous boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
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
-- Détail (DETAIL) de l'erreur levée par une requête, ou null.
create function tests.error_detail(p_sql text) returns text language plpgsql as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail;
end $$;
-- Exécute une requête en ignorant son erreur éventuelle (pour consommer un quota).
create function tests.try(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end $$;
grant usage on schema tests to authenticated, anon, service_role;
grant execute on all functions in schema tests to authenticated, anon, service_role;

create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v text) on commit drop;
grant all on ids, vals to authenticated, anon, service_role;

-- ─── Mise en place ───────────────────────────────────────────────────────────
select tests.create_user('a3000000-0000-0000-0000-00000000000a', 'admin@m3-clinic.test');
select tests.create_user('b3000000-0000-0000-0000-00000000000b', 'admin@m3-eneo.test');
select tests.create_user('d3000000-0000-0000-0000-00000000000d', 'agent@m3-clinic.test');
select tests.create_user('e3000000-0000-0000-0000-000000000001', 'c1@m3.test', true);
select tests.create_user('e3000000-0000-0000-0000-000000000002', 'c2@m3.test', true);
select tests.create_user('e3000000-0000-0000-0000-000000000003', 'c3@m3.test', true);
select tests.create_user('e3000000-0000-0000-0000-000000000004', 'c4@m3.test', true);
select tests.create_user('e3000000-0000-0000-0000-000000000005', 'c5@m3.test', true);
select tests.create_user('e3000000-0000-0000-0000-000000000006', 'c6@m3.test', true);

select tests.login_as('a3000000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M3 Clinic', 'pgtap-m3-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', 600),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Laboratoire', 'L', 300),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Caisse', 'K', 120);
insert into ids select 'consult', id from public.services where prefix = 'C' and branch_id = (select id from ids where name = 'akwa');
insert into ids select 'lab', id from public.services where prefix = 'L' and branch_id = (select id from ids where name = 'akwa');
insert into ids select 'cash', id from public.services where prefix = 'K' and branch_id = (select id from ids where name = 'akwa');
insert into public.counters (organization_id, branch_id, kind, number)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 2),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'laboratoire', 1);
insert into ids select 'cab1', id from public.counters where branch_id = (select id from ids where name = 'akwa') and kind = 'cabinet' and number = 1;
insert into ids select 'cab2', id from public.counters where branch_id = (select id from ids where name = 'akwa') and kind = 'cabinet' and number = 2;
insert into ids select 'lab1', id from public.counters where branch_id = (select id from ids where name = 'akwa') and kind = 'laboratoire';
insert into public.counter_services (organization_id, counter_id, service_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'cab1'), (select id from ids where name = 'consult')),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'cab2'), (select id from ids where name = 'consult')),
       ((select id from ids where name = 'clinic'), (select id from ids where name = 'lab1'), (select id from ids where name = 'lab'));

select tests.login_as('b3000000-0000-0000-0000-00000000000b');
insert into ids select 'eneo', public.create_organization('M3 Eneo', 'pgtap-m3-eneo', 'utility');
insert into ids select 'bonanjo', public.create_branch((select id from ids where name = 'eneo'), 'Bonanjo');

select tests.logout();
insert into public.memberships (organization_id, user_id, role, branch_id)
values ((select id from ids where name = 'clinic'), 'd3000000-0000-0000-0000-00000000000d', 'agent', (select id from ids where name = 'akwa'));
-- Agence ouverte toute la journée, tous les jours (le test ne dépend pas de l'heure d'exécution).
delete from public.opening_hours where branch_id = (select id from ids where name = 'akwa');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select (select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), d, '00:00', '23:59:59'
from generate_series(1, 7) d;
update public.services set allow_priority = false where id = (select id from ids where name = 'lab');
insert into vals select 'qr', token from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active;
insert into vals select 'short', short_code from public.qr_codes where branch_id = (select id from ids where name = 'akwa') and active;
insert into vals select 'eneo_qr', token from public.qr_codes where branch_id = (select id from ids where name = 'bonanjo') and active;

-- ─── Estimation (parité avec packages/shared/src/queue/estimate.fixtures.json) ─
select is(public.estimate_wait_seconds(0, array[600]::numeric[], array[0]::numeric[]), 0, 'estimation : personne devant, poste libre');
select is(public.estimate_wait_seconds(0, array[600]::numeric[], array[240]::numeric[]), 240, 'estimation : personne devant, poste occupé');
select is(public.estimate_wait_seconds(3, array[600]::numeric[], array[0]::numeric[]), 1800, 'estimation : trois devant, un poste');
select is(public.estimate_wait_seconds(3, array[600]::numeric[], array[120]::numeric[]), 1920, 'estimation : trois devant, poste occupé');
select is(public.estimate_wait_seconds(4, array[600, 600]::numeric[], array[0, 0]::numeric[]), 1200, 'estimation : deux postes en parallèle');
select is(public.estimate_wait_seconds(5, array[600, 300]::numeric[], array[0, 0]::numeric[]), 900, 'estimation : postes de vitesses différentes');
select is(public.estimate_wait_seconds(6, array[900, 600, 300]::numeric[], array[450, 0, 100]::numeric[]), 1000, 'estimation : trois postes occupés');
select is(public.estimate_wait_seconds(10, array[180, 240]::numeric[], array[60, 200]::numeric[]), 1140, 'estimation : file longue');
select is(public.estimate_wait_seconds(1, array[720]::numeric[], array[800]::numeric[]), 1520, 'estimation : client en cours au-delà de la durée');
select is(public.effective_duration_seconds(600, 300, 5), 600::numeric, 'durée par défaut tant que moins de 10 mesures');
select is(public.effective_duration_seconds(600, 300, 20), 450::numeric, 'durée mélangée entre 10 et 30 mesures');
select is(public.effective_duration_seconds(600, 300, 30), 300::numeric, 'durée mesurée au-delà de 30 mesures');
select is(public.ticket_display_code('C', 47), 'C-047', 'format du numéro de ticket');

-- ─── Prise de ticket (serveur uniquement) ────────────────────────────────────
select tests.as_anon();
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000001') $$, '42501', null, 'take_ticket interdit aux visiteurs');
select tests.login_as('e3000000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000001') $$, '42501', null, 'take_ticket interdit aux sessions (passe par le serveur)');

select tests.as_service();
insert into vals select 'c1', public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000001')->>'public_token';
select is((select display_code from public.tickets where public_token = (select v from vals where name = 'c1')), 'C-001',
  'premier ticket du jour : C-001');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000001') $$, 'P0422', 'active_ticket_exists', 'un client ne cumule pas les tickets');
select is(tests.error_detail($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000001') $$), (select v from vals where name = 'c1'), 'le ticket actif est rendu au client');
insert into vals select 'c2', public.take_ticket((select id from ids where name = 'consult'), 'short_code', lower((select v from vals where name = 'short')),
  'pregnancy', 'e3000000-0000-0000-0000-000000000002')->>'public_token';
select is((select (display_code, priority_level, source::text) from public.tickets where public_token = (select v from vals where name = 'c2')),
  ('C-002'::text, 1::smallint, 'short_code'::text), 'code court accepté (casse ignorée), priorité grossesse');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'eneo_qr'), null,
  'e3000000-0000-0000-0000-000000000003') $$, 'P0422', 'invalid_entry', 'le QR d''une autre agence est refusé');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'remote', null, null,
  'e3000000-0000-0000-0000-000000000003') $$, 'P0422', 'remote_not_allowed', 'ticket à distance refusé si désactivé');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'reception', null, null,
  'e3000000-0000-0000-0000-000000000003') $$, 'P0422', 'invalid_entry', 'la source « accueil » est réservée au personnel');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'lab'), 'qr', (select v from vals where name = 'qr'), 'elderly',
  'e3000000-0000-0000-0000-000000000003') $$, 'P0422', 'priority_not_allowed', 'priorité refusée sur un service qui ne l''autorise pas');
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  null) $$, '42501', null, 'un client identifié (session anonyme) est requis');
insert into vals select 'l1', public.take_ticket((select id from ids where name = 'lab'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000003')->>'public_token';
select is((select display_code from public.tickets where public_token = (select v from vals where name = 'l1')), 'L-001',
  'chaque service a sa propre numérotation');
select is(public.next_ticket_number((select id from ids where name = 'lab'), current_date + 1), 1, 'la numérotation repart à 1 chaque jour');

select tests.logout();
update public.services set max_daily_tickets = 1 where id = (select id from ids where name = 'lab');
select tests.as_service();
select throws_ok($$ select public.take_ticket((select id from ids where name = 'lab'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000004') $$, 'P0410', 'quota_reached', 'quota journalier du service atteint');
select tests.logout();
update public.services set max_daily_tickets = null, active = false where id = (select id from ids where name = 'lab');
select tests.as_service();
select throws_ok($$ select public.take_ticket((select id from ids where name = 'lab'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000004') $$, 'P0410', 'service_closed', 'service désactivé');
select tests.logout();
update public.services set active = true where id = (select id from ids where name = 'lab');
insert into public.branch_closures (organization_id, branch_id, date)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), (now() at time zone 'Africa/Douala')::date);
select tests.as_service();
select throws_ok($$ select public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000004') $$, 'P0410', 'branch_closed', 'agence fermée (fermeture exceptionnelle)');
select tests.logout();
delete from public.branch_closures where branch_id = (select id from ids where name = 'akwa');

select tests.as_service();
select is((select count(*)::int from generate_series(1, 10) g where public.throttle_ticket_request('e3000000-0000-0000-0000-000000000005', 'ip-b')), 10,
  'jusqu''à 10 demandes par heure et par client');
select is(public.throttle_ticket_request('e3000000-0000-0000-0000-000000000005', 'ip-b'), false, 'au-delà, les demandes sont refusées');
select tests.logout();

-- ─── Accueil ─────────────────────────────────────────────────────────────────
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
insert into ids select 'r1', (public.reception_create_ticket((select id from ids where name = 'consult'), null,
  'f3000000-0000-0000-0000-000000000001')->>'id')::uuid;
select is((select (display_code, source::text, customer_user_id is null) from public.tickets where id = (select id from ids where name = 'r1')),
  ('C-003'::text, 'reception'::text, true), 'ticket créé à l''accueil, sans client rattaché');
select is((public.reception_create_ticket((select id from ids where name = 'consult'), null, 'f3000000-0000-0000-0000-000000000001')->>'id')::uuid,
  (select id from ids where name = 'r1'), 'commande rejouée : même ticket');
select is((select count(*)::int from public.tickets where service_id = (select id from ids where name = 'consult')), 3,
  'le rejeu ne crée pas de doublon');
select tests.login_as('b3000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.reception_create_ticket((select id from ids where name = 'consult')) $$, '42501', null,
  'un autre établissement ne crée pas de ticket');
select tests.login_as('e3000000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.reception_create_ticket((select id from ids where name = 'consult')) $$, '42501', null,
  'une session anonyme n''a pas les droits du personnel');

-- ─── Lecture (RLS) ───────────────────────────────────────────────────────────
select is((select count(*)::int from public.tickets), 1, 'un client ne voit que son ticket');
select is((select count(*)::int from public.ticket_events), 0, 'un client ne lit pas le journal des tickets');
select throws_ok($$ update public.tickets set status = 'served' $$, '42501', null, 'aucune écriture directe sur les tickets');
select tests.login_as('b3000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.tickets), 0, 'isolation : un autre établissement ne voit aucun ticket');
select is((select count(*)::int from public.ticket_events), 0, 'isolation : ni leur journal');
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.tickets), 4, 'le personnel de l''agence voit ses tickets');
select is((select count(*)::int from public.ticket_events where type = 'created'), 4, 'chaque création est journalisée');
select tests.as_anon();
select throws_ok($$ select count(*) from public.tickets $$, '42501', null, 'les visiteurs ne lisent pas la table des tickets');

-- ─── Postes ──────────────────────────────────────────────────────────────────
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.call_next((select id from ids where name = 'cab1')) $$, 'P0409', 'counter_not_open',
  'un poste fermé n''appelle pas');
select is(public.open_counter((select id from ids where name = 'cab1'))->>'status', 'open', 'ouverture du poste');
select is((select current_agent_id from public.counters where id = (select id from ids where name = 'cab1')),
  'd3000000-0000-0000-0000-00000000000d'::uuid, 'l''agent est rattaché au poste ouvert');
select tests.login_as('b3000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.call_next((select id from ids where name = 'cab1')) $$, '42501', null,
  'un autre établissement ne pilote pas le poste');
select throws_ok($$ select public.open_counter((select id from ids where name = 'cab2')) $$, '42501', null,
  'ni ne l''ouvre');

-- ─── Appel en deux temps ─────────────────────────────────────────────────────
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
insert into vals select 'call1', public.call_next((select id from ids where name = 'cab1'))::text;
select is((select v::jsonb->>'display_code' from vals where name = 'call1'), 'C-002', '« Alerter le suivant » : le ticket prioritaire passe d''abord');
select is((select (status::text, called_at is not null, serving_started_at is null) from public.tickets where display_code = 'C-002'
  and service_id = (select id from ids where name = 'consult')), ('called'::text, true, true), 'ticket alerté, chrono non démarré');
select throws_ok($$ select public.call_next((select id from ids where name = 'cab1')) $$, 'P0409', 'counter_busy',
  'pas de nouvel appel tant que le patient alerté n''est pas admis');
select throws_ok($$ select public.call_next((select id from ids where name = 'cab1'), null, true) $$, 'P0409', 'counter_busy',
  '« Terminer et alerter » refusé si le patient n''est qu''alerté');
select is((public.recall_ticket(((select v::jsonb->>'id' from vals where name = 'call1'))::uuid)->>'recall_count')::int, 1, 'rappel du patient');
select throws_ok($$ select public.finish_ticket(((select v::jsonb->>'id' from vals where name = 'call1'))::uuid) $$, 'P0409', 'invalid_state',
  'on ne termine pas un patient non admis');
select is(public.admit_ticket(((select v::jsonb->>'id' from vals where name = 'call1'))::uuid)->>'status', 'serving', '« Admettre » : patient en consultation');
select ok((select serving_started_at is not null from public.tickets where id = ((select v::jsonb->>'id' from vals where name = 'call1'))::uuid),
  'le chrono démarre à l''admission');
select throws_ok($$ select public.admit_ticket(((select v::jsonb->>'id' from vals where name = 'call1'))::uuid) $$, 'P0409', 'invalid_state',
  'admission déjà faite');
select throws_ok($$ select public.recall_ticket(((select v::jsonb->>'id' from vals where name = 'call1'))::uuid) $$, 'P0409', 'invalid_state',
  'pas de rappel après l''admission');
select throws_ok($$ select public.pause_counter((select id from ids where name = 'cab1')) $$, 'P0409', 'counter_busy',
  'pas de pause pendant une consultation');

-- Tableau public pendant la consultation
select tests.as_anon();
select is((select (c->>'code', c->>'status', c->>'counter_number') from jsonb_array_elements(public.get_branch_board((select id from ids where name = 'akwa'))->'calls') c),
  ('C-002'::text, 'serving'::text, '1'::text), 'le tableau public affiche le ticket et son poste');
select is((select s->'waiting' from jsonb_array_elements(public.get_branch_board((select id from ids where name = 'akwa'))->'services') s where s->>'prefix' = 'C'),
  '["C-001", "C-003"]'::jsonb, 'file d''attente publique dans l''ordre de passage');
select ok(public.get_branch_board((select id from ids where name = 'akwa'))::text !~ 'e3000000', 'aucun identifiant de client sur le tableau');
select is((select (s->>'wait_seconds')::int from jsonb_array_elements(public.get_branch_board((select id from ids where name = 'akwa'))->'services') s where s->>'prefix' = 'C'),
  1800, 'attente estimée d''un nouveau venu : poste occupé (10 min) puis deux patients devant');

-- Fin du passage : durée mesurée de l'admission à la fin
select tests.logout();
update public.tickets set serving_started_at = now() - interval '300 seconds'
where id = ((select v::jsonb->>'id' from vals where name = 'call1'))::uuid;
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select is(public.finish_ticket(((select v::jsonb->>'id' from vals where name = 'call1'))::uuid)->>'status', 'served', 'fin de consultation');
select tests.logout();
select is((select (ewma_seconds, samples) from public.service_time_stats where service_id = (select id from ids where name = 'consult') and counter_id is null),
  (300::numeric, 1), 'durée mesurée enregistrée pour le service');
select is((select samples from public.service_time_stats where service_id = (select id from ids where name = 'consult')
  and counter_id = (select id from ids where name = 'cab1')), 1, 'et pour le poste');
select public.record_service_duration((select id from ids where name = 'clinic'), (select id from ids where name = 'consult'), null, 10);
select is((select samples from public.service_time_stats where service_id = (select id from ids where name = 'consult') and counter_id is null), 1,
  'les passages de moins de 20 s sont ignorés');
select public.record_service_duration((select id from ids where name = 'clinic'), (select id from ids where name = 'consult'), null, 400);
select is((select ewma_seconds from public.service_time_stats where service_id = (select id from ids where name = 'consult') and counter_id is null),
  320::numeric, 'moyenne mobile exponentielle (alpha 0,2)');

-- Idempotence d'« Alerter le suivant »
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
insert into vals select 'call2', public.call_next((select id from ids where name = 'cab1'), 'f3000000-0000-0000-0000-000000000002')::text;
select is((select v::jsonb->>'display_code' from vals where name = 'call2'), 'C-001', 'puis l''ordre d''arrivée');
select is(public.call_next((select id from ids where name = 'cab1'), 'f3000000-0000-0000-0000-000000000002')->>'id',
  (select v::jsonb->>'id' from vals where name = 'call2'), 'commande rejouée après coupure : même ticket, pas de nouvel appel');
select is((select count(*)::int from public.tickets where counter_id = (select id from ids where name = 'cab1') and status = 'called'), 1,
  'un seul ticket alerté au poste');
-- Unicité garantie par la base, même hors RPC
select tests.logout();
select throws_ok($$ update public.tickets set status = 'called', counter_id = (select id from ids where name = 'cab1')
  where service_id = (select id from ids where name = 'consult') and status = 'waiting' $$, '23505', null,
  'un poste n''a jamais deux tickets alertés');

select tests.login_as('b3000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.admit_ticket(((select v::jsonb->>'id' from vals where name = 'call2'))::uuid) $$, '42501', null,
  'un autre établissement n''admet pas le patient');
select throws_ok($$ select public.call_next((select id from ids where name = 'cab1'), 'f3000000-0000-0000-0000-000000000002') $$, '42501', null,
  'le rejeu revérifie les droits');
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select is(public.mark_no_show(((select v::jsonb->>'id' from vals where name = 'call2'))::uuid, 'f3000000-0000-0000-0000-000000000003')->>'status',
  'no_show', 'patient absent');
select is(public.mark_no_show(((select v::jsonb->>'id' from vals where name = 'call2'))::uuid, 'f3000000-0000-0000-0000-000000000003')->>'status',
  'no_show', 'commande d''absence rejouée sans erreur');

-- « Terminer et alerter le suivant »
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
insert into vals select 'call3', public.call_next((select id from ids where name = 'cab1'))::text;
select public.admit_ticket(((select v::jsonb->>'id' from vals where name = 'call3'))::uuid);
select is(public.call_next((select id from ids where name = 'cab1'), null, true), null::jsonb, 'file vide : rien à alerter');
select is((select status::text from public.tickets where id = ((select v::jsonb->>'id' from vals where name = 'call3'))::uuid), 'served',
  'le patient admis est terminé avant l''appel');

-- ─── Réorientation, priorité, recul ──────────────────────────────────────────
select tests.logout();
select tests.as_service();
insert into vals select 'c4', public.take_ticket((select id from ids where name = 'consult'), 'qr', (select v from vals where name = 'qr'), null,
  'e3000000-0000-0000-0000-000000000004')->>'public_token';
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
insert into ids select 'c4', id from public.tickets where public_token = (select v from vals where name = 'c4');
select throws_ok($$ select public.transfer_ticket((select id from ids where name = 'c4'), (select id from ids where name = 'consult')) $$,
  'P0422', 'invalid_entry', 'réorientation vers le même service refusée');
insert into vals select 't4', public.transfer_ticket((select id from ids where name = 'c4'), (select id from ids where name = 'lab'))::text;
select is((select (status::text, public_token is null) from public.tickets where id = (select id from ids where name = 'c4')),
  ('transferred'::text, true), 'l''ancien ticket est clos');
select is((select (display_code, public_token, transferred_from_id) from public.tickets where id = ((select v::jsonb->>'id' from vals where name = 't4'))::uuid),
  ('L-002'::text, (select v from vals where name = 'c4'), (select id from ids where name = 'c4')), 'le lien du client suit le nouveau ticket');
select is((select n.sort_key = o.sort_key from public.tickets n, public.tickets o
  where n.id = ((select v::jsonb->>'id' from vals where name = 't4'))::uuid and o.id = (select id from ids where name = 'c4')), true,
  'l''ancienneté est conservée');

insert into ids select 'k' || g, (public.reception_create_ticket((select id from ids where name = 'cash'))->>'id')::uuid from generate_series(1, 3) g;
select public.move_back_ticket((select id from ids where name = 'k1'), 1);
select is(array(select display_code from public.tickets where service_id = (select id from ids where name = 'cash') and status = 'waiting'
  order by priority_level desc, sort_key, number), array['K-002', 'K-001', 'K-003'], 'recul d''une place');
select tests.logout();
select is(public.ticket_position((select id from ids where name = 'k1')), 2, 'position recalculée');
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select is(public.set_ticket_priority((select id from ids where name = 'k3'), 'elderly')->>'priority_reason', 'elderly', 'priorité donnée par l''accueil');
select tests.logout();
select is(public.ticket_position((select id from ids where name = 'k3')), 1, 'le ticket prioritaire passe en tête');
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select tests.logout();
select ok(exists (select 1 from public.audit_log where action = 'ticket.priority_change' and entity_id = (select id from ids where name = 'k3')),
  'changement de priorité journalisé');
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.move_back_ticket((select id from ids where name = 'k1'), 0) $$, 'P0409', 'invalid_state', 'recul de 1 à 50 places');

-- Pause : les patients attitrés reviennent dans la file commune
select public.open_counter((select id from ids where name = 'cab2'));
select tests.logout();
insert into ids select 'pref', (public.insert_ticket((select id from ids where name = 'consult'), 'reception', null, null, null)).id;
update public.tickets set preferred_counter_id = (select id from ids where name = 'cab2') where id = (select id from ids where name = 'pref');
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select is(public.call_next((select id from ids where name = 'cab1')), null::jsonb, 'un patient attitré n''est pas pris par un autre poste ouvert');
select public.pause_counter((select id from ids where name = 'cab2'));
select is((select preferred_counter_id from public.tickets where id = (select id from ids where name = 'pref')), null::uuid,
  'pause : le patient attitré revient dans la file commune');
select is(public.call_next((select id from ids where name = 'cab1'))->>'id', (select id::text from ids where name = 'pref'),
  'et un autre poste peut l''appeler');

-- ─── Surface publique ────────────────────────────────────────────────────────
select tests.as_anon();
select throws_ok($$ select public.call_next((select id from ids where name = 'cab1')) $$, '42501', null, 'les visiteurs ne pilotent pas les postes');
select is(public.get_ticket((select v from vals where name = 'c4'))->>'display_code', 'L-002', 'suivi du ticket par son lien');
select is((public.get_ticket((select v from vals where name = 'c4'))->>'position')::int, 2, 'position du client');
select ok(not (public.get_ticket((select v from vals where name = 'c4')) ? 'customer_user_id'), 'aucune donnée personnelle dans la vue client');
select is(public.get_ticket('AAAAAAAAAAAAAAAAAAAAAA'), null::jsonb, 'jeton inconnu');
select is(public.resolve_entry(lower((select v from vals where name = 'short')))->'branch'->>'name', 'Akwa', 'entrée par code court');
select is(public.resolve_entry('ZZZZZZ'), null::jsonb, 'code d''entrée inconnu');
select throws_ok($$ select public.rate_ticket((select v from vals where name = 'c4'), 5::smallint) $$, 'P0409', 'invalid_state',
  'pas d''avis avant la fin du passage');
select is(public.cancel_my_ticket((select v from vals where name = 'c4'))->>'status', 'cancelled', 'le client annule son ticket');
select throws_ok($$ select public.cancel_my_ticket((select v from vals where name = 'c4')) $$, 'P0409', 'invalid_state', 'annulation unique');
select is((public.rate_ticket((select v from vals where name = 'c2'), 5::smallint, '  Très bien  ')->>'rating')::int, 5, 'avis du client');
select throws_ok($$ select public.rate_ticket((select v from vals where name = 'c2'), 4::smallint) $$, 'P0409', 'already_rated', 'un seul avis');

-- ─── Temps réel ──────────────────────────────────────────────────────────────
select tests.login_as('d3000000-0000-0000-0000-00000000000d');
select ok(public.can_access_branch_topic('staff:branch:' || (select id from ids where name = 'akwa')), 'canal privé ouvert au personnel de l''agence');
select tests.login_as('b3000000-0000-0000-0000-00000000000b');
select ok(not public.can_access_branch_topic('staff:branch:' || (select id from ids where name = 'akwa')), 'canal privé fermé aux autres établissements');
select ok(not public.can_access_branch_topic('branch:x'), 'nom de canal invalide refusé');
select tests.logout();
select ok(exists (select 1 from realtime.messages where topic = 'branch:' || (select id from ids where name = 'akwa') || ':board' and not private),
  'le tableau est diffusé sur le canal public de l''agence');
select ok(exists (select 1 from realtime.messages where topic = 'ticket:' || (select v from vals where name = 'c2')),
  'le ticket est diffusé sur le canal de son jeton');

-- ─── Tâches planifiées ───────────────────────────────────────────────────────
update public.tickets set service_day = service_day - 1 where id = (select id from ids where name = 'k1');
select ok(public.expire_stale_tickets() >= 1, 'les tickets de la veille sont clôturés');
select is((select status::text from public.tickets where id = (select id from ids where name = 'k1')), 'cancelled', 'ticket expiré annulé');
update public.tickets set created_at = now() - interval '31 days' where public_token = (select v from vals where name = 'c2');
select ok(public.purge_personal_data() >= 1, 'purge après la durée de conservation');
select is((select (public_token, customer_user_id, rating_comment, rating) from public.tickets where display_code = 'C-002'
  and service_id = (select id from ids where name = 'consult')), (null::text, null::uuid, null::text, 5::smallint),
  'jeton, compte et commentaire effacés ; la note anonyme reste');
update auth.users set last_sign_in_at = now() - interval '30 days', created_at = now() - interval '30 days'
where id in ('e3000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000006');
select public.purge_inactive_anonymous_users();
select is((select array_agg(id::text order by id) from auth.users where id in ('e3000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000006')),
  array['e3000000-0000-0000-0000-000000000003'], 'un compte anonyme qui suit un ticket actif n''est pas purgé');

select * from finish();
rollback;
