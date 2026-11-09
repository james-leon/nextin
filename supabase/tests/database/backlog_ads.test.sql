-- pgTAP — Backlog publicité : agences choisies pour une formule plafonnée (au plus le plafond, parmi le ciblage),
-- tirage équitable sans choix, liste des agences avant le paiement, caissiers (bons seulement).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(17);

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, false, now()) returning id;
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
grant usage on schema tests to anon, authenticated, service_role;
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to anon, authenticated, service_role;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
create function tests.targets(p_campaign uuid) returns uuid[] language sql security definer as $$
  select coalesce(array_agg(branch_id order by branch_id), '{}') from public.ad_campaign_branches where campaign_id = p_campaign
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Base de développement : agences existantes mises de côté le temps du test (annulé à la fin).
update public.branches set active = false where active;

select tests.create_user('ad000000-0000-0000-0000-0000000000a1', 'owner@backlog-ads.test');
select tests.create_user('ad000000-0000-0000-0000-0000000000a2', 'caisse@backlog-ads.test');
select tests.create_user('ad000000-0000-0000-0000-0000000000a3', 'autre@backlog-ads.test');
select tests.create_user('ad000000-0000-0000-0000-0000000000ff', 'wintek@backlog-ads.test');
insert into public.platform_admins (user_id) values ('ad000000-0000-0000-0000-0000000000ff');
select tests.create_user('ad000000-0000-0000-0000-0000000000c1', 'clinique@backlog-ads.test');
select tests.login_as('ad000000-0000-0000-0000-0000000000c1');
insert into ids select 'org', public.create_organization('Réseau Sept', 'pgtap-backlog-ads', 'clinic');
insert into ids select 'b' || n, public.create_branch(tests.id('org'), 'Agence ' || n, null, 'Douala') from generate_series(1, 7) n;
select tests.logout();
update public.branch_settings set public_listing_enabled = false where branch_id = tests.id('b7');

select tests.login_as('ad000000-0000-0000-0000-0000000000a1');
insert into ids select 'adv', public.create_advertiser('Boutique Sept', 'retail', null, 'Douala');
insert into ids select 'camp', public.save_campaign(null, tests.id('adv'), null, jsonb_build_object('name', 'Bronze', 'package_code', 'bronze',
  'sector', 'retail', 'starts_on', current_date, 'surfaces', '["tv"]'::jsonb));
select public.save_creative(tests.id('camp'), null, jsonb_build_object('storage_path', tests.id('adv') || '/' || tests.id('camp') || '/v.png', 'headline', 'Offre'));

-- ─── Choix des agences ────────────────────────────────────────────────────────
select is(jsonb_array_length(public.campaign_branch_options(tests.id('camp'))), 6, 'agences proposées : celles du ciblage visibles publiquement (6 sur 7)');
select throws_ok(format('select public.set_campaign_branches(%L, %L)', tests.id('camp'),
  array[tests.id('b1'), tests.id('b2'), tests.id('b3'), tests.id('b4'), tests.id('b5'), tests.id('b6')]), 'P0422', 'too_many_branches',
  'Bronze : au plus 5 agences');
select throws_ok(format('select public.set_campaign_branches(%L, %L)', tests.id('camp'), array[tests.id('b7')]), 'P0404', 'not_found',
  'agence hors des agences proposées : refusée');
select is(public.set_campaign_branches(tests.id('camp'), array[tests.id('b2'), tests.id('b4')]), 2, 'deux agences choisies');
select ok((select bool_and((o ->> 'chosen')::boolean = ((o ->> 'id')::uuid in (tests.id('b2'), tests.id('b4'))))
           from jsonb_array_elements(public.campaign_branch_options(tests.id('camp'))) o), 'choix en cours renvoyé');
select public.submit_campaign(tests.id('camp'));
select throws_ok(format('select public.set_campaign_branches(%L, %L)', tests.id('camp'), array[tests.id('b1')]), 'P0409', 'invalid_state',
  'campagne en validation : choix figé');
select tests.login_as('ad000000-0000-0000-0000-0000000000ff');
select public.review_campaign(tests.id('camp'), true, null);
select tests.logout();
select is(tests.targets(tests.id('camp')), (select array_agg(x order by x) from unnest(array[tests.id('b2'), tests.id('b4')]) x),
  'validation : diffusée exactement dans les agences choisies');
select tests.login_as('ad000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.campaign_branch_list(tests.id('camp')) -> 'branches'), 2, 'agences affichées avant le paiement');
select tests.login_as('ad000000-0000-0000-0000-0000000000a3');
select throws_ok(format('select public.campaign_branch_options(%L)', tests.id('camp')), '42501', 'not_allowed', 'autre compte : options refusées');
select tests.logout();

-- Sans choix : tirage équitable dans la limite du plafond, agence masquée comprise (comptée, non nommée).
select tests.login_as('ad000000-0000-0000-0000-0000000000a1');
insert into ids select 'draw', public.save_campaign(null, tests.id('adv'), null, jsonb_build_object('name', 'Tirage', 'package_code', 'bronze',
  'sector', 'retail', 'starts_on', current_date, 'surfaces', '["tv"]'::jsonb));
select tests.logout();
select is(public.target_campaign_branches(tests.id('draw')), 5, 'sans choix : 5 agences tirées parmi les 7 du ciblage');

-- ─── Caissiers ────────────────────────────────────────────────────────────────
select tests.login_as('ad000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.add_advertiser_cashier((select id from ids where name = 'adv'), 'personne@inconnu.test') $$, 'P0404', 'user_not_found',
  'caissier : compte inexistant refusé');
select is(public.add_advertiser_cashier(tests.id('adv'), 'CAISSE@backlog-ads.test'), 'ad000000-0000-0000-0000-0000000000a2'::uuid,
  'caissier ajouté par son adresse');
select is(jsonb_array_length(public.advertiser_cashiers(tests.id('adv'))), 1, 'liste des caissiers (propriétaire)');
select tests.login_as('ad000000-0000-0000-0000-0000000000a2');
select is((select count(*)::integer from public.advertisers), 1, 'caissier : voit le nom de l''annonceur');
select is((select count(*)::integer from public.ad_campaigns), 0, 'caissier : aucune campagne lisible');
select throws_ok(format('select public.add_advertiser_cashier(%L, %L)', tests.id('adv'), 'autre@backlog-ads.test'), '42501', 'not_allowed',
  'caissier : ne peut pas ajouter de caissier');
select tests.login_as('ad000000-0000-0000-0000-0000000000a1');
select lives_ok(format('select public.remove_advertiser_cashier(%L, %L)', tests.id('adv'), 'ad000000-0000-0000-0000-0000000000a2'),
  'caissier retiré par le propriétaire');
select tests.logout();

select * from finish();
rollback;
