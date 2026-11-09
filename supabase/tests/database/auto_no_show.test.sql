-- pgTAP — Absent automatique après l'appel : délai, recul, appel du suivant, annulation au 2e appel manqué,
-- rien avant l'appel, rappel qui relance le délai, ticket à distance exclu, réglage désactivé, droits.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(31);
alter table public.branch_settings alter column customer_name_mode set default 'optional';

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, now())
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
grant usage on schema tests to authenticated;
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.status(p_name text) returns text language sql security definer as $$
  select (status, missed_calls)::text from public.tickets where id = tests.id(p_name)
$$;
create function tests.pos(p_name text) returns integer language sql security definer as $$
  select public.ticket_position(tests.id(p_name))
$$;
-- Simule le temps écoulé depuis l'appel (now() est figé dans la transaction).
create function tests.age_call(p_name text, p_seconds integer) returns void language sql security definer as $$
  update public.tickets set called_at = now() - make_interval(secs => p_seconds) where id = tests.id(p_name)
$$;
create function tests.jobs(p_name text, p_event text) returns integer language sql security definer as $$
  select count(*)::integer from public.notification_jobs where ticket_id = tests.id(p_name) and event::text = p_event
$$;
create function tests.called_on(p_counter text) returns uuid language sql security definer as $$
  select id from public.tickets where counter_id = tests.id(p_counter) and status in ('called', 'serving')
$$;
grant execute on all functions in schema tests to authenticated;

-- ─── Données : clinique ouverte jour et nuit, un service, un cabinet ─────────
select tests.create_user('a7000000-0000-0000-0000-00000000000a', 'admin@noshow.test');
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into ids select 'org', public.create_organization('No-show Clinic', 'pgtap-noshow', 'clinic');
insert into ids select 'branch', public.create_branch(tests.id('org'), 'Akwa', null, 'Douala', null, null, null);
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('org'), tests.id('branch'), 'Consultation', 'C', 600);
insert into ids select 'svc', id from public.services where branch_id = tests.id('branch');
insert into public.counters (organization_id, branch_id, kind, number) values (tests.id('org'), tests.id('branch'), 'cabinet', 1);
insert into ids select 'cab', id from public.counters where branch_id = tests.id('branch');
insert into public.counter_services (organization_id, counter_id, service_id) values (tests.id('org'), tests.id('cab'), tests.id('svc'));
select tests.logout();
delete from public.opening_hours where branch_id = tests.id('branch');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.id('org'), tests.id('branch'), d, '00:00', '23:59:59' from generate_series(1, 7) d;

select is((select (auto_no_show_enabled, no_show_grace_seconds, no_show_move_back_places)::text
  from public.branch_settings where branch_id = tests.id('branch')), '(t,180,3)',
  'réglages par défaut : activé, 3 minutes, recul de 3 places');
select throws_ok($$ update public.branch_settings set no_show_grace_seconds = 10 where branch_id = tests.id('branch') $$,
  '23514', null, 'délai trop court refusé (30 s minimum)');
select throws_ok($$ update public.branch_settings set no_show_move_back_places = 0 where branch_id = tests.id('branch') $$,
  '23514', null, 'recul nul refusé');

-- W1 avec numéro WhatsApp (consentement à l'accueil), puis W2…W6.
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
insert into ids select 'W1', (public.reception_create_ticket(tests.id('svc'), null, null, null, '+237690000911', true) ->> 'id')::uuid;
insert into ids select 'W' || i, (public.reception_create_ticket(tests.id('svc')) ->> 'id')::uuid from generate_series(2, 6) i;
select tests.logout();

-- ─── Rien avant l'appel ──────────────────────────────────────────────────────
update public.tickets set created_at = now() - interval '2 hours' where branch_id = tests.id('branch');
select is(public.sweep_missed_calls(), 0, 'rien avant l''appel : un ticket en attente depuis longtemps n''est jamais reculé');
select is(tests.status('W1'), '(waiting,0)', 'W1 toujours en attente, en tête');

-- ─── Délai ───────────────────────────────────────────────────────────────────
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
select public.open_counter(tests.id('cab'));
select is(public.call_next(tests.id('cab')) ->> 'id', tests.id('W1')::text, 'W1 appelé');
select tests.logout();
select is(public.sweep_missed_calls(), 0, 'juste appelé : rien');
select tests.age_call('W1', 170);
select is(public.sweep_missed_calls(), 0, 'avant la fin du délai (170 s sur 180) : rien');
select is(tests.status('W1'), '(called,0)', 'W1 toujours appelé');

-- ─── Premier appel manqué : recul, message, appel du suivant ─────────────────
select tests.age_call('W1', 181);
select is(public.sweep_missed_calls(), 1, 'délai écoulé : un appel manqué traité');
select is(tests.status('W1'), '(waiting,1)', 'W1 de nouveau en attente, 1 appel manqué');
select is(tests.called_on('cab'), tests.id('W2'), 'le poste appelle automatiquement le suivant (W2)');
select is(tests.pos('W1'), 3, 'W1 reculé de 3 places (derrière W2, W3, W4) : W3 et W4 devant lui');
select is((select (payload ->> 'places')::int from public.ticket_events where ticket_id = tests.id('W1') and type = 'missed_call'), 3,
  'événement « appel manqué » journalisé (3 places)');
select is((select counter_id from public.ticket_events where ticket_id = tests.id('W1') and type = 'missed_call'), tests.id('cab'),
  'l''événement garde le poste qui a appelé');
select is(tests.jobs('W1', 'missed_call'), 1, 'client prévenu : « vous avez été appelé ; vous êtes replacé »');
select is(public.ticket_view(tests.id('W1')) ->> 'missed_calls', '1', 'Mon ticket : appel manqué visible du client');
select is(public.sweep_missed_calls(), 0, 'tâche rejouée : rien de plus');

-- ─── Un rappel relance le délai ──────────────────────────────────────────────
select tests.age_call('W2', 400);
update public.tickets set recalled_at = now() - interval '20 seconds' where id = tests.id('W2');
select is(public.sweep_missed_calls(), 0, 'rappel récent : le délai repart du dernier rappel');
select is(tests.status('W2'), '(called,0)', 'W2 toujours appelé');

-- ─── Deuxième appel du même ticket ───────────────────────────────────────────
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
select public.admit_ticket(tests.id('W2'));
select public.call_next(tests.id('cab'), null, true);
select public.admit_ticket(tests.id('W3'));
select public.call_next(tests.id('cab'), null, true);
select public.admit_ticket(tests.id('W4'));
select is(public.call_next(tests.id('cab'), null, true) ->> 'id', tests.id('W1')::text, 'W1 rappelé à son nouveau rang');
select tests.logout();
select is(tests.jobs('W1', 'your_turn'), 2, '« C''est votre tour » renvoyé au deuxième appel');
select tests.age_call('W1', 181);
select is(public.sweep_missed_calls(), 1, 'deuxième appel manqué traité');
select is(tests.status('W1'), '(no_show,2)', 'deuxième absence : W1 annulé définitivement (absent)');
select ok((select finished_at is not null from public.tickets where id = tests.id('W1')), 'W1 terminé');
select is((select payload ->> 'auto' from public.ticket_events where ticket_id = tests.id('W1') and type = 'no_show'), 'true',
  'absence automatique journalisée');
select is(tests.jobs('W1', 'missed_call_cancelled'), 1, 'client prévenu de l''annulation');
select is(tests.called_on('cab'), tests.id('W5'), 'le poste appelle le suivant (W5)');

-- ─── Ticket à distance : règles du M9, pas d'absence automatique ─────────────
update public.tickets set is_remote = true, presence_confirmed_at = now() where id = tests.id('W5');
select tests.age_call('W5', 600);
select is(public.sweep_missed_calls(), 0, 'ticket à distance appelé : jamais reculé ni annulé par cette règle');

-- ─── Réglage désactivé ───────────────────────────────────────────────────────
update public.tickets set is_remote = false where id = tests.id('W5');
update public.branch_settings set auto_no_show_enabled = false where branch_id = tests.id('branch');
select is(public.sweep_missed_calls(), 0, 'réglage désactivé : rien');

-- ─── Droits ──────────────────────────────────────────────────────────────────
select tests.login_as('a7000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.sweep_missed_calls() $$, '42501', null, 'tâche interdite au personnel');
select tests.logout();

select * from finish();
rollback;
