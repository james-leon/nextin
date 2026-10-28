-- pgTAP — M10a : formules et prix (parité avec packages/shared/src/billing/pricing.fixtures.json), inscription avec
-- téléphone vérifié et essai unique par numéro, limites des formules, factures sans trou et immuables, paiements
-- idempotents, cycle de vie (dégradations différées après la fermeture), quotas, droits (super admin, RLS).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(112);

create schema tests;
create function tests.create_user(p_id uuid, p_email text, p_anon boolean default false) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_anon, now())
  returning id;
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
-- Code de vérification lu dans la file d'envoi (comme le recevrait le directeur).
create function tests.phone_code(p_verification uuid) returns text language sql security definer as $$
  select payload ->> 'code' from public.account_messages where dedupe_key = 'phone_code:' || p_verification || ':whatsapp'
$$;
create function tests.sub(p_org uuid) returns public.subscriptions language sql security definer as $$
  select * from public.subscriptions where organization_id = p_org
$$;
create function tests.reset_limits() returns void language sql security definer as $$ delete from public.rate_limits $$;
-- Agence ouverte toute la journée (true) ou fermée toute la journée (false).
create function tests.set_open(p_branch uuid, p_open boolean) returns void language sql security definer as $$
  delete from public.opening_hours where branch_id = p_branch;
  insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
  select b.organization_id, b.id, d, '00:00', '23:59:59' from public.branches b, generate_series(1, 7) d
  where b.id = p_branch and p_open;
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.create_user('aa000000-0000-0000-0000-00000000000a', 'pilot@m10a.test');
select tests.create_user('aa000000-0000-0000-0000-0000000000d1', 'dir1@m10a.test');
select tests.create_user('aa000000-0000-0000-0000-0000000000d2', 'dir2@m10a.test');
select tests.create_user('aa000000-0000-0000-0000-0000000000a9', 'agent@m10a.test');
select tests.create_user('aa000000-0000-0000-0000-0000000000ff', 'wintek@m10a.test');
insert into public.platform_admins (user_id) values ('aa000000-0000-0000-0000-0000000000ff');

-- Établissement « pilote » créé avant le M10a (appel direct, permis à l'époque) : aucun abonnement.
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;
select tests.login_as('aa000000-0000-0000-0000-00000000000a');
insert into ids select 'pilot', public.create_organization('M10a Pilote', 'pgtap-m10a-pilot', 'clinic');
select tests.logout();
revoke execute on function public.create_organization(text, text, public.org_type, text, integer) from authenticated;
select tests.login_as('aa000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.create_organization('Sans abonnement', 'pgtap-m10a-free', 'clinic') $$, '42501', null,
  'création directe d''un établissement refusée : inscription avec téléphone vérifié obligatoire');
select tests.logout();

-- ─── Formules et prix ───────────────────────────────────────────────────────
select is((select string_agg(code, ',' order by sort_order) from public.plans), 'essentiel,pro,entreprise', 'trois formules initiales');
select tests.as_anon();
select is((select count(*)::integer from public.plans), 3, 'formules lisibles par tous (page de prix)');
select throws_ok($$ update public.plans set base_price_xaf = 1 $$, '42501', null, 'formules non modifiables directement');
select tests.logout();
select is(public.subscription_price(25000, 1, 25000, 2, 1, 'monthly', null, null),
  '{"monthly": 25000, "months": 1, "extra_branches": 0, "subtotal": 25000, "discount": 0, "total": 25000}'::jsonb, 'prix : Essentiel, 1 agence, mensuel');
select is(public.subscription_price(25000, 1, 25000, 2, 3, 'monthly', null, null),
  '{"monthly": 75000, "months": 1, "extra_branches": 2, "subtotal": 75000, "discount": 0, "total": 75000}'::jsonb, 'prix : Essentiel, 3 agences, mensuel');
select is(public.subscription_price(45000, 1, 45000, 2, 1, 'annual', null, null),
  '{"monthly": 45000, "months": 10, "extra_branches": 0, "subtotal": 450000, "discount": 0, "total": 450000}'::jsonb, 'prix : Pro, 1 agence, annuel (2 mois offerts)');
select is(public.subscription_price(120000, 3, 35000, 2, 5, 'annual', null, null),
  '{"monthly": 190000, "months": 10, "extra_branches": 2, "subtotal": 1900000, "discount": 0, "total": 1900000}'::jsonb, 'prix : Entreprise, 5 agences, annuel');
select is(public.subscription_price(120000, 3, 35000, 2, 2, 'monthly', null, null),
  '{"monthly": 120000, "months": 1, "extra_branches": 0, "subtotal": 120000, "discount": 0, "total": 120000}'::jsonb, 'prix : Entreprise, 2 agences (sous les incluses)');
select is(public.subscription_price(45000, 1, 45000, 2, 2, 'monthly', 'percent', 15),
  '{"monthly": 90000, "months": 1, "extra_branches": 1, "subtotal": 90000, "discount": 13500, "total": 76500}'::jsonb, 'prix : Pro, 2 agences, remise 15 %');
select is(public.subscription_price(12345, 1, null, 0, 1, 'monthly', 'percent', 10),
  '{"monthly": 12345, "months": 1, "extra_branches": 0, "subtotal": 12345, "discount": 1235, "total": 11110}'::jsonb, 'prix : Remise en pourcentage arrondie à l''entier');
select is(public.subscription_price(25000, 1, 25000, 2, 1, 'monthly', 'fixed_xaf', 50000),
  '{"monthly": 25000, "months": 1, "extra_branches": 0, "subtotal": 25000, "discount": 25000, "total": 0}'::jsonb, 'prix : Remise fixe plafonnée au prix');
select is(public.subscription_price(30000, 1, null, 1, 3, 'annual', 'fixed_xaf', 10000),
  '{"monthly": 30000, "months": 11, "extra_branches": 2, "subtotal": 330000, "discount": 10000, "total": 320000}'::jsonb, 'prix : Formule sans agence supplémentaire facturable');

select is((public.org_entitlements(tests.id('pilot')) ->> 'pilot')::boolean, true, 'établissement pilote : sans abonnement');
select is((public.org_entitlements(tests.id('pilot')) ->> 'can_issue')::boolean, true, 'établissement pilote : émission permise');
select is(public.org_entitlements(tests.id('pilot')) ->> 'plan_code', 'entreprise', 'établissement pilote : limites Entreprise');

-- ─── Inscription : téléphone vérifié, essai Pro une seule fois par numéro ──────
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select public.request_phone_code('aa000000-0000-0000-0000-0000000000d1', '+237677100001') $$, '42501', null,
  'code de vérification : serveur uniquement');
select tests.as_service();
select throws_ok($$ select public.request_phone_code('aa000000-0000-0000-0000-0000000000d1', '+33612345678') $$, 'P0422', 'phone_invalid',
  'numéro hors Cameroun refusé');
insert into ids select 'v1', public.request_phone_code('aa000000-0000-0000-0000-0000000000d1', '+237677100001');
select tests.logout();
select ok(tests.phone_code(tests.id('v1')) ~ '^[0-9]{6}$', 'code à 6 chiffres envoyé sur WhatsApp');
insert into vals select 'code1', to_jsonb(tests.phone_code(tests.id('v1')));

select tests.login_as('aa000000-0000-0000-0000-0000000000d2');
select throws_ok(format($$ select public.verify_phone_code(%L, %L) $$, tests.id('v1'), tests.t('code1')), 'P0404', 'not_found',
  'code d''un autre utilisateur : introuvable');
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
select is(public.verify_phone_code(tests.id('v1'), case when tests.t('code1') = '000000' then '111111' else '000000' end) ->> 'error',
  'code_invalid', 'mauvais code : refusé');
select throws_ok(format($$ select public.self_service_signup('Clinique Test', 'pgtap-m10a-d1', 'clinic', 'fr', %L) $$, tests.id('v1')),
  'P0422', 'phone_not_verified', 'inscription impossible sans téléphone vérifié');
select is(public.verify_phone_code(tests.id('v1'), tests.t('code1')) ->> 'verified', 'true', 'bon code : téléphone vérifié');
select tests.logout();
select is(tests.phone_code(tests.id('v1')), null, 'code effacé de la file d''envoi après vérification');

select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
insert into vals select 'signup1', public.self_service_signup('Clinique Test', 'pgtap-m10a-d1', 'clinic', 'fr', tests.id('v1'));
insert into ids select 'd1', (tests.v('signup1') ->> 'organization_id')::uuid;
select is(tests.v('signup1') ->> 'trial', 'true', 'premier établissement du numéro : essai');
select is((select (s.status, p.code, s.trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour')::text
           from public.subscriptions s join public.plans p on p.id = s.plan_id where s.organization_id = tests.id('d1')),
  '(trialing,pro,t)', 'essai Pro de 14 jours (réglage de la plateforme)');
select is(public.staff_entitlements(tests.id('d1')) ->> 'plan_code', 'pro', 'droits du personnel : limites Pro pendant l''essai');
select throws_ok(format($$ select public.self_service_signup('Clinique Bis', 'pgtap-m10a-d1b', 'clinic', 'fr', %L) $$, tests.id('v1')),
  'P0422', 'phone_not_verified', 'vérification à usage unique');
select throws_ok(format($$ select public.staff_entitlements(%L) $$, tests.id('pilot')), '42501', 'not_allowed',
  'droits d''un autre établissement : refusés');
insert into ids select 'd1_branch', public.create_branch(tests.id('d1'), 'Akwa');
select tests.logout();
select is((select (o.phone_e164, v.phone_e164 is null)::text from public.organizations o, public.phone_verifications v
           where o.id = tests.id('d1') and v.id = tests.id('v1')), '(+237677100001,t)',
  'numéro gardé sur l''établissement, effacé de la vérification');

-- Deuxième établissement avec le même numéro : pas de second essai.
select tests.as_service();
insert into ids select 'v2', public.request_phone_code('aa000000-0000-0000-0000-0000000000d2', '+237677100001');
select tests.logout();
insert into vals select 'code2', to_jsonb(tests.phone_code(tests.id('v2')));
select tests.login_as('aa000000-0000-0000-0000-0000000000d2');
select public.verify_phone_code(tests.id('v2'), tests.t('code2'));
insert into vals select 'signup2', public.self_service_signup('Clinique Deux', 'pgtap-m10a-d2', 'clinic', 'fr', tests.id('v2'));
insert into ids select 'd2', (tests.v('signup2') ->> 'organization_id')::uuid;
select is(tests.v('signup2') ->> 'trial', 'false', 'numéro déjà utilisé pour un essai : pas de second essai');
select is((tests.sub(tests.id('d2'))).status::text, 'read_only', 'sans essai : lecture seule jusqu''au paiement');
insert into ids select 'd2_branch', public.create_branch(tests.id('d2'), 'Bonapriso');
select tests.logout();
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('d2'), tests.id('d2_branch'), 'Consultation', 'C', 600), (tests.id('d1'), tests.id('d1_branch'), 'Consultation', 'C', 600);
insert into ids select 'd2_service', id from public.services where branch_id = tests.id('d2_branch');
insert into ids select 'd1_service', id from public.services where branch_id = tests.id('d1_branch');
select tests.set_open(tests.id('d2_branch'), true);
select tests.set_open(tests.id('d1_branch'), true);
insert into vals select 'd2_qr', to_jsonb(token) from public.qr_codes where branch_id = tests.id('d2_branch') and active;
insert into vals select 'd1_qr', to_jsonb(token) from public.qr_codes where branch_id = tests.id('d1_branch') and active;
select tests.create_user('aa000000-0000-0000-0000-0000000000c1', null, true);
select tests.create_user('aa000000-0000-0000-0000-0000000000c2', null, true);
select tests.as_service();
select throws_ok(format($$ select public.take_ticket(%L, 'qr', %L, null, 'aa000000-0000-0000-0000-0000000000c1') $$,
  tests.id('d2_service'), tests.t('d2_qr')), 'P0410', 'subscription_read_only', 'lecture seule : aucun ticket émis');
select lives_ok(format($$ select public.take_ticket(%L, 'qr', %L, null, 'aa000000-0000-0000-0000-0000000000c1') $$,
  tests.id('d1_service'), tests.t('d1_qr')), 'essai : tickets émis normalement');
select tests.logout();

-- ─── Factures et paiement (faux fournisseur) ─────────────────────────────────
insert into public.memberships (organization_id, user_id, role, branch_id)
values (tests.id('d1'), 'aa000000-0000-0000-0000-0000000000a9', 'agent', tests.id('d1_branch'));
insert into ids select 'essentiel', id from public.plans where code = 'essentiel';
insert into ids select 'pro', id from public.plans where code = 'pro';
insert into ids select 'entreprise', id from public.plans where code = 'entreprise';

select tests.login_as('aa000000-0000-0000-0000-0000000000a9');
select throws_ok(format($$ select public.billing_checkout(%L, %L, 'monthly') $$, tests.id('d1'), tests.id('essentiel')), '42501',
  'not_allowed', 'agent : pas d''accès à l''abonnement');
select is((select status::text from public.subscriptions where organization_id = tests.id('d1')), 'trialing',
  'agent : statut de l''abonnement visible (bandeaux)');
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
insert into vals select 'checkout1', public.billing_checkout(tests.id('d1'), tests.id('essentiel'), 'monthly');
select is((tests.v('checkout1') ->> 'total_xaf')::integer, 25000, 'Essentiel mensuel, une agence : 25 000 FCFA');
select ok(tests.v('checkout1') ->> 'invoice' ~ '^FAC-[0-9]{4}-[0-9]{6}$', 'facture numérotée FAC-AAAA-NNNNNN');
select is(public.billing_checkout(tests.id('d1'), tests.id('essentiel'), 'monthly') ->> 'invoice', tests.v('checkout1') ->> 'invoice',
  'même formule et période : la facture ouverte est réutilisée');
select tests.login_as('aa000000-0000-0000-0000-0000000000d2');
select throws_ok(format($$ select public.billing_overview(%L) $$, tests.id('d1')), '42501', 'not_allowed',
  'page Abonnement d''un autre établissement : refusée');
select is((select count(*)::integer from public.invoices where organization_id = tests.id('d1')), 0,
  'factures d''un autre établissement : invisibles (RLS)');
select tests.logout();

select tests.as_anon();
select is(public.pay_invoice_view(tests.v('checkout1') ->> 'pay_token') ->> 'total_xaf', '25000', 'lien de paiement : facture lisible sans compte');
select is(public.pay_invoice_view('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), null, 'jeton inconnu : rien');
select throws_ok(format($$ select public.start_payment(%L, 'fake', 'mtn_momo', '+237677100001') $$, tests.v('checkout1') ->> 'pay_token'),
  '42501', null, 'début du paiement : serveur uniquement');
select tests.as_service();
insert into vals select 'pay1', public.start_payment(tests.v('checkout1') ->> 'pay_token', 'fake', 'mtn_momo', '+237677100001');
select ok(tests.v('pay1') ->> 'external_id' ~ '^nx_[A-Za-z0-9]{20}$', 'référence NextIn transmise à l''agrégateur');
select tests.logout();
select is((select msisdn_masked from public.payments where external_id = tests.v('pay1') ->> 'external_id'), '+2376•• •• •• 01',
  'numéro débité gardé masqué');
select tests.as_service();
select is(public.confirm_payment(tests.v('pay1') ->> 'external_id', 'pending') ->> 'status', 'pending', 'en attente : rien ne change');
select is(public.confirm_payment(tests.v('pay1') ->> 'external_id', 'succeeded', 'fake-ref-1') ->> 'status', 'succeeded', 'paiement réussi');
select is(public.confirm_payment(tests.v('pay1') ->> 'external_id', 'succeeded', 'fake-ref-1') ->> 'already', 'true',
  'webhook rejoué : idempotent');
select is(public.confirm_payment(tests.v('pay1') ->> 'external_id', 'failed') ->> 'already', 'true',
  'paiement réglé : jamais retraité');
select throws_ok(format($$ select public.start_payment(%L, 'fake', 'mtn_momo', '+237677100001') $$, tests.v('checkout1') ->> 'pay_token'),
  'P0409', 'invoice_paid', 'facture payée : nouveau paiement refusé');
select tests.logout();
select is((select (s.status, p.code, s.current_period_end = s.trial_ends_at + interval '1 month')::text
           from public.subscriptions s join public.plans p on p.id = s.plan_id where s.organization_id = tests.id('d1')),
  '(active,essentiel,t)', 'abonnement actif tout de suite, jours d''essai restants conservés');
select is((select status::text from public.invoices where number = tests.v('checkout1') ->> 'invoice'), 'paid', 'facture payée');
select is((select count(*)::integer from public.account_messages where organization_id = tests.id('d1') and kind = 'payment_confirmed'), 2,
  '« paiement confirmé » sur WhatsApp et par e-mail');
select is((select count(*)::integer from public.subscription_events where organization_id = tests.id('d1') and type in ('paid', 'reactivated')), 2,
  'historique : paiement et réactivation (fin de l''essai)');

-- Immutabilité et numérotation sans trou.
select throws_ok(format($$ update public.invoices set total_xaf = 1 where number = %L $$, tests.v('checkout1') ->> 'invoice'), '42501',
  'issued invoices are immutable', 'montants d''une facture émise : figés');
select throws_ok(format($$ delete from public.invoices where number = %L $$, tests.v('checkout1') ->> 'invoice'), '42501',
  'invoices are never deleted', 'facture jamais supprimée');
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
insert into vals select 'checkout2', public.billing_checkout(tests.id('d1'), tests.id('pro'), 'annual');
select tests.logout();
select is(right(tests.v('checkout2') ->> 'invoice', 6)::integer, right(tests.v('checkout1') ->> 'invoice', 6)::integer + 1,
  'numéros consécutifs, sans trou');
select is((select (kind, lines @> '[{"kind": "credit"}]')::text from public.invoices where number = tests.v('checkout2') ->> 'invoice'),
  '(upgrade,t)', 'montée de formule : facture immédiate avec avoir de la période en cours');
select ok((select total_xaf < 450000 from public.invoices where number = tests.v('checkout2') ->> 'invoice'),
  'avoir déduit du prix annuel Pro');
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
select is(public.billing_checkout(tests.id('d1'), tests.id('essentiel'), 'monthly') ->> 'invoice' = tests.v('checkout2') ->> 'invoice', false,
  'autre choix : nouvelle facture');
select tests.logout();
select is((select status::text from public.invoices where number = tests.v('checkout2') ->> 'invoice'), 'void',
  'une seule facture à payer : la précédente est annulée');

-- ─── Limites de la formule (Essentiel : 3 guichets, 1 écran, ni distance ni rendez-vous) ─
delete from public.counters where branch_id = tests.id('d1_branch');
select lives_ok(format($$ insert into public.counters (organization_id, branch_id, kind, number)
  select %L, %L, 'cabinet', n from generate_series(1, 3) n $$, tests.id('d1'), tests.id('d1_branch')), 'trois guichets : permis');
select throws_ok(format($$ insert into public.counters (organization_id, branch_id, kind, number) values (%L, %L, 'cabinet', 4) $$,
  tests.id('d1'), tests.id('d1_branch')), 'P0403', 'plan_limit', 'quatrième guichet : limite de la formule');
select lives_ok(format($$ insert into public.counters (organization_id, branch_id, kind, number, active) values (%L, %L, 'cabinet', 5, false) $$,
  tests.id('d1'), tests.id('d1_branch')), 'guichet désactivé : non compté');
select throws_ok(format($$ update public.counters set active = true where branch_id = %L and number = 5 $$, tests.id('d1_branch')),
  'P0403', 'plan_limit', 'réactiver un guichet au-delà de la limite : refusé');
select lives_ok(format($$ insert into public.displays (organization_id, branch_id, name, status) values (%L, %L, 'TV 1', 'active') $$,
  tests.id('d1'), tests.id('d1_branch')), 'un écran : permis');
select throws_ok(format($$ insert into public.displays (organization_id, branch_id, name, status) values (%L, %L, 'TV 2', 'active') $$,
  tests.id('d1'), tests.id('d1_branch')), 'P0403', 'plan_limit', 'deuxième écran : limite de la formule');
select throws_ok(format($$ select public.assert_feature(%L, 'remote_tickets') $$, tests.id('d1')), 'P0403', 'feature_unavailable',
  'ticket à distance : hors formule Essentiel');
update public.branch_settings set remote_tickets_enabled = true where branch_id = tests.id('d1_branch');
select tests.as_service();
select throws_ok(format($$ select public.take_remote_ticket(%L, null, null, null, 'aa000000-0000-0000-0000-0000000000c2') $$,
  tests.id('d1_service')), 'P0403', 'feature_unavailable', 'ticket à distance refusé par la base (formule)');
select tests.logout();
select lives_ok(format($$ select public.assert_feature(%L, 'remote_tickets') $$, tests.id('pilot')), 'pilote : tout compris (formule Entreprise)');
select is((public.tv_session('inconnu') is null), true, 'écran inconnu : pas de session');
-- Descente de formule : refusée si les limites ne sont pas respectées.
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
select ok((select (x ->> 'fits')::boolean from jsonb_array_elements(public.billing_overview(tests.id('d1')) -> 'plans') x
           where x ->> 'code' = 'entreprise'), 'devis : formule supérieure compatible');
select tests.logout();

-- ─── Cycle de vie : dégradations différées, jamais en pleine journée ──────────
-- Période échue depuis 1 heure ; agence ouverte toute la journée.
update public.subscriptions set current_period_end = now() - interval '1 hour', current_period_start = now() - interval '1 month'
where organization_id = tests.id('d1');
select is(public.apply_pending_transitions() ->> 'scheduled', '1', 'échéance passée : passage en grâce programmé');
select ok((select pending_status = 'past_due' and pending_status_after >= now() from public.subscriptions where organization_id = tests.id('d1')),
  'programmé après la fermeture du jour');
update public.subscriptions set pending_status_after = now() - interval '1 minute' where organization_id = tests.id('d1');
select is(public.apply_pending_transitions() ->> 'applied', '0', 'agence encore ouverte : rien n''est appliqué');
select is((tests.sub(tests.id('d1'))).status::text, 'active', 'toujours actif pendant les heures d''ouverture');
select tests.set_open(tests.id('d1_branch'), false);
select is(public.apply_pending_transitions() ->> 'applied', '1', 'agences fermées : dégradation appliquée');
select is((select (status, grace_ends_at::date = (current_period_end + interval '7 days')::date)::text from public.subscriptions
           where organization_id = tests.id('d1')), '(past_due,t)', 'grâce de 7 jours (réglage de la plateforme)');
select is((public.org_entitlements(tests.id('d1')) ->> 'can_issue')::boolean, true, 'grâce : service complet');
update public.subscriptions set grace_ends_at = now() - interval '1 minute' where organization_id = tests.id('d1');
select public.apply_pending_transitions();
update public.subscriptions set pending_status_after = now() - interval '1 minute' where organization_id = tests.id('d1') and pending_status is not null;
select public.apply_pending_transitions();
select is((tests.sub(tests.id('d1'))).status::text, 'read_only', 'fin de la grâce : lecture seule');
update public.subscriptions set read_only_since = now() - interval '8 days' where organization_id = tests.id('d1');
select public.apply_pending_transitions();
update public.subscriptions set pending_status_after = now() - interval '1 minute' where organization_id = tests.id('d1') and pending_status is not null;
select public.apply_pending_transitions();
select is((select (s.status, o.status, o.suspended_reason, s.deletion_due_at::date = (now() + interval '30 days')::date)::text
           from public.subscriptions s join public.organizations o on o.id = s.organization_id where s.organization_id = tests.id('d1')),
  '(suspended,suspended,subscription,t)', 'lecture seule depuis 7 jours : suspendu, suppression dans 30 jours');

-- Rappels quotidiens : avis de suppression à J-7 avec lien de paiement (idempotent).
update public.subscriptions set deletion_due_at = now() + interval '7 days' where organization_id = tests.id('d1');
select ok(public.billing_daily() >= 2, 'avis de suppression envoyé (WhatsApp et e-mail)');
select is(public.billing_daily(), 0, 'tâche quotidienne rejouée : aucun doublon');
select ok((select payload ->> 'pay_token' ~ '^[A-Za-z0-9]{32}$' from public.account_messages
           where organization_id = tests.id('d1') and kind = 'deletion_notice' and channel = 'whatsapp'), 'rappel avec lien de paiement');

-- Paiement après suspension : réactivation immédiate, à toute heure.
select tests.set_open(tests.id('d1_branch'), true);
insert into vals select 'token3', to_jsonb(payload ->> 'pay_token') from public.account_messages
where organization_id = tests.id('d1') and kind = 'deletion_notice' and channel = 'whatsapp';
select tests.as_service();
insert into vals select 'pay3', public.start_payment(tests.t('token3'), 'fake', 'orange_money', '+237699100002');
select public.confirm_payment(tests.v('pay3') ->> 'external_id', 'succeeded');
select tests.logout();
select is((select (s.status, o.status, s.deletion_due_at is null, s.current_period_end > now() + interval '27 days')::text
           from public.subscriptions s join public.organizations o on o.id = s.organization_id where s.organization_id = tests.id('d1')),
  '(active,active,t,t)', 'paiement : établissement réactivé immédiatement, nouvelle période');

-- ─── Quotas WhatsApp ─────────────────────────────────────────────────────────
insert into public.messaging_usage (organization_id, month, whatsapp_sent)
values (tests.id('d1'), date_trunc('month', now() at time zone 'Africa/Douala')::date, 1199);
select public.count_messaging_usage(tests.id('d1'), 'whatsapp');
select is((select count(*)::integer from public.account_messages where organization_id = tests.id('d1') and kind = 'quota_alert'), 2,
  'alerte au seuil de 80 % du quota (1 500 messages)');
select public.count_messaging_usage(tests.id('d1'), 'whatsapp');
select is((select count(*)::integer from public.account_messages where organization_id = tests.id('d1') and kind = 'quota_alert'), 2,
  'alerte une seule fois par mois');
select is(public.whatsapp_quota_exceeded(tests.id('d1')), false, 'quota pas encore atteint');
update public.messaging_usage set whatsapp_sent = 1500 where organization_id = tests.id('d1');
select is(public.whatsapp_quota_exceeded(tests.id('d1')), true, 'quota atteint');

-- ─── Messages du compte : secours SMS ─────────────────────────────────────────
select tests.as_service();
select is((select count(*)::integer from public.claim_account_messages(100)) > 0, true, 'expéditeur : messages du compte réclamés');
select public.complete_account_message((select id from public.account_messages where organization_id = tests.id('d1')
  and kind = 'deletion_notice' and channel = 'whatsapp'), 'failed', 'test');
select tests.logout();
select is((select count(*)::integer from public.account_messages where organization_id = tests.id('d1') and kind = 'deletion_notice' and channel = 'sms'), 1,
  'WhatsApp en échec : avis envoyé par SMS');

-- ─── Super admin ─────────────────────────────────────────────────────────────
select tests.login_as('aa000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select public.admin_subscriptions() $$, '42501', 'not_allowed', 'console super admin : refusée aux établissements');
select throws_ok($$ select public.admin_update_settings('{"trial_days": 90}') $$, '42501', 'not_allowed', 'réglages : super admin uniquement');
select tests.login_as('aa000000-0000-0000-0000-0000000000ff');
select ok(jsonb_array_length(public.admin_subscriptions('all', 'Clinique')) >= 2, 'super admin : tous les abonnements');
select ok((public.admin_revenue() ->> 'collected_month_xaf')::integer >= 25000, 'super admin : encaissements du mois');
select lives_ok(format($$ select public.admin_grant_days(%L, 10, 'Geste commercial') $$, (tests.sub(tests.id('d2'))).id),
  'offrir des jours');
select is((tests.sub(tests.id('d2'))).status::text, 'trialing', 'jours offerts : lecture seule levée immédiatement');
select lives_ok(format($$ select public.admin_apply_discount(%L, 'percent', 20, 2, 'Partenaire') $$, tests.id('d2')), 'remise sur deux factures');
select lives_ok(format($$ select public.admin_update_plan(%L, '{"base_price_xaf": 50000}') $$, tests.id('pro')), 'prix modifiable sans déploiement');
select lives_ok($$ select public.admin_update_settings('{"trial_days": 21}') $$, 'durée de l''essai modifiable');
select lives_ok(format($$ select public.admin_set_suspension(%L, true, 'Fraude signalée') $$, tests.id('d2')), 'suspension pour modération');
select tests.logout();
select is((select (status, suspended_reason)::text from public.organizations where id = tests.id('d2')),
  '(suspended,"moderation: Fraude signalée")', 'motif de modération distinct du paiement');
select tests.login_as('aa000000-0000-0000-0000-0000000000d2');
insert into vals select 'checkout4', public.billing_checkout(tests.id('d2'), tests.id('pro'), 'monthly');
select tests.logout();
select is((tests.v('checkout4') ->> 'total_xaf')::integer, 40000, 'nouveau prix (50 000) et remise de 20 % appliqués');
select is((select remaining_invoices::integer from public.discounts where organization_id = tests.id('d2')), 1, 'remise : une facture restante');
select is((select count(*)::integer from public.audit_log where action in ('subscription.grant_days', 'subscription.discount', 'plan.update',
  'platform.settings', 'org.suspend')), 5, 'actions du super admin journalisées');

-- ─── RLS ─────────────────────────────────────────────────────────────────────
select tests.as_anon();
select throws_ok($$ select * from public.subscriptions $$, '42501', null, 'visiteur : abonnements inaccessibles');
select tests.login_as('aa000000-0000-0000-0000-0000000000c1', true);
select is((select count(*)::integer from public.subscriptions), 0, 'session anonyme : aucun abonnement visible');
select tests.login_as('aa000000-0000-0000-0000-0000000000d2');
select is((select count(*)::integer from public.subscriptions), 1, 'directeur : son seul abonnement');
select throws_ok($$ select * from public.account_messages $$, '42501', null, 'messages du compte : jamais lisibles');
select throws_ok($$ select * from public.phone_verifications $$, '42501', null, 'vérifications du téléphone : jamais lisibles');
select tests.logout();
select is((select count(*)::integer from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
           where t.schemaname = 'public' and not c.relrowsecurity), 0, 'RLS activée sur toutes les tables');

select * from finish();
rollback;
