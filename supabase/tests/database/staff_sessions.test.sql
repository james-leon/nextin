-- pgTAP — LOT 3 : appareils connectés. Chacun ne voit que ses propres sessions (sans adresse IP), ne peut fermer
-- ni la session en cours ni celle d'un autre compte ; une fermeture est journalisée ; rôle anonyme refusé.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

create schema tests;
create function tests.login_as(p_id uuid, p_session uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', false, 'session_id', p_session)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('9e000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@sessions.test', now()),
  ('9e000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@sessions.test', now());
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent, ip) values
  ('9e000000-0000-0000-0000-00000000a001', '9e000000-0000-0000-0000-0000000000a1', now() - interval '2 days', now() - interval '1 hour', 'Mozilla/5.0 (iPhone) Safari', '10.0.0.1'),
  ('9e000000-0000-0000-0000-00000000a002', '9e000000-0000-0000-0000-0000000000a1', now() - interval '1 day', now(), 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', '10.0.0.2'),
  ('9e000000-0000-0000-0000-00000000b001', '9e000000-0000-0000-0000-0000000000b1', now(), now(), 'Mozilla/5.0 (Macintosh) Safari', '10.0.0.3');

select ok(not has_function_privilege('anon', 'public.my_sessions()', 'execute')
  and not has_function_privilege('anon', 'public.revoke_my_session(uuid)', 'execute'), 'rôle anonyme : appareils connectés fermés');

select tests.login_as('9e000000-0000-0000-0000-0000000000a1', '9e000000-0000-0000-0000-00000000a002');
select is((select count(*)::int from public.my_sessions()), 2, 'A voit ses deux sessions, pas celle de B');
select is((select id from public.my_sessions() where is_current), '9e000000-0000-0000-0000-00000000a002'::uuid, 'session en cours signalée');
select is((select id from public.my_sessions() limit 1), '9e000000-0000-0000-0000-00000000a002'::uuid, 'la plus récente en premier');
select ok(pg_get_function_result('public.my_sessions()'::regprocedure) !~ '\mip\M', 'aucune colonne IP renvoyée');
select throws_ok($$ select public.revoke_my_session('9e000000-0000-0000-0000-00000000a002') $$, '22023', 'session_current',
  'la session en cours ne se ferme pas ici (déconnexion)');
select throws_ok($$ select public.revoke_my_session('9e000000-0000-0000-0000-00000000b001') $$, 'P0002', 'not_found',
  'la session d''un autre compte est introuvable');
select ok(public.revoke_my_session('9e000000-0000-0000-0000-00000000a001'), 'A ferme son autre appareil');
select tests.logout();

select is((select count(*)::int from auth.sessions where user_id = '9e000000-0000-0000-0000-0000000000a1'), 1, 'session fermée supprimée');
select is((select count(*)::int from public.audit_log where action = 'auth.session_revoked'
  and entity_id = '9e000000-0000-0000-0000-00000000a001' and actor_user_id = '9e000000-0000-0000-0000-0000000000a1'), 1,
  'fermeture journalisée');

select * from finish();
rollback;
