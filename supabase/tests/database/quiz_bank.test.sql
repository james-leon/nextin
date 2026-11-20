-- pgTAP — LOT 5b : banque de questions du quiz « série sans fin ». Lecture publique des seules questions actives et
-- jamais de la bonne réponse ; écriture par le service role seulement (ni visiteur ni personnel d'un établissement) ;
-- tirage sans les questions déjà vues ; réponse vérifiée par la base ; réglage « quiz » de l'établissement respecté ;
-- limite par ticket.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(20);
alter table public.branch_settings alter column customer_name_mode set default 'optional';

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
grant all on vals to authenticated, anon, service_role;
create function tests.v(p_name text) returns text language sql as $$ select v from vals where name = p_name $$;
grant usage on schema tests to authenticated, anon, service_role;
grant execute on all functions in schema tests to authenticated, anon, service_role;

-- Établissement, agence et ticket (le quiz se joue depuis « Mon ticket »).
insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('9b000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@quizbank.test', now());
select tests.login_as('9b000000-0000-0000-0000-0000000000a1');
insert into vals select 'org', public.create_organization('Clinique Quiz', 'pgtap-quizbank', 'clinic')::text;
insert into vals select 'branch', public.create_branch(tests.v('org')::uuid, 'Akwa')::text;
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.v('org')::uuid, tests.v('branch')::uuid, 'Consultation', 'C', 600);
select tests.logout();
delete from public.opening_hours where branch_id = tests.v('branch')::uuid;
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.v('org')::uuid, tests.v('branch')::uuid, d, '00:00', '23:59:59' from generate_series(1, 7) d;
select tests.login_as('9b000000-0000-0000-0000-0000000000a1');
select public.reception_create_ticket((select id from public.services where branch_id = tests.v('branch')::uuid), null, null, null, null, false, 'fr', 'Awa');
select tests.logout();
insert into vals select 'token', public_token from public.tickets where branch_id = tests.v('branch')::uuid;

-- ─── Écriture : service role seulement ────────────────────────────────────────
-- Banque vide pour le test (une base locale peut contenir la banque d'exemple ; annulé à la fin).
delete from public.quiz_bank_questions;
select is((select relrowsecurity from pg_class where oid = 'public.quiz_bank_questions'::regclass), true, 'RLS activée');
set local role service_role;
insert into public.quiz_bank_questions (id, category, difficulty, question, question_en, answers, correct, active) values
  ('Q1', 'Cameroun', 1, 'Capitale politique du Cameroun ?', 'Political capital of Cameroon?',
   '[{"text":"Douala","text_en":"Douala"},{"text":"Yaoundé","text_en":"Yaoundé"},{"text":"Garoua","text_en":"Garoua"}]', 1, true),
  ('Q2', 'Santé', 2, 'Durée minimale du lavage des mains ?', null, '[{"text":"5 s","text_en":null},{"text":"20 s","text_en":null}]', 1, true),
  ('Q3', 'Sport', 3, 'Première CAN du Cameroun ?', 'First AFCON win?', '[{"text":"1984"},{"text":"1990"},{"text":"2002"},{"text":"1972"}]', 0, true),
  ('Q4', 'Cameroun', 1, 'Question retirée', null, '[{"text":"Oui"},{"text":"Non"}]', 0, false);
select is((select count(*)::integer from public.quiz_bank_questions), 4, 'service role : questions importées');
update public.quiz_bank_questions set difficulty = 2 where id = 'Q1';
select is((select difficulty from public.quiz_bank_questions where id = 'Q1'), 2::smallint, 'service role : question modifiée (import idempotent)');
reset role;

set local role anon;
select is((select array_agg(id order by id) from public.quiz_bank_questions), array['Q1', 'Q2', 'Q3'], 'visiteur : seulement les questions actives');
select throws_ok($$ select correct from public.quiz_bank_questions $$, '42501', null, 'visiteur : bonne réponse jamais lisible');
select throws_ok($$ insert into public.quiz_bank_questions (id, category, difficulty, question, answers, correct) values ('X', 'a', 1, 'abc', '[{"text":"a"},{"text":"b"}]', 0) $$,
  '42501', null, 'visiteur : aucune écriture');
reset role;

select tests.login_as('9b000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select correct from public.quiz_bank_questions $$, '42501', null, 'directrice d''établissement : bonne réponse jamais lisible');
select throws_ok($$ insert into public.quiz_bank_questions (id, category, difficulty, question, answers, correct) values ('X', 'a', 1, 'abc', '[{"text":"a"},{"text":"b"}]', 0) $$,
  '42501', null, 'personnel d''un établissement : aucune création');
select throws_ok($$ update public.quiz_bank_questions set active = false where id = 'Q1' $$, '42501', null, 'personnel : aucune modification');
select throws_ok($$ delete from public.quiz_bank_questions where id = 'Q1' $$, '42501', null, 'personnel : aucune suppression');
select tests.logout();

-- ─── Tirage et vérification (visiteur avec le lien du ticket) ─────────────────
set local role anon;
select is(jsonb_array_length(public.quiz_bank_draw(tests.v('token'), '{}', 10)), 3, 'tirage : toutes les questions actives (jamais la retirée)');
select ok(not (public.quiz_bank_draw(tests.v('token'), '{}', 10)::text ~ '"correct"'), 'tirage : jamais la bonne réponse');
select is((select array_agg(q ->> 'id' order by q ->> 'id') from jsonb_array_elements(public.quiz_bank_draw(tests.v('token'), array['Q1', 'Q3'], 5)) q),
  array['Q2'], 'tirage : questions déjà vues sur l''appareil exclues');
select is(public.quiz_bank_draw(tests.v('token'), array['Q1', 'Q2', 'Q3'], 5), '[]'::jsonb, 'tout vu : liste vide (l''appareil recommence un tour)');
select is(public.quiz_bank_check(tests.v('token'), 'Q1', 1::smallint), '{"answer": 1, "correct": true}'::jsonb, 'bonne réponse vérifiée par la base');
select is(public.quiz_bank_check(tests.v('token'), 'Q3', 2::smallint), '{"answer": 0, "correct": false}'::jsonb, 'mauvaise réponse : la bonne est donnée après coup');
select throws_ok(format($$ select public.quiz_bank_check(%L, 'Q4', 0::smallint) $$, tests.v('token')), 'P0404', 'not_found', 'question retirée : refusée');
select throws_ok($$ select public.quiz_bank_draw('JetonInconnu00000000xx', '{}', 5) $$, 'P0404', 'not_found', 'jeton inconnu : refusé');
reset role;

-- Réglage « quiz » de l'établissement : le quiz sans fin n'est plus proposé.
insert into public.organization_ad_preferences (organization_id, quiz_enabled) values (tests.v('org')::uuid, false);
set local role anon;
select is((public.game_session(tests.v('token')) ->> 'quiz_bank')::boolean, false, 'quiz désactivé par l''établissement : non proposé');
reset role;
update public.organization_ad_preferences set quiz_enabled = true where organization_id = tests.v('org')::uuid;

-- Limite par ticket (donc par appareil) : 120 tirages par heure.
set local role anon;
select throws_ok(format($$ select count(public.quiz_bank_draw(%L, '{}', 1)) from generate_series(1, 130) $$, tests.v('token')), 'P0429', 'rate_limited',
  'tirages limités par ticket');
reset role;

select * from finish();
rollback;
