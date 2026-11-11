-- pgTAP — C1 : paiement manuel dans la console (espèces, virement, chèque, Mobile Money hors ligne). Même effet qu'un
-- paiement en ligne (facture payée, abonnement actif, événement, message de confirmation), journalisé ; annulation
-- avec motif (état d'avant rétabli, refusée si un paiement plus récent a suivi) ; droits ; lecture par Wintek seulement.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
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
  ('8e000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wintek@manuel.test', now()),
  ('8e000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dir@manuel.test', now());
insert into public.platform_admins (user_id) values ('8e000000-0000-0000-0000-0000000000a1');

-- Établissement en essai (créé depuis la console, P1), responsable inscrit.
select tests.login_as('8e000000-0000-0000-0000-0000000000a1');
insert into vals select 'r', public.admin_create_organization(jsonb_build_object(
  'name', 'Clinique Paiement Manuel', 'type', 'clinic', 'locale', 'fr', 'slug', 'pgtap-manuel',
  'plan_id', (select id from public.plans where code = 'starter'), 'trial_days', 30,
  'owner_email', 'dir@manuel.test', 'branch_name', 'Akwa', 'services', '[]'::jsonb, 'reason', 'Contrat signé'))::text;
select tests.logout();
insert into vals select 'org', tests.v('r')::jsonb ->> 'organization_id';
select tests.login_as('8e000000-0000-0000-0000-0000000000a2');
select public.accept_invitation(tests.v('r')::jsonb ->> 'token');
select tests.logout();
insert into vals select 'sub', id::text from public.subscriptions where organization_id = tests.v('org')::uuid;
insert into vals select 'trial_end', trial_ends_at::text from public.subscriptions where id = tests.v('sub')::uuid;
insert into vals select 'inv', (public.issue_invoice(tests.v('sub')::uuid)).id::text;
insert into vals select 'total', total_xaf::text from public.invoices where id = tests.v('inv')::uuid;

-- ─── Droits ──────────────────────────────────────────────────────────────────
select tests.login_as('8e000000-0000-0000-0000-0000000000a2');
select throws_ok(format($$ select public.admin_record_manual_payment(%L, '{"method":"cash"}') $$, tests.v('inv')), '42501', null,
  'administratrice de l''établissement : refusé (console seulement)');
select tests.logout();
insert into vals select 'anon_sql', format('select public.admin_record_manual_payment(%L, %L)', tests.v('inv'), '{}');
set local role anon;
select throws_ok((select v from vals where name = 'anon_sql'), '42501', null, 'visiteur : pas de droit d''exécution');
reset role;

-- ─── Validation ──────────────────────────────────────────────────────────────
select tests.login_as('8e000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.admin_record_manual_payment(%L, jsonb_build_object('method', 'cash', 'amount_xaf', %s, 'paid_on', current_date)) $$,
  tests.v('inv'), tests.v('total')::integer - 1), '22023', 'amount_mismatch', 'montant différent du total : refusé');
select throws_ok(format($$ select public.admin_record_manual_payment(%L, jsonb_build_object('method', 'transfer', 'amount_xaf', %s, 'paid_on', current_date)) $$,
  tests.v('inv'), tests.v('total')), '22023', 'reference_required', 'virement sans référence : refusé');
select throws_ok(format($$ select public.admin_record_manual_payment(%L, jsonb_build_object('method', 'cash', 'amount_xaf', %s, 'paid_on', current_date + 1)) $$,
  tests.v('inv'), tests.v('total')), '22023', 'invalid_date', 'date future : refusée');
select throws_ok(format($$ select public.admin_record_manual_payment(%L, jsonb_build_object('method', 'bitcoin', 'amount_xaf', %s, 'paid_on', current_date)) $$,
  tests.v('inv'), tests.v('total')), '22023', 'invalid_method', 'mode inconnu : refusé');

-- ─── Paiement en espèces reçu hier ───────────────────────────────────────────
insert into vals select 'pay', public.admin_record_manual_payment(tests.v('inv')::uuid, jsonb_build_object(
  'method', 'cash', 'amount_xaf', tests.v('total')::integer, 'paid_on', (now() at time zone 'Africa/Douala')::date - 1,
  'reference', 'REÇU-0042', 'note', 'Remis au bureau de Douala'))::text;
select tests.logout();
select is(tests.v('pay')::jsonb ->> 'status', 'succeeded', 'paiement enregistré');
select is((select status::text from public.invoices where id = tests.v('inv')::uuid), 'paid', 'facture payée');
select is((select (paid_at at time zone 'Africa/Douala')::date from public.invoices where id = tests.v('inv')::uuid),
  (now() at time zone 'Africa/Douala')::date - 1, 'payée à la date de réception');
select is((select status::text from public.subscriptions where id = tests.v('sub')::uuid), 'active', 'abonnement actif (comme un paiement en ligne)');
select ok((select current_period_end > now() from public.subscriptions where id = tests.v('sub')::uuid), 'période en cours');
select is((select payload ->> 'provider' from public.subscription_events where subscription_id = tests.v('sub')::uuid and type = 'paid'),
  'manual:cash', 'événement « payé » (mode manuel)');
select is((select count(*)::integer from public.account_messages where organization_id = tests.v('org')::uuid and kind = 'payment_confirmed'), 1,
  'message de confirmation envoyé au client');
select is((select diff ->> 'reference' from public.audit_log where action = 'payment.manual_recorded' and entity_id = tests.v('inv')::uuid),
  'REÇU-0042', 'journalisé avec la référence');
select tests.login_as('8e000000-0000-0000-0000-0000000000a2');
select is((public.invoice_document(tests.v('inv')::uuid)) ->> 'manual_method', 'cash', 'facture : mode du paiement (PDF)');
select is((select count(*)::integer from public.manual_payments), 0, 'administratrice de l''établissement : ne lit pas les paiements manuels');
select tests.logout();
select tests.login_as('8e000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$ select public.admin_record_manual_payment(%L, jsonb_build_object('method', 'cash', 'amount_xaf', %s, 'paid_on', current_date)) $$,
  tests.v('inv'), tests.v('total')), 'P0409', 'invoice_not_open', 'facture déjà payée : refusé');

-- ─── Annulation ──────────────────────────────────────────────────────────────
select throws_ok(format($$ select public.admin_cancel_manual_payment(%L, '') $$, tests.v('pay')::jsonb ->> 'manual_payment'),
  '22023', 'reason_required', 'annulation : motif obligatoire');
select lives_ok(format($$ select public.admin_cancel_manual_payment(%L, 'Saisie sur la mauvaise facture') $$, tests.v('pay')::jsonb ->> 'manual_payment'),
  'annulation avec motif');
select tests.logout();
select is((select status::text || ':' || coalesce(paid_at::text, '-') from public.invoices where id = tests.v('inv')::uuid), 'open:-', 'facture de nouveau ouverte');
select is((select status::text || ':' || trial_ends_at::text from public.subscriptions where id = tests.v('sub')::uuid),
  'trialing:' || tests.v('trial_end'), 'abonnement rétabli (essai, même fin)');
select is((select payload ->> 'reason' from public.subscription_events where subscription_id = tests.v('sub')::uuid and type = 'payment_cancelled'),
  'Saisie sur la mauvaise facture', 'événement « paiement annulé » avec le motif');
select is((select diff ->> 'reason' from public.audit_log where action = 'payment.manual_cancelled' and entity_id = tests.v('inv')::uuid),
  'Saisie sur la mauvaise facture', 'annulation journalisée');

-- ─── Nouveau paiement (virement), puis un renouvellement payé : l'annulation du premier est refusée ─────
select tests.login_as('8e000000-0000-0000-0000-0000000000a1');
insert into vals select 'pay2', public.admin_record_manual_payment(tests.v('inv')::uuid, jsonb_build_object(
  'method', 'transfer', 'amount_xaf', tests.v('total')::integer, 'paid_on', (now() at time zone 'Africa/Douala')::date - 1,
  'reference', 'VIR-2026-118'))::text;
select tests.logout();
select is((select status::text from public.invoices where id = tests.v('inv')::uuid), 'paid', 'après annulation : un nouveau paiement est possible');
insert into vals select 'inv2', (public.issue_invoice(tests.v('sub')::uuid)).id::text;
select tests.login_as('8e000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$ select public.admin_record_manual_payment(%L, jsonb_build_object('method', 'mobile_money_offline', 'amount_xaf',
  (select total_xaf from public.invoices where id = %L), 'paid_on', (now() at time zone 'Africa/Douala')::date, 'reference', 'MP2611.1830.A12345')) $$,
  tests.v('inv2'), tests.v('inv2')), 'renouvellement payé par Mobile Money hors ligne');
select throws_ok(format($$ select public.admin_cancel_manual_payment(%L, 'Erreur') $$, tests.v('pay2')::jsonb ->> 'manual_payment'),
  'P0409', 'cancel_not_latest', 'un paiement plus récent a suivi : annulation refusée');
select tests.logout();

select * from finish();
rollback;
