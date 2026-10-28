-- pgTAP — M6 (correctif) : derniers appels du tableau d'agence (écran TV), y compris les tickets terminés.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

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
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
-- now() est figé pendant la transaction : on recule l'heure d'appel du ticket alerté pour ordonner les appels.
create function tests.age_call(p_code text, p_minutes int) returns void language sql security definer as $$
  update public.tickets set called_at = now() - make_interval(mins => p_minutes)
  where display_code = p_code and branch_id = (select id from ids where name = 'akwa');
$$;
grant execute on function tests.age_call(text, int) to authenticated;

select tests.create_user('a6100000-0000-0000-0000-00000000000a', 'admin@m6-calls.test');
select tests.login_as('a6100000-0000-0000-0000-00000000000a');
insert into ids select 'clinic', public.create_organization('M6 Calls', 'pgtap-m6-calls', 'clinic');
insert into ids select 'akwa', public.create_branch((select id from ids where name = 'clinic'), 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'Consultation', 'C', 600);
insert into ids select 'consult', id from public.services where branch_id = (select id from ids where name = 'akwa');
insert into public.counters (organization_id, branch_id, kind, number)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), 'cabinet', 1);
insert into ids select 'cab1', id from public.counters where branch_id = (select id from ids where name = 'akwa');
insert into public.counter_services (organization_id, counter_id, service_id)
values ((select id from ids where name = 'clinic'), (select id from ids where name = 'cab1'), (select id from ids where name = 'consult'));
select public.reception_create_ticket((select id from ids where name = 'consult')) from generate_series(1, 5);

-- Un seul cabinet : alerte, admet et termine trois patients, puis alerte le quatrième.
select public.open_counter((select id from ids where name = 'cab1'));
select public.call_next((select id from ids where name = 'cab1'));
select tests.age_call('C-001', 9);
select public.admit_ticket((select id from public.tickets where display_code = 'C-001' and branch_id = (select id from ids where name = 'akwa')));
select public.call_next((select id from ids where name = 'cab1'), null, true);
select tests.age_call('C-002', 6);
select public.admit_ticket((select id from public.tickets where display_code = 'C-002' and branch_id = (select id from ids where name = 'akwa')));
select public.call_next((select id from ids where name = 'cab1'), null, true);
select tests.age_call('C-003', 3);
select public.mark_no_show((select id from public.tickets where display_code = 'C-003' and branch_id = (select id from ids where name = 'akwa')));
select public.call_next((select id from ids where name = 'cab1'));

select is((select jsonb_path_query_array(public.get_branch_board((select id from ids where name = 'akwa'))->'calls', '$[*].code')),
  '["C-004", "C-003", "C-002", "C-001"]'::jsonb, 'les appels terminés restent au tableau, du plus récent au plus ancien');
select is((select jsonb_path_query_array(public.get_branch_board((select id from ids where name = 'akwa'))->'calls', '$[*].status')),
  '["called", "no_show", "served", "served"]'::jsonb, 'statut de chaque appel (en cours, absent, servi)');
select is((select public.get_branch_board((select id from ids where name = 'akwa'))->'calls'->0->>'counter_number'), '1',
  'chaque appel garde son poste');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_branch_board((select id from ids where name = 'akwa'))->'calls'->1) k),
  array['called_at', 'code', 'counter_kind', 'counter_label', 'counter_number', 'recall_count', 'service_id', 'status'],
  'confidentialité : numéro, service et poste uniquement');

-- Fenêtre de 30 minutes pour les appels terminés ; un appel en cours reste affiché.
select tests.logout();
select tests.age_call('C-001', 31);
select tests.age_call('C-004', 45);
select tests.login_as('a6100000-0000-0000-0000-00000000000a');
select is((select jsonb_path_query_array(public.get_branch_board((select id from ids where name = 'akwa'))->'calls', '$[*].code')),
  '["C-003", "C-002", "C-004"]'::jsonb, 'appel terminé il y a plus de 30 minutes retiré ; appel en cours conservé');

-- Les tickets jamais appelés ou annulés n'apparaissent pas.
select public.cancel_ticket((select id from public.tickets where display_code = 'C-005' and branch_id = (select id from ids where name = 'akwa')));
select is((select count(*)::int from jsonb_array_elements(public.get_branch_board((select id from ids where name = 'akwa'))->'calls') c
  where c->>'code' = 'C-005'), 0, 'ticket annulé sans appel : absent du tableau');

-- Au plus 12 appels.
select tests.logout();
insert into public.tickets (organization_id, branch_id, service_id, number, display_code, source, status, counter_id, called_at, finished_at, service_day, sort_key)
select (select id from ids where name = 'clinic'), (select id from ids where name = 'akwa'), (select id from ids where name = 'consult'),
       100 + i, 'C-' || (100 + i), 'reception', 'served', (select id from ids where name = 'cab1'), now() - make_interval(secs => i), now(),
       public.branch_service_day((select id from ids where name = 'akwa')), 100 + i
from generate_series(1, 15) i;
select is(jsonb_array_length(public.branch_board((select id from ids where name = 'akwa'))->'calls'), 12, 'au plus 12 appels');
select is(public.branch_board((select id from ids where name = 'akwa'))->'calls'->0->>'code', 'C-101', 'les plus récents d''abord');

-- Appels d'un autre jour exclus.
update public.tickets set service_day = service_day - 1 where branch_id = (select id from ids where name = 'akwa') and number > 100;
select is((select jsonb_path_query_array(public.branch_board((select id from ids where name = 'akwa'))->'calls', '$[*].code')),
  '["C-003", "C-002", "C-004"]'::jsonb, 'appels des jours précédents exclus');
select ok(public.branch_board((select id from ids where name = 'akwa'))->'calls' @> '[{"status": "called"}]'::jsonb,
  'le patient alerté reste au tableau pour le héros de l''écran');

select * from finish();
rollback;
