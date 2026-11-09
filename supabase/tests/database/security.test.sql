-- pgTAP — Sécurité transverse : RLS partout, aucune fonction ouverte à PUBLIC, rôle anonyme limité aux pages
-- publiques, chemins de recherche figés, droits par défaut, journaux inaltérables, appels hors ordre journalisés.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(16);
alter table public.branch_settings alter column customer_name_mode set default 'off';

-- ─── Base de données ─────────────────────────────────────────────────────────
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity), 0, 'RLS activée sur toutes les tables');
select is((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and array_to_string(p.proacl, ' ') ~ '(^| )=X'), null, 'aucune fonction exécutable par PUBLIC');
select is((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), null,
  'toute fonction SECURITY DEFINER fixe son chemin de recherche');
select ok(not exists (select 1 from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0
    and d.defaclobjtype = 'f' and array_to_string(d.defaclacl, ' ') ~ '(^| )=X')
  and exists (select 1 from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'),
  'nouvelles fonctions : EXECUTE retiré à PUBLIC par défaut');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['app_ad', 'branch_public', 'can_access_branch', 'can_manage_member', 'cancel_my_appointment_request', 'cancel_my_ticket',
    'confirm_presence', 'coupon_view', 'customer_identity_rules', 'effective_duration_seconds', 'estimate_wait_seconds',
    'finish_quiz', 'finish_sky_catch', 'game_session', 'games_available', 'get_appointment_request', 'get_branch_board',
    'get_invitation', 'get_ticket', 'has_org_role', 'is_anonymous', 'is_platform_admin', 'is_privileged_context',
    'nearby_branches', 'pay_invoice_view', 'rate_ticket', 'request_options', 'resolve_entry', 'set_remote_travel',
    'shares_org_with', 'signal_on_my_way', 'start_quiz', 'start_sky_catch', 'subscription_price', 'ticket_display_code',
    'verify_appointment_request'],
  'rôle anonyme : seulement les pages publiques et les contrôles de droits (liste fermée)');
select ok(not has_function_privilege('anon', 'public.call_next(uuid, uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.create_branch(uuid, text, text, text, text, double precision, double precision)', 'execute')
  and not has_function_privilege('anon', 'public.list_org_members(uuid)', 'execute'),
  'fonctions du personnel fermées au rôle anonyme (appel, agence, membres)');
select ok(has_function_privilege('authenticated', 'public.call_next(uuid, uuid, boolean)', 'execute'),
  'personnel : droits conservés (contrôlés dans la fonction)');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'update')
  and not has_table_privilege('authenticated', 'public.audit_log', 'delete')
  and not has_table_privilege('authenticated', 'public.ticket_events', 'delete'),
  'journaux : ni modification ni suppression');
select ok(not has_table_privilege('anon', 'public.ticket_identities', 'select')
  and not has_table_privilege('anon', 'public.appointment_requests', 'select'),
  'noms et demandes : jamais lisibles sans compte');

-- ─── Appels hors ordre ───────────────────────────────────────────────────────
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into auth.users (id, instance_id, aud, role, email, created_at)
values ('5ec00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@security.test', now());
select set_config('request.jwt.claims', json_build_object('sub', '5ec00000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into ids select 'org', public.create_organization('Sécurité Clinique', 'pgtap-security', 'clinic');
insert into ids select 'branch', public.create_branch((select id from ids where name = 'org'), 'Akwa');
select set_config('role', 'postgres', true);
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
select (select id from ids where name = 'org'), (select id from ids where name = 'branch'), 'Consultation', 'C', 600;
insert into public.counters (organization_id, branch_id, kind, number)
select (select id from ids where name = 'org'), (select id from ids where name = 'branch'), 'cabinet', 1;
insert into ids select 'counter', id from public.counters where branch_id = (select id from ids where name = 'branch');
insert into public.counter_services (organization_id, counter_id, service_id)
select (select id from ids where name = 'org'), (select id from ids where name = 'counter'), s.id from public.services s
where s.branch_id = (select id from ids where name = 'branch');
delete from public.opening_hours where branch_id = (select id from ids where name = 'branch');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select (select id from ids where name = 'org'), (select id from ids where name = 'branch'), d, '00:00', '23:59:59' from generate_series(1, 7) d;
select set_config('role', 'authenticated', true);
insert into ids select 'T' || i, (public.reception_create_ticket((select id from public.services where branch_id = (select id from ids where name = 'branch'))) ->> 'id')::uuid
from generate_series(1, 3) i;
select public.open_counter((select id from ids where name = 'counter'));

select is(public.call_ticket((select id from ids where name = 'counter'), (select id from ids where name = 'T3')) ->> 'id',
  (select id from ids where name = 'T3')::text, 'appel d''un ticket précis : fait');
select set_config('role', 'postgres', true);
select is((select (diff ->> 'ahead')::int from public.audit_log where action = 'ticket.call_out_of_order' and entity_id = (select id from ids where name = 'T3')), 2,
  'appel hors ordre journalisé (2 tickets passaient avant)');
select ok((select not (diff ? 'customer_label') and not (diff::text ilike '%nom%') from public.audit_log
  where action = 'ticket.call_out_of_order' limit 1), 'journal : aucun nom de client');
select set_config('role', 'authenticated', true);
select public.admit_ticket((select id from ids where name = 'T3'));
select public.finish_ticket((select id from ids where name = 'T3'));
select is(public.call_ticket((select id from ids where name = 'counter'), (select id from ids where name = 'T1')) ->> 'id',
  (select id from ids where name = 'T1')::text, 'appel dans l''ordre');
select set_config('role', 'postgres', true);
select is((select count(*)::integer from public.audit_log where action = 'ticket.call_out_of_order' and entity_id = (select id from ids where name = 'T1')), 0,
  'appel dans l''ordre : pas d''entrée hors ordre');

-- Un visiteur anonyme ne peut pas appeler un ticket.
select set_config('role', 'anon', true);
select throws_ok($$ select public.call_next((select id from ids where name = 'counter')) $$, '42501', null,
  'rôle anonyme : appel refusé par la base (droit d''exécution)');
select set_config('role', 'postgres', true);
select ok(exists (select 1 from public.ticket_events e where e.ticket_id = (select id from ids where name = 'T3') and e.type = 'called'
  and e.actor_user_id = '5ec00000-0000-0000-0000-00000000000a'), 'chaque appel garde son auteur (ticket_events)');

select * from finish();
rollback;
