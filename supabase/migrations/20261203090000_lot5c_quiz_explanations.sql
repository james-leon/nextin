-- LOT 5c — Quiz « série sans fin » (maquette v2 10) : explication après la réponse et illustration dessinée.
-- Additive et compatible avec le code en ligne : trois colonnes nullables, mêmes fonctions (mêmes paramètres) qui
-- renvoient une clé de plus (`illustration` au tirage, `explanation` / `explanation_en` à la vérification).
--
-- Règles :
-- - l'explication donne la réponse : `explanation` et `explanation_en` ne sont jamais lisibles par anon ni
--   authenticated (aucun droit de colonne, comme `correct`) ; elles ne sortent que par `quiz_bank_check`, donc après
--   la réponse ;
-- - `illustration` : clé d'un dessin de l'application (liste fermée, `QUIZ_ILLUSTRATIONS` de
--   `@nextin/shared/games/quiz-bank`) ; lisible avec la question (elle ne dit rien de la réponse).

alter table public.quiz_bank_questions
  add column explanation text check (char_length(explanation) <= 400),
  add column explanation_en text check (char_length(explanation_en) <= 400),
  add column illustration text check (illustration in ('mont', 'eau', 'fleuve', 'moustique', 'mains', 'trophee'));

-- Droits par colonne : l'illustration seulement (les explications restent illisibles).
grant select (illustration) on public.quiz_bank_questions to anon, authenticated;

/** Tirage (inchangé, LOT 5b) : avec la clé d'illustration ; jamais la bonne réponse ni l'explication. */
create or replace function public.quiz_bank_draw(p_ticket_token text, p_exclude text[] default '{}', p_count integer default 5)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_exclude text[] := coalesce(p_exclude[1:1000], '{}');
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not coalesce((select quiz_enabled from public.organization_ad_preferences where organization_id = v_t.organization_id), true) then
    raise exception 'feature_unavailable' using errcode = 'P0403', detail = 'quiz';
  end if;
  if not public.check_rate_limit('quiz_bank:draw:' || v_t.id, 120, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'category', q.category, 'difficulty', q.difficulty, 'question', q.question,
      'question_en', q.question_en, 'illustration', q.illustration,
      'answers', (select jsonb_agg(jsonb_build_object('text', a ->> 'text', 'text_en', a ->> 'text_en') order by o) from jsonb_array_elements(q.answers) with ordinality x(a, o))))
    from (select * from public.quiz_bank_questions
          where active and not (id = any (v_exclude))
          order by random() limit least(greatest(coalesce(p_count, 5), 1), 10)) q
  ), '[]'::jsonb);
end;
$$;

/**
 * Vérification d'une réponse (inchangée, LOT 5b) : juste ou non, index de la bonne réponse, et l'explication (FR et EN,
 * null si la question n'en a pas), envoyée seulement ici, donc après la réponse.
 */
create or replace function public.quiz_bank_check(p_ticket_token text, p_question text, p_answer smallint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_q public.quiz_bank_questions;
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.check_rate_limit('quiz_bank:check:' || v_t.id, 300, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  select * into v_q from public.quiz_bank_questions where id = p_question and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  return jsonb_build_object('correct', p_answer is not distinct from v_q.correct, 'answer', v_q.correct,
    'explanation', v_q.explanation, 'explanation_en', v_q.explanation_en);
end;
$$;

-- `create or replace` garde les droits ; rappel explicite (révocation globale par défaut, migration 20261117090000).
revoke execute on function public.quiz_bank_draw(text, text[], integer), public.quiz_bank_check(text, text, smallint) from public;
grant execute on function public.quiz_bank_draw(text, text[], integer), public.quiz_bank_check(text, text, smallint) to anon, authenticated;
