-- pgTAP — Grille tarifaire v2 : formules Starter, Business, Premium, Enterprise (sur devis) ; limites par établissement
-- (services, guichets, écrans, utilisateurs) ; tickets du mois jamais bloquants le jour où la limite est atteinte (blocage
-- seulement le lendemain), alertes 80 % / 100 % ; extensions de quota payées ; historique des statistiques ; limites sur
-- mesure du super admin ; isolation entre établissements.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(48);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anon boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_anon, now())
  returning id;
$$;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
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
create function tests.today() returns date language sql as $$ select (now() at time zone 'Africa/Douala')::date $$;
create function tests.month() returns date language sql as $$ select date_trunc('month', (now() at time zone 'Africa/Douala')::date)::date $$;
create function tests.set_open(p_branch uuid) returns void language sql security definer as $$
  delete from public.opening_hours where branch_id = p_branch;
  insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
  select b.organization_id, b.id, d, '00:00', '23:59:59' from public.branches b, generate_series(1, 7) d where b.id = p_branch;
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.create_user('bb000000-0000-0000-0000-0000000000d1', 'dir1@v2.test');
select tests.create_user('bb000000-0000-0000-0000-0000000000d2', 'dir2@v2.test');
select tests.create_user('bb000000-0000-0000-0000-0000000000ff', 'wintek@v2.test');
select tests.create_user('bb000000-0000-0000-0000-0000000000c1', null, true);
insert into public.platform_admins (user_id) values ('bb000000-0000-0000-0000-0000000000ff');

-- ─── Formules ─────────────────────────────────────────────────────────────────
select is((select string_agg(format('%s:%s:%s:%s:%s', code, base_price_xaf, coalesce(tickets_per_month::text, '-'),
            coalesce(whatsapp_quota::text, '-'), coalesce(history_months::text, '-')), ',' order by sort_order) from public.plans),
  'starter:29900:1500:500:3,business:59900:6000:2000:12,premium:124900:15000:6000:24,enterprise:0:-:-:-',
  'grille v2 : prix, tickets, WhatsApp et historique');
select is((select string_agg(format('%s:%s/%s/%s/%s/%s', code, included_branches, max_services, max_counters, max_displays, max_users), ','
            order by sort_order) from public.plans where not quote_only),
  'starter:1/3/3/1/5,business:1/10/10/3/15,premium:3/30/30/10/50', 'limites par établissement');
select is((select code from public.plans where trial_eligible), 'business', 'essai gratuit sur Business');
select ok((select quote_only and not trial_eligible from public.plans where code = 'enterprise'), 'Enterprise : sur devis');
select ok((select (features ->> 'multisite')::boolean and (features ->> 'priority_support')::boolean from public.plans where code = 'premium')
  and not (select (features ->> 'appointments')::boolean from public.plans where code = 'starter'), 'fonctions par formule');

-- Deux établissements : o1 (Starter actif), o2 (Business actif).
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;
select tests.login_as('bb000000-0000-0000-0000-0000000000d1');
insert into ids select 'o1', public.create_organization('V2 Un', 'pgtap-v2-o1', 'clinic');
insert into ids select 'o1_branch', public.create_branch(tests.id('o1'), 'Akwa');
select tests.login_as('bb000000-0000-0000-0000-0000000000d2');
insert into ids select 'o2', public.create_organization('V2 Deux', 'pgtap-v2-o2', 'clinic');
insert into ids select 'o2_branch', public.create_branch(tests.id('o2'), 'Bonapriso');
select tests.logout();
revoke execute on function public.create_organization(text, text, public.org_type, text, integer) from authenticated;
insert into public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
select tests.id('o1'), id, 'active', now() - interval '1 day', now() + interval '29 days' from public.plans where code = 'starter';
insert into public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
select tests.id('o2'), id, 'active', now() - interval '1 day', now() + interval '29 days' from public.plans where code = 'business';
insert into ids select 'o1_sub', id from public.subscriptions where organization_id = tests.id('o1');
select tests.set_open(tests.id('o1_branch'));

select is((select format('%s/%s/%s', e ->> 'plan_code', e ->> 'tickets_per_month', e ->> 'history_months')
           from (select public.org_entitlements(tests.id('o1')) as e) x), 'starter/1500/3', 'droits Starter');

-- ─── Limites par établissement (Starter : 3 services, 3 guichets, 1 écran, 5 utilisateurs) ─
delete from public.services where organization_id = tests.id('o1');
select lives_ok(format($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  select %L, %L, 'Service ' || n, chr(64 + n), 600 from generate_series(1, 3) n $$, tests.id('o1'), tests.id('o1_branch')), 'trois services : permis');
select throws_ok(format($$ insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
  values (%L, %L, 'Service 4', 'D', 600) $$, tests.id('o1'), tests.id('o1_branch')), 'P0403', 'plan_limit', 'quatrième service : limite de la formule');
delete from public.counters where organization_id = tests.id('o1');
select lives_ok(format($$ insert into public.counters (organization_id, branch_id, kind, number)
  select %L, %L, 'guichet', n from generate_series(1, 3) n $$, tests.id('o1'), tests.id('o1_branch')), 'trois guichets : permis');
select throws_ok(format($$ insert into public.counters (organization_id, branch_id, kind, number) values (%L, %L, 'guichet', 4) $$,
  tests.id('o1'), tests.id('o1_branch')), 'P0403', 'plan_limit', 'quatrième guichet : limite de l''établissement');
select lives_ok(format($$ insert into public.displays (organization_id, branch_id, name, status) values (%L, %L, 'TV 1', 'active') $$,
  tests.id('o1'), tests.id('o1_branch')), 'un écran : permis');
select throws_ok(format($$ insert into public.displays (organization_id, branch_id, name, status) values (%L, %L, 'TV 2', 'active') $$,
  tests.id('o1'), tests.id('o1_branch')), 'P0403', 'plan_limit', 'deuxième écran : limite de la formule');
select count(tests.create_user(('bb000000-0000-0000-0000-00000000010' || n)::uuid, 'agent' || n || '@v2.test')) = 6 as created from generate_series(1, 6) n \gset
select lives_ok(format($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  select %L, ('bb000000-0000-0000-0000-00000000010' || n)::uuid, 'agent', %L from generate_series(1, 4) n $$, tests.id('o1'), tests.id('o1_branch')),
  'cinq utilisateurs (directeur compris) : permis');
select throws_ok(format($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  values (%L, 'bb000000-0000-0000-0000-000000000105', 'agent', %L) $$, tests.id('o1'), tests.id('o1_branch')), 'P0403', 'plan_limit',
  'sixième utilisateur : limite de la formule');
select throws_ok(format($$ insert into public.invitations (organization_id, email, role, branch_id, token_hash)
  values (%L, 'nouveau@v2.test', 'agent', %L, 'h1') $$, tests.id('o1'), tests.id('o1_branch')), 'P0403', 'plan_limit',
  'invitation au-delà de la limite : refusée');
select lives_ok(format($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  values (%L, 'bb000000-0000-0000-0000-000000000101', 'receptionist', null) $$, tests.id('o1')),
  'second rôle d''un utilisateur déjà compté : permis');

-- ─── Tickets du mois : jamais bloquants le jour même ──────────────────────────
select tests.login_as('bb000000-0000-0000-0000-0000000000ff');
select lives_ok(format($$ select public.admin_set_limits(%L, '{"tickets_per_month": 3}', 'Test des quotas') $$, tests.id('o1_sub')),
  'super admin : limite sur mesure');
select tests.logout();
insert into ids select 'o1_service', id from public.services where organization_id = tests.id('o1') order by prefix limit 1;
insert into vals select 'o1_qr', to_jsonb(token) from public.qr_codes where branch_id = tests.id('o1_branch') and active;
select tests.as_service();
select public.take_ticket(tests.id('o1_service'), 'qr', tests.t('o1_qr'), null, 'bb000000-0000-0000-0000-0000000000c1');
select tests.logout();
select is((select tickets_created from public.messaging_usage where organization_id = tests.id('o1') and month = tests.month()), 1,
  'un ticket créé = une unité');
update public.tickets set status = 'cancelled' where organization_id = tests.id('o1');
select is((select tickets_created from public.messaging_usage where organization_id = tests.id('o1') and month = tests.month()), 1,
  'changement de statut : non compté');
select tests.as_service();
select public.take_ticket(tests.id('o1_service'), 'qr', tests.t('o1_qr'), null, 'bb000000-0000-0000-0000-0000000000c1');
select tests.logout();
update public.tickets set status = 'cancelled' where organization_id = tests.id('o1');
select is((select count(*)::integer from public.account_messages where organization_id = tests.id('o1') and kind = 'quota_alert'
           and payload ->> 'resource' = 'tickets' and (payload ->> 'level')::integer = 80), 0,
  'sous 80 % : aucune alerte');
update public.subscriptions set billing_phone_e164 = '+237677200001', billing_email = 'dir1@v2.test' where organization_id = tests.id('o1');
select tests.as_service();
select public.take_ticket(tests.id('o1_service'), 'qr', tests.t('o1_qr'), null, 'bb000000-0000-0000-0000-0000000000c1');
select tests.logout();
update public.tickets set status = 'cancelled' where organization_id = tests.id('o1');
select is((select string_agg(format('%s-%s', payload ->> 'resource', payload ->> 'level'), ',' order by payload ->> 'level')
           from public.account_messages where organization_id = tests.id('o1') and kind = 'quota_alert' and channel = 'whatsapp'),
  'tickets-100,tickets-80', 'seuils de 80 % et 100 % franchis : deux alertes au directeur');
select is((select tickets_reached_on from public.messaging_usage where organization_id = tests.id('o1') and month = tests.month()),
  tests.today(), 'jour où la limite est atteinte enregistré');
select is((public.quota_status(tests.id('o1')) -> 'tickets' ->> 'blocked')::boolean, false, 'limite atteinte aujourd''hui : pas de blocage');
select tests.as_service();
select lives_ok(format($$ select public.take_ticket(%L, 'qr', %L, null, 'bb000000-0000-0000-0000-0000000000c1') $$,
  tests.id('o1_service'), tests.t('o1_qr')), 'au-delà de 100 % le même jour : la file continue');
select tests.logout();
update public.tickets set status = 'cancelled' where organization_id = tests.id('o1');
-- Le lendemain : blocage.
update public.messaging_usage set tickets_reached_on = tests.today() - 1 where organization_id = tests.id('o1') and month = tests.month();
select is((public.quota_status(tests.id('o1')) -> 'tickets' ->> 'blocked')::boolean, true, 'lendemain : quota épuisé');
select tests.as_service();
select throws_ok(format($$ select public.take_ticket(%L, 'qr', %L, null, 'bb000000-0000-0000-0000-0000000000c1') $$,
  tests.id('o1_service'), tests.t('o1_qr')), 'P0410', 'monthly_quota_reached', 'lendemain : nouveau ticket refusé, message clair');
select tests.logout();
select is((select count(*)::integer from public.account_messages where organization_id = tests.id('o1') and kind = 'quota_alert'
           and payload ->> 'resource' = 'tickets' and channel = 'whatsapp'), 2, 'chaque alerte une seule fois par mois');

-- ─── Extension de quota ────────────────────────────────────────────────────────
insert into ids select 'pack', id from public.quota_packs where code = 'tickets_1000';
insert into vals select 'pack_price', to_jsonb(price_xaf) from public.quota_packs where code = 'tickets_1000';
select tests.login_as('bb000000-0000-0000-0000-0000000000d2');
select throws_ok(format($$ select public.extension_checkout(%L, %L) $$, tests.id('o1'), tests.id('pack')), '42501', 'not_allowed',
  'extension d''un autre établissement : refusée');
select tests.login_as('bb000000-0000-0000-0000-0000000000d1');
insert into vals select 'ext', public.extension_checkout(tests.id('o1'), tests.id('pack'));
select is((tests.v('ext') ->> 'total_xaf')::integer, tests.t('pack_price')::integer,
  'facture de l''extension au prix du pack');
select is(public.extension_checkout(tests.id('o1'), tests.id('pack')) ->> 'invoice', tests.v('ext') ->> 'invoice', 'facture ouverte réutilisée');
select tests.logout();
select is((select kind from public.invoices where number = tests.v('ext') ->> 'invoice'), 'extension', 'facture de type extension');
select tests.as_service();
insert into vals select 'ext_pay', public.start_payment(tests.v('ext') ->> 'pay_token', 'fake', 'mtn_momo', '+237677200001');
select is(public.confirm_payment(tests.v('ext_pay') ->> 'external_id', 'succeeded', 'fake-ext-1') ->> 'status', 'succeeded', 'extension payée');
select tests.logout();
select is((public.quota_status(tests.id('o1')) -> 'tickets' ->> 'limit')::integer, 1003, 'limite du mois : formule + extension');
select is((public.quota_status(tests.id('o1')) -> 'tickets' ->> 'blocked')::boolean, false, 'extension : blocage levé');
select is((select plan_id from public.subscriptions where organization_id = tests.id('o1')),
  (select id from public.plans where code = 'starter'), 'extension : formule inchangée');
select tests.as_service();
select lives_ok(format($$ select public.take_ticket(%L, 'qr', %L, null, 'bb000000-0000-0000-0000-0000000000c1') $$,
  tests.id('o1_service'), tests.t('o1_qr')), 'après l''extension : tickets à nouveau émis');
select tests.logout();

-- ─── Historique des statistiques ────────────────────────────────────────────────
select is(public.stats_history_start(tests.id('o1')), (tests.today() - interval '3 months')::date + 1, 'Starter : 3 mois d''historique');
insert into public.daily_branch_stats (organization_id, branch_id, service_id, day, issued)
values (tests.id('o1'), tests.id('o1_branch'), tests.id('o1_service'), tests.today() - 200, 42),
       (tests.id('o1'), tests.id('o1_branch'), tests.id('o1_service'), tests.today() - 10, 7);
select is((select coalesce(sum(issued), 0)::integer from public.stats_branch_rows(tests.id('o1'), null, tests.today() - 365, tests.today() - 2)),
  7, 'jours au-delà de l''historique : masqués');
select is((select count(*)::integer from public.daily_branch_stats where organization_id = tests.id('o1') and day = tests.today() - 200), 1,
  'données anciennes conservées (jamais supprimées)');

-- ─── Formule sur devis, limites sur mesure ─────────────────────────────────────
select tests.login_as('bb000000-0000-0000-0000-0000000000d2');
select throws_ok(format($$ select public.billing_checkout(%L, (select id from public.plans where code = 'enterprise'), 'monthly') $$,
  tests.id('o2')), 'P0409', 'plan_quote_only', 'Enterprise : pas de paiement en ligne');
select throws_ok(format($$ select public.admin_set_limits(%L, '{"max_users": 99}', 'Essai') $$, tests.id('o1_sub')), '42501', 'not_allowed',
  'limites sur mesure : super admin uniquement');
select tests.login_as('bb000000-0000-0000-0000-0000000000ff');
select public.admin_set_limits(tests.id('o1_sub'), '{"max_users": null, "history_months": 24, "inconnu": 5, "max_services": -1}', 'Client sur devis');
select tests.logout();
select is((select limit_overrides from public.subscriptions where id = tests.id('o1_sub')),
  '{"max_users": null, "history_months": 24}'::jsonb, 'clés inconnues et valeurs négatives ignorées');
select is(public.org_entitlements(tests.id('o1')) -> 'max_users', 'null'::jsonb, 'limite levée (illimité)');
select lives_ok(format($$ insert into public.memberships (organization_id, user_id, role, branch_id)
  values (%L, 'bb000000-0000-0000-0000-000000000106', 'agent', %L) $$, tests.id('o1'), tests.id('o1_branch')), 'utilisateur de plus : permis');

-- ─── Isolation ───────────────────────────────────────────────────────────────
select tests.login_as('bb000000-0000-0000-0000-0000000000d2');
select is((select count(*)::integer from public.quota_extensions where organization_id = tests.id('o1')), 0,
  'extensions d''un autre établissement : invisibles');
select throws_ok(format($$ select public.staff_quota_status(%L) $$, tests.id('o1')), '42501', 'not_allowed',
  'consommation d''un autre établissement : refusée');
select tests.login_as('bb000000-0000-0000-0000-0000000000d1');
select is((select count(*)::integer from public.quota_extensions where organization_id = tests.id('o1')), 1, 'administrateur : ses extensions');
select throws_ok($$ update public.quota_packs set price_xaf = 1 $$, '42501', null, 'packs non modifiables directement');
select tests.logout();

select * from finish();
rollback;
