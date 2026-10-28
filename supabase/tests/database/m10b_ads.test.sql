-- pgTAP — M10b : référentiels, espace annonceur, édition et droits, visa santé, modération, ciblage (villes, types,
-- secteurs bloqués), paiement des campagnes, rotation pondérée (distribution), quiz, Sky Catch, bons, événements
-- idempotents, statistiques, RLS.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(93);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anon boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_anon, now()) returning id;
$$;
create function tests.login_as(p_id uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
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
grant usage on schema tests to anon, authenticated, service_role;
create temp table ids (name text primary key, id uuid) on commit drop;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on ids, vals to anon, authenticated, service_role;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
create function tests.t(p_name text) returns text language sql as $$ select v #>> '{}' from vals where name = p_name $$;
-- Campagne d'annonceur complète : brouillon, visuel, soumission (droits de A1).
create function tests.campaign(p_name text, p_package text, p_sector text, p_surfaces text[], p_cities text[] default '{}', p_types text[] default '{}')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform tests.login_as('ab000000-0000-0000-0000-0000000000a1');
  v_id := public.save_campaign(null, tests.id('adv'), null, jsonb_build_object('name', p_name, 'package_code', p_package, 'sector', p_sector,
    'starts_on', current_date, 'surfaces', to_jsonb(p_surfaces), 'target_cities', to_jsonb(p_cities), 'target_org_types', to_jsonb(p_types)));
  perform public.save_creative(v_id, null, jsonb_build_object('storage_path', tests.id('adv') || '/' || v_id || '/visuel.png',
    'headline', p_name || ' — offre', 'offer_text', '-10 %'));
  perform tests.logout();
  insert into ids values (p_name, v_id);
  return v_id;
end $$;
create function tests.submit_and_approve(p_name text) returns void language plpgsql as $$
begin
  perform tests.login_as('ab000000-0000-0000-0000-0000000000a1');
  perform public.submit_campaign(tests.id(p_name));
  perform tests.login_as('ab000000-0000-0000-0000-0000000000ff');
  perform public.review_campaign(tests.id(p_name), true, null);
  perform tests.logout();
  update public.ad_campaigns set status = 'active' where id = tests.id(p_name) and status = 'awaiting_payment';
end $$;
create function tests.weights(p_branch uuid) returns jsonb language sql security definer as $$
  select coalesce(jsonb_object_agg(package_code, w), '{}'::jsonb) from (
    select package_code, round(sum(weight)) as w from public.ad_candidates(p_branch, 'tv') group by package_code) x
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.create_user('ab000000-0000-0000-0000-0000000000a1', 'pub@m10b.test');
select tests.create_user('ab000000-0000-0000-0000-0000000000a2', 'autre@m10b.test');
select tests.create_user('ab000000-0000-0000-0000-0000000000ff', 'wintek@m10b.test');
select tests.create_user('ab000000-0000-0000-0000-0000000000c1', 'clinique@m10b.test');
select tests.create_user('ab000000-0000-0000-0000-0000000000e1', 'eneo@m10b.test');
select tests.create_user('ab000000-0000-0000-0000-00000000000c', null, true);
insert into public.platform_admins (user_id) values ('ab000000-0000-0000-0000-0000000000ff');

select tests.login_as('ab000000-0000-0000-0000-0000000000c1');
insert into ids select 'clinic', public.create_organization('M10b Clinique', 'pgtap-m10b-clinic', 'clinic');
insert into ids select 'akwa', public.create_branch(tests.id('clinic'), 'Akwa', null, 'Douala');
select tests.login_as('ab000000-0000-0000-0000-0000000000e1');
insert into ids select 'eneo', public.create_organization('M10b Eneo', 'pgtap-m10b-eneo', 'utility');
insert into ids select 'bonanjo', public.create_branch(tests.id('eneo'), 'Bonanjo', null, 'Douala');
insert into ids select 'yaounde', public.create_branch(tests.id('eneo'), 'Mvan', null, 'Yaoundé');
select tests.logout();
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('clinic'), tests.id('akwa'), 'Consultation', 'C', 600);
delete from public.opening_hours where branch_id = tests.id('akwa');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.id('clinic'), tests.id('akwa'), d, '00:00', '23:59:59' from generate_series(1, 7) d;
select tests.as_service();
insert into vals select 'ticket', to_jsonb(public.take_ticket((select id from public.services where branch_id = tests.id('akwa')), 'qr',
  (select token from public.qr_codes where branch_id = tests.id('akwa') and active), null, 'ab000000-0000-0000-0000-00000000000c') ->> 'public_token');
select tests.logout();

-- ─── Référentiels ─────────────────────────────────────────────────────────────
select is((select string_agg(code, ',' order by sort_order) from public.ad_packages), 'maison,bronze,argent,or', 'formules Maison, Bronze, Argent, Or');
select is((select string_agg(code, ',' order by code) from public.ad_sectors where requires_health_visa), 'health,pharmacy',
  'visa santé exigé pour la santé et la pharmacie');
select is((select share_of_voice::text from public.ad_packages where code = 'or') || '/' || (select share_of_voice from public.ad_packages where code = 'argent')
  || '/' || (select share_of_voice from public.ad_packages where code = 'bronze'), '50/30/20', 'parts de diffusion par défaut : Or 50, Argent 30, Bronze 20');
select tests.as_anon();
select is((select count(*)::integer from public.ad_packages), 4, 'formules lisibles sans compte (page de prix)');
select throws_ok($$ update public.ad_packages set price_xaf = 1 $$, '42501', null, 'formules non modifiables directement');
select tests.logout();

-- ─── Espace annonceur ─────────────────────────────────────────────────────────
select tests.login_as('ab000000-0000-0000-0000-00000000000c', true);
select throws_ok($$ select public.create_advertiser('Anonyme', 'food', null, null) $$, '42501', 'not_allowed', 'session anonyme : pas de compte annonceur');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
insert into ids select 'adv', public.create_advertiser('Boulangerie du Lac', 'food', '+237677200001', 'Douala');
select tests.login_as('ab000000-0000-0000-0000-0000000000a2');
insert into ids select 'adv2', public.create_advertiser('Autre Annonceur', 'retail', null, 'Douala');
select is((select count(*)::integer from public.advertisers), 1, 'un annonceur ne voit que son compte');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.save_campaign(null, %L, null, '{"name":"X","package_code":"maison","sector":"food","starts_on":"%s","surfaces":["tv"]}') $$,
  tests.id('adv'), current_date), 'P0409', 'invalid_state', 'formule Maison réservée aux établissements');
select throws_ok(format($$ select public.save_campaign(null, %L, null, '{"name":"X","package_code":"bronze","sector":"food","starts_on":"%s","surfaces":["tv","app"]}') $$,
  tests.id('adv'), current_date), 'P0422', 'surface_not_in_package', 'surface hors formule refusée (Bronze : TV seulement)');
select throws_ok(format($$ select public.save_campaign(null, %L, null, '{"name":"X","package_code":"bronze","sector":"food","starts_on":"%s","surfaces":["tv"]}') $$,
  tests.id('adv'), current_date - 1), 'P0409', 'invalid_state', 'début dans le passé refusé');
select tests.logout();

select tests.campaign('Pain', 'bronze', 'food', '{tv}', '{douala}');
select is((select (ends_on - starts_on + 1)::text from public.ad_campaigns where id = tests.id('Pain')), '7', 'fin calculée selon la durée de la formule (Bronze : 7 jours)');
select tests.login_as('ab000000-0000-0000-0000-0000000000a2');
select is((select count(*)::integer from public.ad_campaigns where id = tests.id('Pain')), 0, 'campagne d''un autre annonceur : invisible (RLS)');
select throws_ok(format($$ select public.save_creative(%L, null, '{"storage_path":"x/y/z.png","headline":"Pirate"}') $$, tests.id('Pain')),
  '42501', 'not_allowed', 'visuel sur la campagne d''un autre annonceur : refusé');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.save_creative(%L, null, '{"storage_path":"%s/autre/z.png","headline":"Ailleurs"}') $$, tests.id('Pain'), tests.id('adv2')),
  '42501', 'not_allowed', 'fichier hors du dossier de la campagne : refusé');
select is(public.can_write_ad_file(tests.id('adv') || '/' || tests.id('Pain') || '/a.png'), true, 'dépôt de fichier : dossier de sa campagne');
select is(public.can_write_ad_file(tests.id('adv2') || '/' || tests.id('Pain') || '/a.png'), false, 'dépôt de fichier : dossier d''un autre annonceur refusé');
select throws_ok(format($$ select public.save_quiz(%L, '{"title":"Q","reward_text":"Bon","questions":[]}') $$, tests.id('Pain')),
  'P0403', 'feature_unavailable', 'quiz hors formule Bronze');
select tests.logout();

-- ─── Visa santé, quiz, habillage ──────────────────────────────────────────────
select tests.campaign('Pharma', 'argent', 'pharmacy', '{tv,app,game}');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.submit_campaign(%L) $$, tests.id('Pharma')), 'P0422', 'health_visa_required',
  'pharmacie : soumission impossible sans visa santé');
select throws_ok(format($$ select public.save_quiz(%L, '{"title":"Santé","reward_text":"-10 %%","questions":[
  {"question":"Q1 ?","answers":[{"text":"A","correct":true},{"text":"B"}]},
  {"question":"Q2 ?","answers":[{"text":"A","correct":true},{"text":"B"}]}]}') $$, tests.id('Pharma')), 'P0422', 'quiz_invalid', 'quiz : 3 questions au moins');
select throws_ok(format($$ select public.save_quiz(%L, '{"title":"Santé","reward_text":"-10 %%","questions":[
  {"question":"Q1 ?","answers":[{"text":"A","correct":true},{"text":"B","correct":true}]},
  {"question":"Q2 ?","answers":[{"text":"A","correct":true},{"text":"B"}]},
  {"question":"Q3 ?","answers":[{"text":"A","correct":true},{"text":"B"}]}]}') $$, tests.id('Pharma')), 'P0422', 'quiz_invalid', 'quiz : une seule bonne réponse par question');
select lives_ok(format($$ select public.save_quiz(%L, '{"title":"Santé","reward_text":"-10 %% sur la vitamine C","questions":[
  {"question":"Q1 ?","answers":[{"text":"A"},{"text":"B","correct":true}]},
  {"question":"Q2 ?","answers":[{"text":"A","correct":true},{"text":"B"},{"text":"C"}]},
  {"question":"Q3 ?","answers":[{"text":"A"},{"text":"B"},{"text":"C","correct":true}]}]}') $$, tests.id('Pharma')), 'quiz de 3 questions enregistré');
select throws_ok(format($$ select public.save_game_skin(%L, '{"plane_primary":"#0D2C54","plane_secondary":"#F58B1F","end_title":"Bravo","reward_text":"Bon"}') $$,
  tests.id('Pharma')), 'P0403', 'feature_unavailable', 'habillage de Sky Catch réservé à la formule Or');
select lives_ok(format($$ select public.save_campaign(%L, null, null, jsonb_build_object('name', 'Pharma', 'package_code', 'argent', 'sector', 'pharmacy',
  'starts_on', current_date, 'surfaces', '["tv","app","game"]'::jsonb, 'health_visa_number', 'MINSANTE-2026-0042',
  'health_visa_document_path', %L)) $$, tests.id('Pharma'), tests.id('adv') || '/' || tests.id('Pharma') || '/visa.pdf'), 'visa et justificatif ajoutés');
select is(public.submit_campaign(tests.id('Pharma'))::text, 'pending_review', 'soumise à la modération');
select throws_ok(format($$ select public.save_campaign(%L, null, null, '{"name":"Modifiée","package_code":"argent","sector":"pharmacy","starts_on":"%s","surfaces":["tv"]}') $$,
  tests.id('Pharma'), current_date), 'P0409', 'invalid_state', 'campagne en revue : plus modifiable');
select throws_ok(format($$ select public.review_campaign(%L, true, null) $$, tests.id('Pharma')), '42501', 'not_allowed', 'modération réservée au super admin');
select tests.logout();
-- Justificatif retiré entre-temps : l'approbation refuse (contrôle serveur, pas seulement l'interface).
update public.ad_campaigns set health_visa_document_path = null where id = tests.id('Pharma');
select tests.login_as('ab000000-0000-0000-0000-0000000000ff');
select throws_ok(format($$ select public.review_campaign(%L, true, null) $$, tests.id('Pharma')), 'P0422', 'health_visa_required',
  'approbation impossible sans justificatif de visa');
select tests.logout();
update public.ad_campaigns set health_visa_document_path = 'restored/visa.pdf' where id = tests.id('Pharma');
select tests.login_as('ab000000-0000-0000-0000-0000000000ff');
select throws_ok(format($$ select public.review_campaign(%L, false, '') $$, tests.id('Pharma')), 'P0422', 'reason_required', 'refus : motif obligatoire');
select is(public.review_campaign(tests.id('Pharma'), true, 'Visa vérifié')::text, 'awaiting_payment', 'approuvée : à payer');
select is((select count(*)::integer from public.ad_campaign_branches where campaign_id = tests.id('Pharma')
           and branch_id in (tests.id('akwa'), tests.id('bonanjo'), tests.id('yaounde'))), 3, 'ciblage : toutes les agences (aucun filtre)');
select is((select status from public.ad_quizzes where campaign_id = tests.id('Pharma')), 'approved', 'quiz approuvé avec la campagne');
select tests.logout();

-- ─── Paiement de la campagne ──────────────────────────────────────────────────
select tests.login_as('ab000000-0000-0000-0000-0000000000a2');
select throws_ok(format($$ select public.campaign_checkout(%L) $$, tests.id('Pharma')), '42501', 'not_allowed', 'paiement : membres de l''annonceur seulement');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
insert into vals select 'checkout', public.campaign_checkout(tests.id('Pharma'));
select is((tests.v('checkout') ->> 'total_xaf')::integer, 40000, 'facture de la formule Argent : 40 000 FCFA');
select is(public.campaign_checkout(tests.id('Pharma')) ->> 'invoice', tests.v('checkout') ->> 'invoice', 'facture ouverte réutilisée');
select tests.as_service();
insert into vals select 'pay', public.start_payment(tests.v('checkout') ->> 'pay_token', 'fake', 'orange_money', '+237699200002');
select is(public.confirm_payment(tests.v('pay') ->> 'external_id', 'succeeded') ->> 'status', 'succeeded', 'paiement confirmé');
select tests.logout();
select is((select (status, paid_at is not null)::text from public.ad_campaigns where id = tests.id('Pharma')), '(active,t)', 'campagne payée : diffusée');
select is((select kind from public.invoices where number = tests.v('checkout') ->> 'invoice'), 'campaign', 'facture de campagne');
select tests.as_anon();
select is(public.pay_invoice_view(tests.v('checkout') ->> 'pay_token') -> 'campaign' ->> 'package', 'Argent', 'lien de paiement : campagne et formule');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select is(public.invoice_document((select id from public.invoices where number = tests.v('checkout') ->> 'invoice')) ->> 'kind', 'campaign',
  'facture PDF accessible à l''annonceur');
select is((select count(*)::integer from public.invoices), 1, 'annonceur : ses factures seulement (RLS)');
select tests.logout();

-- ─── Ciblage, secteurs bloqués ────────────────────────────────────────────────
select tests.login_as('ab000000-0000-0000-0000-0000000000e1');
select lives_ok(format($$ select public.set_ad_preferences(%L, '{food,betting}', true, true, true) $$, tests.id('eneo')), 'Eneo bloque l''alimentation et les paris');
select tests.login_as('ab000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$ select public.set_ad_preferences(%L, '{}', true, true, true) $$, tests.id('eneo')), '42501', 'not_allowed',
  'réglages publicitaires : administrateurs de l''établissement');
select tests.logout();
select tests.submit_and_approve('Pain');
select is((select count(*)::integer from public.ad_campaign_branches where campaign_id = tests.id('Pain')), 1,
  'alimentation à Douala : la clinique seulement (Eneo bloque le secteur, Yaoundé hors zone)');
select tests.campaign('Telecom', 'bronze', 'telecom', '{tv}', '{}', '{utility}');
select tests.submit_and_approve('Telecom');
select is((select count(*)::integer from public.ad_campaign_branches where campaign_id = tests.id('Telecom')), 2,
  'ciblage par type d''établissement : les deux agences d''Eneo');
select tests.login_as('ab000000-0000-0000-0000-0000000000e1');
select public.set_ad_preferences(tests.id('eneo'), '{food,betting,telecom}', true, true, true);
select tests.logout();
select is((select count(*)::integer from public.ad_campaign_branches where campaign_id = tests.id('Telecom')), 0,
  'secteur bloqué après coup : campagne retirée des agences de l''établissement');

-- ─── Rotation pondérée (agence Akwa, TV) ───────────────────────────────────────
-- Akwa : Pain (Bronze), Pharma (Argent) ; ajout d'une campagne Or et d'une annonce Maison de la clinique.
select tests.campaign('Gold', 'or', 'telecom', '{tv,app,game}', '{douala}');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$ select public.save_game_skin(%L, '{"plane_primary":"#0D2C54","plane_secondary":"#F58B1F","end_title":"Bravo !","reward_text":"1 Go offert","min_levels":2}') $$,
  tests.id('Gold')), 'habillage Or enregistré');
select tests.logout();
select tests.submit_and_approve('Gold');
select tests.login_as('ab000000-0000-0000-0000-0000000000c1');
insert into ids select 'House', public.save_campaign(null, null, tests.id('clinic'), jsonb_build_object('name', 'Nos vaccins', 'package_code', 'maison',
  'sector', 'health', 'starts_on', current_date, 'surfaces', '["tv","app"]'::jsonb));
select public.save_creative(tests.id('House'), null, jsonb_build_object('storage_path', 'org-' || tests.id('clinic') || '/' || tests.id('House') || '/vaccins.png',
  'headline', 'Vaccination sans rendez-vous'));
select is(public.submit_campaign(tests.id('House'))::text, 'active', 'annonce Maison : diffusée sans modération');
select tests.logout();
select is(tests.weights(tests.id('akwa')), '{"or": 50, "argent": 30, "bronze": 20}'::jsonb,
  'poids : Or 50, Argent 30, Bronze 20 ; la Maison n''a plus de part libre');
update public.ad_campaigns set status = 'paused' where id in (tests.id('Gold'), tests.id('Pharma'));
select is(tests.weights(tests.id('akwa')), '{"bronze": 20, "maison": 80}'::jsonb, 'la Maison comble la part laissée libre');
update public.ad_campaigns set status = 'active' where id in (tests.id('Gold'), tests.id('Pharma'));
-- Distribution sur 6 000 tirages : écart toléré ± 3 points.
create temp table draws on commit drop as
  select (public.ad_weighted_draw((select jsonb_agg(jsonb_build_object('creative_id', creative_id, 'weight', weight))
    from public.ad_candidates(tests.id('akwa'), 'tv')), 1))[1] as creative_id
  from generate_series(1, 6000);
select ok((select abs(count(*) filter (where c.package_code = 'or') / 60.0 - 50) < 3
           and abs(count(*) filter (where c.package_code = 'argent') / 60.0 - 30) < 3
           and abs(count(*) filter (where c.package_code = 'bronze') / 60.0 - 20) < 3
           from draws d join public.ad_candidates(tests.id('akwa'), 'tv') c on c.creative_id = d.creative_id),
  'tirages pondérés : 50 / 30 / 20 % (± 3 points sur 6 000)');
select ok((select bool_and(s[i] is distinct from s[i + 1]) from (select public.ad_weighted_draw(
  (select jsonb_agg(jsonb_build_object('creative_id', creative_id, 'weight', weight)) from public.ad_candidates(tests.id('akwa'), 'tv')), 50) s) x,
  generate_series(1, 49) i), 'jamais deux fois la même pub de suite quand il y a une alternative');
select is((select count(*)::integer from public.ad_candidates(tests.id('akwa'), 'game')), 2, 'jeux : seulement les formules qui les comprennent (Argent, Or)');
select tests.login_as('ab000000-0000-0000-0000-0000000000a2');
select throws_ok(format($$ select public.end_house_campaign(%L) $$, tests.id('House')), '42501', 'not_allowed', 'annonce Maison : arrêtée par l''établissement seulement');
select tests.logout();
insert into public.ad_schedules (campaign_id, weekday, start_time, end_time) values (tests.id('Pain'), 1, '08:00', '09:00');
select is((select count(*)::integer from public.ad_candidates(tests.id('akwa'), 'tv', '2026-11-03 12:00+01') where campaign_id = tests.id('Pain')), 0,
  'plage horaire : hors créneau, pas de diffusion');
select is((select count(*)::integer from public.ad_candidates(tests.id('akwa'), 'tv', ((current_date + (8 - extract(isodow from current_date))::integer % 7)::timestamp + time '08:30') at time zone 'Africa/Douala')
  where campaign_id = tests.id('Pain')), 1, 'plage horaire : lundi 8 h 30, diffusée');
delete from public.ad_schedules where campaign_id = tests.id('Pain');

-- ─── Jeux pendant l'attente ───────────────────────────────────────────────────
select tests.as_anon();
insert into vals select 'session', public.game_session(tests.t('ticket'));
select is(tests.v('session') -> 'quiz' ->> 'title', 'Santé', 'quiz proposé (campagne approuvée et payée)');
select is(tests.v('session') -> 'sky_catch' -> 'skin' ->> 'end_title', 'Bravo !', 'habillage Or tiré au sort');
select is(jsonb_array_length(tests.v('session') -> 'sequence'), 12, 'lot de 12 interstitielles tirées côté serveur');
select is(public.games_available(tests.t('ticket')), '{"quiz": true, "sky_catch": true}'::jsonb, 'jeux proposés sur « Mon ticket » (vérification légère)');
select is(public.game_session('AAAAAAAAAAAAAAAAAAAAAA'), null, 'jeton inconnu : rien');
insert into vals select 'quiz', public.start_quiz(tests.t('ticket'), (tests.v('session') -> 'quiz' ->> 'id')::uuid);
select is(jsonb_array_length(tests.v('quiz') -> 'questions'), 3, 'questions du quiz');
select ok(not (tests.v('quiz')::text like '%correct%'), 'les bonnes réponses ne sont jamais envoyées au client');
insert into vals select 'quiz_end', public.finish_quiz(tests.t('ticket'), (tests.v('quiz') ->> 'play_id')::uuid, '{1,0,2}');
select is((tests.v('quiz_end') ->> 'score')::integer, 3, 'trois bonnes réponses sur trois');
select ok(tests.v('quiz_end') -> 'coupon' ->> 'code' ~ '^[A-HJ-NP-Z2-9]{8}$', 'bon de réduction à code court');
select is(public.finish_quiz(tests.t('ticket'), (tests.v('quiz') ->> 'play_id')::uuid, '{0,0,0}') -> 'coupon' ->> 'already', 'true',
  'partie rejouée : même score, même bon (un par ticket)');
insert into vals select 'play1', to_jsonb(public.start_sky_catch(tests.t('ticket'), (tests.v('session') -> 'sky_catch' -> 'skin' ->> 'id')::uuid));
select is(public.finish_sky_catch(tests.t('ticket'), (tests.t('play1'))::uuid, 1, 120, 1) -> 'coupon', 'null'::jsonb,
  'Sky Catch : un seul niveau réussi, pas de bon (2 exigés)');
insert into vals select 'play2', to_jsonb(public.start_sky_catch(tests.t('ticket'), (tests.v('session') -> 'sky_catch' -> 'skin' ->> 'id')::uuid));
insert into vals select 'sky_end', public.finish_sky_catch(tests.t('ticket'), (tests.t('play2'))::uuid, 3, 980, 2);
select is(tests.v('sky_end') -> 'coupon' ->> 'reward', '1 Go offert', 'Sky Catch : trois niveaux, bon de l''habillage');
select is(public.coupon_view(tests.v('sky_end') -> 'coupon' ->> 'qr_token') ->> 'reward', '1 Go offert', 'bon présenté par le client (QR code)');
select tests.logout();
select tests.login_as('ab000000-0000-0000-0000-0000000000c1');
select public.set_ad_preferences(tests.id('clinic'), '{}', false, false, true);
select tests.as_anon();
select is((public.game_session(tests.t('ticket')) ->> 'quiz') is null and (public.game_session(tests.t('ticket')) ->> 'sky_catch') is null, true,
  'jeux désactivés par l''établissement : rien n''est proposé');
select throws_ok(format($$ select public.start_sky_catch(%L, null) $$, tests.t('ticket')), 'P0403', 'feature_unavailable', 'Sky Catch désactivé : partie refusée');
select tests.logout();
select tests.login_as('ab000000-0000-0000-0000-0000000000c1');
select public.set_ad_preferences(tests.id('clinic'), '{}', true, true, true);
select tests.logout();

-- ─── Bons en caisse ───────────────────────────────────────────────────────────
select tests.login_as('ab000000-0000-0000-0000-0000000000a2');
select throws_ok(format($$ select public.redeem_coupon(%L) $$, tests.v('quiz_end') -> 'coupon' ->> 'code'), '42501', 'not_allowed',
  'bon d''un autre annonceur : refusé');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select is(public.redeem_coupon(tests.v('quiz_end') -> 'coupon' ->> 'code', false) ->> 'redeemed_at', null, 'consultation avant validation');
select ok(public.redeem_coupon(lower(tests.v('quiz_end') -> 'coupon' ->> 'code')) ->> 'redeemed_at' is not null, 'bon validé (code saisi en minuscules)');
select throws_ok(format($$ select public.redeem_coupon(%L) $$, tests.v('quiz_end') -> 'coupon' ->> 'qr_token'), 'P0409', 'coupon_redeemed',
  'bon déjà utilisé : refusé');
select tests.logout();
update public.ad_coupons set expires_at = now() - interval '1 minute' where code = tests.v('sky_end') -> 'coupon' ->> 'code';
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.redeem_coupon(%L) $$, tests.v('sky_end') -> 'coupon' ->> 'code'), 'P0410', 'coupon_expired', 'bon expiré : refusé');
select tests.logout();

-- ─── Événements, statistiques ─────────────────────────────────────────────────
select tests.as_service();
insert into vals select 'creative', to_jsonb((select id from public.ad_creatives where campaign_id = tests.id('Pharma') limit 1));
insert into vals select 'events', jsonb_build_array(
  jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000001', 'creative_id', tests.t('creative'), 'surface', 'tv', 'type', 'impression', 'at', now()),
  jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000002', 'creative_id', tests.t('creative'), 'surface', 'game', 'type', 'impression', 'at', now()),
  jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000003', 'creative_id', tests.t('creative'), 'surface', 'game', 'type', 'skip', 'at', now()),
  jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000004', 'creative_id', tests.t('creative'), 'surface', 'app', 'type', 'click', 'at', now()));
select is(public.record_ad_events(tests.id('akwa'), null, tests.v('events')), 4, 'lot d''événements enregistré');
select is(public.record_ad_events(tests.id('akwa'), null, tests.v('events')), 0, 'lot rejoué (hors ligne) : rien compté deux fois');
select is(public.record_ad_events(tests.id('bonanjo'), null, jsonb_build_array(jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000009',
  'creative_id', tests.t('creative'), 'surface', 'tv', 'type', 'impression', 'at', now()))), 1, 'agence ciblée par la campagne : retenu');
select is(public.record_ad_events((select id from public.branches where name = 'Mvan'), null, jsonb_build_array(jsonb_build_object('id', 'c0000000-0000-4000-8000-00000000000a',
  'creative_id', (select id from public.ad_creatives where campaign_id = tests.id('Pain')), 'surface', 'tv', 'type', 'impression', 'at', now()))), 0,
  'agence non ciblée : ignoré');
select tests.logout();
select ok(public.rollup_ad_stats(2) > 0, 'cumuls quotidiens calculés');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
insert into vals select 'stats', public.campaign_stats(tests.id('Pharma'));
select is(tests.v('stats') -> 'totals', jsonb_build_object('impressions', 2, 'clicks', 1, 'skips', 0, 'quiz_plays', 1, 'game_plays', 0,
  'interstitial_impressions', 1, 'interstitial_skips', 1, 'coupons_issued', 1, 'coupons_redeemed', 1), 'statistiques de la campagne (anonymes)');
select tests.login_as('ab000000-0000-0000-0000-0000000000a2');
select throws_ok(format($$ select public.campaign_stats(%L) $$, tests.id('Pharma')), '42501', 'not_allowed', 'statistiques d''un autre annonceur : refusées');
select tests.logout();

-- ─── Diffusion app et TV ──────────────────────────────────────────────────────
select tests.as_anon();
select ok(public.app_ad(tests.t('ticket')) ->> 'creative_id' is not null, 'pub de l''application sous « Mon ticket »');
select tests.logout();
select tests.login_as('ab000000-0000-0000-0000-0000000000ff');
select lives_ok(format($$ select public.admin_set_campaign_paused(%L, true, 'Contrôle') $$, tests.id('Gold')), 'pause par le super admin');
select tests.logout();
select is((select count(*)::integer from public.ad_candidates(tests.id('akwa'), 'tv') where campaign_id = tests.id('Gold')), 0, 'campagne en pause : plus diffusée');
select tests.login_as('ab000000-0000-0000-0000-0000000000ff');
select lives_ok($$ select public.admin_update_ad_package('bronze', '{"price_xaf": 18000, "share_of_voice": 25}') $$, 'formule modifiable sans déploiement');
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.admin_update_ad_package('bronze', '{"price_xaf": 1}') $$, '42501', 'not_allowed', 'formules : super admin seulement');
select tests.logout();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
select tests.login_as('ab000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select * from public.ad_quiz_plays $$, '42501', null, 'parties : jamais lisibles par les comptes');
select throws_ok($$ select * from public.ad_events $$, '42501', null, 'événements bruts : jamais lisibles par les comptes');
select tests.login_as('ab000000-0000-0000-0000-0000000000c1');
select is((select count(*)::integer from public.ad_campaigns), 1, 'établissement : ses annonces Maison seulement');
select tests.as_anon();
select throws_ok($$ select * from public.ad_campaigns $$, '42501', null, 'visiteur : aucune campagne lisible');
select tests.logout();
select ok(to_regclass('public.ad_events_' || to_char(now(), 'YYYYMM')) is not null, 'partition du mois des événements');
select is((select count(*)::integer from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
           where t.schemaname = 'public' and not c.relrowsecurity), 0, 'RLS activée sur toutes les tables');

select * from finish();
rollback;
