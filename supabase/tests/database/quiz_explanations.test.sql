-- pgTAP — LOT 5c : explication et illustration des questions du quiz « série sans fin ». L'explication donne la
-- réponse : jamais lisible avant la réponse (ni par la table, ni au tirage) ; elle ne sort que par `quiz_bank_check`.
-- L'illustration (clé d'un dessin, liste fermée) part avec la question.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(11);
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
  ('9c000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@quizexpl.test', now());
select tests.login_as('9c000000-0000-0000-0000-0000000000a1');
insert into vals select 'org', public.create_organization('Clinique Explications', 'pgtap-quizexpl', 'clinic')::text;
insert into vals select 'branch', public.create_branch(tests.v('org')::uuid, 'Akwa')::text;
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.v('org')::uuid, tests.v('branch')::uuid, 'Consultation', 'C', 600);
select tests.logout();
delete from public.opening_hours where branch_id = tests.v('branch')::uuid;
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.v('org')::uuid, tests.v('branch')::uuid, d, '00:00', '23:59:59' from generate_series(1, 7) d;
select tests.login_as('9c000000-0000-0000-0000-0000000000a1');
select public.reception_create_ticket((select id from public.services where branch_id = tests.v('branch')::uuid), null, null, null, null, false, 'fr', 'Awa');
select tests.logout();
insert into vals select 'token', public_token from public.tickets where branch_id = tests.v('branch')::uuid;

-- Banque de test (service role) : une question expliquée et illustrée, une sans explication.
delete from public.quiz_bank_questions;
insert into public.quiz_bank_questions (id, category, difficulty, question, answers, correct, explanation, explanation_en, illustration) values
  ('E1', 'Cameroun', 1, 'Plus haut sommet ?', '[{"text":"Mont Oku"},{"text":"Mont Cameroun"}]', 1,
   'Le mont Cameroun dépasse 4 000 mètres.', 'Mount Cameroon rises above 4,000 metres.', 'mont'),
  ('E2', 'Santé', 1, 'Lavage des mains ?', '[{"text":"5 s"},{"text":"20 s"}]', 1, null, null, null);

select throws_ok($$ update public.quiz_bank_questions set illustration = 'photo' where id = 'E1' $$, '23514', null,
  'illustration : liste fermée de clés');
select throws_ok($$ update public.quiz_bank_questions set explanation = repeat('a', 401) where id = 'E1' $$, '23514', null,
  'explication : 400 caractères au plus');

-- Avant la réponse : rien de l'explication n'est lisible.
set local role anon;
select throws_ok($$ select explanation from public.quiz_bank_questions $$, '42501', null, 'visiteur : explication illisible');
select throws_ok($$ select explanation_en from public.quiz_bank_questions $$, '42501', null, 'visiteur : explication anglaise illisible');
select is((select illustration from public.quiz_bank_questions where id = 'E1'), 'mont', 'visiteur : illustration lisible');
select ok(not (public.quiz_bank_draw(tests.v('token'), '{}', 10)::text ~ 'explanation|4 000'), 'tirage : jamais l''explication');
select is((select q ->> 'illustration' from jsonb_array_elements(public.quiz_bank_draw(tests.v('token'), '{}', 10)) q where q ->> 'id' = 'E1'), 'mont',
  'tirage : clé d''illustration avec la question');
reset role;
select tests.login_as('9c000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select explanation from public.quiz_bank_questions $$, '42501', null, 'personnel : explication illisible');
select tests.logout();

-- Après la réponse : l'explication arrive avec la vérification (juste ou non).
set local role anon;
select is(public.quiz_bank_check(tests.v('token'), 'E1', 0::smallint),
  '{"answer": 1, "correct": false, "explanation": "Le mont Cameroun dépasse 4 000 mètres.", "explanation_en": "Mount Cameroon rises above 4,000 metres."}'::jsonb,
  'mauvaise réponse : bonne réponse et explication');
select is(public.quiz_bank_check(tests.v('token'), 'E1', 1::smallint) ->> 'explanation', 'Le mont Cameroun dépasse 4 000 mètres.', 'bonne réponse : explication');
select is(public.quiz_bank_check(tests.v('token'), 'E2', 1::smallint), '{"answer": 1, "correct": true, "explanation": null, "explanation_en": null}'::jsonb,
  'question sans explication : null (pas de tiroir)');
reset role;

select * from finish();
rollback;
