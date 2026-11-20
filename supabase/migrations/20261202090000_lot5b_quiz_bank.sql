-- LOT 5b (B) — Quiz « série sans fin » : banque de questions Wintek, commune à toute la plateforme.
-- Additive et compatible avec le code en ligne : une nouvelle table, deux nouvelles fonctions publiques, et une clé de
-- plus (`quiz_bank`) dans la réponse de `game_session` (mêmes paramètres, les autres clés inchangées).
--
-- Règles :
-- - lecture publique des seules questions actives, SANS la bonne réponse (colonne `correct` jamais lisible hors du
--   service role) ; écriture par le service role seulement (import `pnpm quiz:import`, console Wintek au LOT 6) ;
-- - tirage au hasard par `quiz_bank_draw` (questions déjà vues sur l'appareil exclues), réponse vérifiée par la base
--   (`quiz_bank_check`), comme le quiz sponsorisé ; les deux limitées par ticket, donc par appareil ;
-- - le réglage « quiz » de l'établissement (`organization_ad_preferences.quiz_enabled`) s'applique aussi à ce quiz.

create table public.quiz_bank_questions (
  -- Identifiant du fichier d'import (idempotent) : lettres, chiffres, tiret, soulignement.
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  category text not null check (char_length(category) between 1 and 40),
  difficulty smallint not null check (difficulty between 1 and 3),
  question text not null check (char_length(question) between 3 and 300),
  question_en text check (char_length(question_en) <= 300),
  -- [{ "text": "...", "text_en": "..." }] : 2 à 4 réponses, dans l'ordre du fichier.
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) between 2 and 4),
  -- Index (0 à 3) de la bonne réponse : jamais lisible par anon ni authenticated.
  correct smallint not null check (correct between 0 and 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (correct < jsonb_array_length(answers))
);
create index quiz_bank_questions_active_idx on public.quiz_bank_questions (active) where active;
create trigger quiz_bank_questions_set_updated_at before update on public.quiz_bank_questions
  for each row execute function public.set_updated_at();

alter table public.quiz_bank_questions enable row level security;
revoke all on public.quiz_bank_questions from anon, authenticated;
grant select (id, category, difficulty, question, question_en, answers, active) on public.quiz_bank_questions to anon, authenticated;
create policy quiz_bank_questions_read on public.quiz_bank_questions for select to anon, authenticated using (active);

/**
 * Tirage de questions pour le quiz sans fin : `p_count` (1 à 10) questions actives au hasard, hors `p_exclude`
 * (identifiants déjà vus sur l'appareil, 1 000 au plus). Jamais la bonne réponse. Liste vide : tout a été vu (l'appareil
 * recommence alors un tour). Limité à 120 tirages par heure et par ticket.
 */
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
      'question_en', q.question_en,
      'answers', (select jsonb_agg(jsonb_build_object('text', a ->> 'text', 'text_en', a ->> 'text_en') order by o) from jsonb_array_elements(q.answers) with ordinality x(a, o))))
    from (select * from public.quiz_bank_questions
          where active and not (id = any (v_exclude))
          order by random() limit least(greatest(coalesce(p_count, 5), 1), 10)) q
  ), '[]'::jsonb);
end;
$$;

/**
 * Vérification d'une réponse du quiz sans fin (index 0 à 3) : juste ou non, et l'index de la bonne réponse (affichée
 * après coup). Question inactive ou inconnue : `not_found`. Limité à 300 réponses par heure et par ticket.
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
  v_correct smallint;
begin
  if v_t.id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.check_rate_limit('quiz_bank:check:' || v_t.id, 300, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  select correct into v_correct from public.quiz_bank_questions where id = p_question and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  return jsonb_build_object('correct', p_answer is not distinct from v_correct, 'answer', v_correct);
end;
$$;

revoke execute on function public.quiz_bank_draw(text, text[], integer), public.quiz_bank_check(text, text, smallint) from public, anon, authenticated;
grant execute on function public.quiz_bank_draw(text, text[], integer), public.quiz_bank_check(text, text, smallint) to anon, authenticated;

/**
 * Feuille « Jouer en attendant » : identique à la version M10b, avec `quiz_bank` (le quiz sans fin est proposé :
 * quiz autorisé par l'établissement et au moins une question active).
 */
create or replace function public.game_session(p_ticket_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_t public.tickets := public.ticket_by_token(p_ticket_token);
  v_prefs public.organization_ad_preferences;
  v_settings public.platform_settings;
  v_ads jsonb;
  v_quiz jsonb;
  v_skin jsonb;
  v_skins jsonb;
  v_pick uuid[];
begin
  if v_t.id is null then return null; end if;
  select * into v_prefs from public.organization_ad_preferences where organization_id = v_t.organization_id;
  select * into v_settings from public.platform_settings;
  v_ads := public.ad_candidates_json(v_t.branch_id, 'game');

  -- Quiz d'une campagne éligible (approuvé, au moins 3 questions, bons encore disponibles).
  if coalesce(v_prefs.quiz_enabled, true) then
    select jsonb_build_object('id', q.id, 'title', q.title, 'title_en', q.title_en, 'reward', q.reward_text, 'reward_en', q.reward_text_en,
      'advertiser', c.advertiser, 'played', exists (select 1 from public.ad_quiz_plays p where p.quiz_id = q.id and p.ticket_id = v_t.id))
    into v_quiz
    from public.ad_quizzes q
    join (select distinct campaign_id, advertiser from public.ad_candidates(v_t.branch_id, 'game')) c on c.campaign_id = q.campaign_id
    where q.status = 'approved' and (select count(*) from public.ad_quiz_questions where quiz_id = q.id) >= 3
    order by random() limit 1;
  end if;

  if coalesce(v_prefs.sky_catch_enabled, true) then
    select coalesce(jsonb_agg(jsonb_build_object('creative_id', s.id, 'weight', c.weight)), '[]'::jsonb) into v_skins
    from public.ad_game_skins s
    join (select campaign_id, sum(weight) as weight, max(advertiser) as advertiser from public.ad_candidates(v_t.branch_id, 'game') group by campaign_id) c
      on c.campaign_id = s.campaign_id
    where s.status = 'approved';
    v_pick := public.ad_weighted_draw(v_skins, 1);
    if cardinality(v_pick) > 0 then
      select jsonb_build_object('id', s.id, 'campaign_id', s.campaign_id, 'plane_primary', s.plane_primary, 'plane_secondary', s.plane_secondary,
        'coin_logo_path', s.coin_logo_path, 'end_title', s.end_title, 'end_title_en', s.end_title_en, 'reward', s.reward_text,
        'reward_en', s.reward_text_en, 'min_levels', s.min_levels,
        'advertiser', (select coalesce(a.name, o.name) from public.ad_campaigns c left join public.advertisers a on a.id = c.advertiser_id
                       left join public.organizations o on o.id = c.organization_id where c.id = s.campaign_id))
      into v_skin from public.ad_game_skins s where s.id = v_pick[1];
    end if;
  end if;

  return jsonb_build_object(
    'quiz', v_quiz,
    'quiz_bank', coalesce(v_prefs.quiz_enabled, true) and exists (select 1 from public.quiz_bank_questions where active),
    'sky_catch', case when coalesce(v_prefs.sky_catch_enabled, true) then jsonb_build_object('skin', v_skin) end,
    'interstitial', jsonb_build_object('skip_after', v_settings.interstitial_skip_after_seconds, 'min_gap', v_settings.interstitial_min_gap_seconds),
    'ads', v_ads,
    'sequence', to_jsonb(public.ad_weighted_draw(v_ads, 12)),
    'branch_id', v_t.branch_id
  );
end;
$$;
