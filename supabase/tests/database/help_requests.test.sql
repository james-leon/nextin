-- pgTAP — C3 : « Demander de l'aide » depuis la page du ticket. Ticket en cours seulement, une demande toutes les
-- 5 minutes, lue par le personnel de l'agence (pas par un autre établissement), « Traité » à l'accueil ; la table des
-- tickets n'est pas modifiée (rien vers l'écran TV).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(11);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
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
create temp table vals (name text primary key, v text) on commit drop;
grant all on vals to authenticated, anon;
create function tests.v(p_name text) returns text language sql as $$ select v from vals where name = p_name $$;
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('9d000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@aide.test', now()),
  ('9d000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@aide.test', now());
select tests.login_as('9d000000-0000-0000-0000-0000000000a1');
insert into vals select 'org', public.create_organization('Clinique Aide A', 'pgtap-aide-a', 'clinic')::text;
insert into vals select 'branch', public.create_branch(tests.v('org')::uuid, 'Akwa')::text;
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.v('org')::uuid, tests.v('branch')::uuid, 'Consultation', 'C', 600);
select tests.logout();
delete from public.opening_hours where branch_id = tests.v('branch')::uuid;
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.v('org')::uuid, tests.v('branch')::uuid, d, '00:00', '23:59:59' from generate_series(1, 7) d;
select tests.login_as('9d000000-0000-0000-0000-0000000000a1');
select public.reception_create_ticket((select id from public.services where branch_id = tests.v('branch')::uuid));
select tests.logout();
insert into vals select 'token', public_token from public.tickets where branch_id = tests.v('branch')::uuid;
insert into vals select 'updated', updated_at::text from public.tickets where branch_id = tests.v('branch')::uuid;
select tests.login_as('9d000000-0000-0000-0000-0000000000b1');
select public.create_organization('Clinique Aide B', 'pgtap-aide-b', 'clinic');
select tests.logout();

-- ─── Patient (visiteur anonyme avec le lien) ─────────────────────────────────
set local role anon;
select lives_ok(format($$ select public.request_ticket_help(%L) $$, tests.v('token')), 'demande d''aide envoyée');
select throws_ok(format($$ select public.request_ticket_help(%L) $$, tests.v('token')), 'P0429', 'help_too_soon', 'deuxième demande dans les 5 minutes : refusée');
select throws_ok($$ select public.request_ticket_help('JetonInconnu00000000xx') $$, 'P0404', 'not_found', 'jeton inconnu : refusé');
select is((select count(*)::integer from public.ticket_help_requests), 0, 'visiteur : ne lit pas les demandes');
reset role;
select is((select updated_at::text from public.tickets where public_token = tests.v('token')), tests.v('updated'),
  'le ticket n''est pas modifié (aucune diffusion vers l''écran TV)');
-- Plus de 5 minutes après : nouvelle demande possible.
update public.ticket_help_requests set requested_at = now() - interval '6 minutes';
set local role anon;
select lives_ok(format($$ select public.request_ticket_help(%L) $$, tests.v('token')), 'après 5 minutes : nouvelle demande');
reset role;

-- ─── Accueil ─────────────────────────────────────────────────────────────────
insert into vals select 'req', id::text from public.ticket_help_requests order by requested_at desc limit 1;
select tests.login_as('9d000000-0000-0000-0000-0000000000b1');
select is((select count(*)::integer from public.ticket_help_requests), 0, 'autre établissement : ne lit rien');
select throws_ok(format($$ select public.handle_ticket_help(%L) $$, tests.v('req')), '42501', null, 'autre établissement : ne peut pas traiter');
select tests.login_as('9d000000-0000-0000-0000-0000000000a1');
select is((select count(*)::integer from public.ticket_help_requests where handled_at is null), 2, 'personnel de l''agence : demandes visibles');
select public.handle_ticket_help(id) from public.ticket_help_requests;
select is((select count(*)::integer from public.ticket_help_requests where handled_at is null), 0, '« Traité » : plus de demande en attente');
select tests.logout();

-- Ticket terminé : plus de demande possible.
update public.tickets set status = 'cancelled', finished_at = now() where public_token = tests.v('token');
update public.ticket_help_requests set requested_at = now() - interval '1 hour';
set local role anon;
select throws_ok(format($$ select public.request_ticket_help(%L) $$, tests.v('token')), 'P0409', 'invalid_state', 'ticket terminé : refusé');
reset role;

select * from finish();
rollback;
