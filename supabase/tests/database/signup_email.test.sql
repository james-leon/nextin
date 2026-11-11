-- pgTAP — B2 : code d'inscription d'un établissement par e-mail (canal par défaut de la console), mêmes règles que le
-- code des demandes de rendez-vous (haché, 10 minutes, 5 essais, limites), téléphone gardé sans vérification, un seul
-- essai gratuit par adresse et par numéro ; canal SMS (parcours téléphone) ; droits (serveur uniquement).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);
alter table public.branch_settings alter column customer_name_mode set default 'off';

create schema tests;
create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, now())
  returning id;
$$;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
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
grant usage on schema tests to authenticated, service_role;
create temp table vals (name text primary key, v jsonb) on commit drop;
grant all on vals to authenticated, service_role;
create function tests.v(p_name text) returns jsonb language sql as $$ select v from vals where name = p_name $$;
create function tests.vid(p_name text) returns uuid language sql as $$ select (v ->> 'verification_id')::uuid from vals where name = p_name $$;
-- Code encore lisible dans la file d'envoi (effacé après vérification).
create function tests.code(p_verification uuid) returns text language sql security definer as $$
  select payload ->> 'code' from public.account_messages where dedupe_key like 'phone_code:' || p_verification || ':%' limit 1
$$;
create function tests.wrong(p_code text) returns text language sql as $$ select case when p_code = '000000' then '111111' else '000000' end $$;
grant execute on all functions in schema tests to authenticated, service_role;

select tests.create_user('b2000000-0000-0000-0000-0000000000a1', 'directrice@b2.test');
select tests.create_user('b2000000-0000-0000-0000-0000000000a2', 'autre@b2.test');
select tests.create_user('b2000000-0000-0000-0000-0000000000a3', 'troisieme@b2.test');
delete from public.rate_limits where key like 'signup_code:%' or key like 'phone_code:%' or key like 'signup:%';

select is((select signup_code_channel from public.platform_settings), 'email', 'canal par défaut : e-mail');

-- ─── Droits : serveur de l'application uniquement (captcha vérifié avant) ────
select tests.login_as('b2000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.request_signup_code('b2000000-0000-0000-0000-0000000000a1', '+237677200001') $$, '42501', null,
  'code d''inscription : jamais appelable par une session');

-- ─── Envoi par e-mail ─────────────────────────────────────────────────────────
select tests.as_service();
select throws_ok($$ select public.request_signup_code('b2000000-0000-0000-0000-0000000000a1', '+33612345678') $$, 'P0422', 'phone_invalid',
  'numéro toujours demandé et contrôlé');
insert into vals select 'r1', public.request_signup_code('b2000000-0000-0000-0000-0000000000a1', '+237677200001', 'fr');
select tests.logout();
select is(tests.v('r1') ->> 'channel', 'email', 'code envoyé par e-mail');
select is(tests.v('r1') ->> 'destination', 'd•••@b2.test', 'adresse masquée');
select is((select (channel, to_email, to_phone is null, locale)::text from public.account_messages
           where dedupe_key = 'phone_code:' || tests.vid('r1') || ':email'),
  '(email,directrice@b2.test,t,fr)', 'message à l''adresse du compte, aucun SMS ni WhatsApp');
select ok(tests.code(tests.vid('r1')) ~ '^[0-9]{6}$', 'code à 6 chiffres');
select is((select (channel, code_hash ~ '^[0-9a-f]{64}$', code_hash <> tests.code(tests.vid('r1')),
                   expires_at between now() + interval '9 minutes' and now() + interval '10 minutes 1 second')::text
           from public.phone_verifications where id = tests.vid('r1')),
  '(email,t,t,t)', 'code haché en base, 10 minutes');
insert into vals select 'c1', to_jsonb(tests.code(tests.vid('r1')));

-- ─── Vérification : 5 essais ──────────────────────────────────────────────────
select tests.login_as('b2000000-0000-0000-0000-0000000000a1');
select is(public.verify_phone_code(tests.vid('r1'), tests.wrong(tests.v('c1') #>> '{}')) ->> 'attempts_left', '4', 'mauvais code : 4 essais restants');
select is(public.verify_phone_code(tests.vid('r1'), tests.v('c1') #>> '{}') ->> 'verified', 'true', 'bon code : adresse vérifiée');
select tests.logout();
select is(tests.code(tests.vid('r1')), null, 'code effacé de la file après vérification');

-- Inscription : essai, numéro gardé (non vérifié).
select tests.login_as('b2000000-0000-0000-0000-0000000000a1');
insert into vals select 's1', public.self_service_signup('Clinique B2', 'pgtap-b2-one', 'clinic', 'fr', tests.vid('r1'));
select tests.logout();
select is(tests.v('s1') ->> 'trial', 'true', 'premier établissement de l''adresse et du numéro : essai');
select is((select phone_e164 from public.organizations where id = (tests.v('s1') ->> 'organization_id')::uuid), '+237677200001',
  'téléphone gardé sur l''établissement (contact, rappels)');
select is((select payload ->> 'verified_by' from public.subscription_events
           where organization_id = (tests.v('s1') ->> 'organization_id')::uuid and type = 'trial_started'), 'email',
  'canal de vérification journalisé');

-- Même adresse, autre numéro : pas de second essai.
select tests.as_service();
insert into vals select 'r2', public.request_signup_code('b2000000-0000-0000-0000-0000000000a1', '+237677200002', 'fr');
select tests.logout();
select tests.login_as('b2000000-0000-0000-0000-0000000000a1');
select public.verify_phone_code(tests.vid('r2'), tests.code(tests.vid('r2')));
insert into vals select 's2', public.self_service_signup('Clinique B2 bis', 'pgtap-b2-two', 'clinic', 'fr', tests.vid('r2'));
select tests.logout();
select is(tests.v('s2') ->> 'trial', 'false', 'adresse déjà utilisée pour un essai : pas de second essai');

-- Autre adresse, même numéro : pas de second essai non plus.
select tests.as_service();
insert into vals select 'r3', public.request_signup_code('b2000000-0000-0000-0000-0000000000a2', '+237677200001', 'en');
select tests.logout();
select is(tests.v('r3') ->> 'destination', 'a•••@b2.test', 'autre compte : sa propre adresse');
select is((select locale from public.account_messages where dedupe_key = 'phone_code:' || tests.vid('r3') || ':email'), 'en', 'message en anglais');
select tests.login_as('b2000000-0000-0000-0000-0000000000a2');
select public.verify_phone_code(tests.vid('r3'), tests.code(tests.vid('r3')));
insert into vals select 's3', public.self_service_signup('Clinic B2', 'pgtap-b2-three', 'clinic', 'en', tests.vid('r3'));
select tests.logout();
select is(tests.v('s3') ->> 'trial', 'false', 'numéro déjà utilisé pour un essai : pas de second essai');

-- 5 mauvais codes : code expiré.
select tests.as_service();
insert into vals select 'r4', public.request_signup_code('b2000000-0000-0000-0000-0000000000a3', '+237677200003', 'fr');
select tests.logout();
insert into vals select 'c4', to_jsonb(tests.code(tests.vid('r4')));
select tests.login_as('b2000000-0000-0000-0000-0000000000a3');
select public.verify_phone_code(tests.vid('r4'), tests.wrong(tests.v('c4') #>> '{}')) from generate_series(1, 5);
select throws_ok(format($$ select public.verify_phone_code(%L, %L) $$, tests.vid('r4'), tests.v('c4') #>> '{}'), 'P0409', 'code_expired',
  'après 5 essais, même le bon code est refusé');
select tests.logout();

-- Limite : 3 codes par heure et par adresse.
select tests.as_service();
select public.request_signup_code('b2000000-0000-0000-0000-0000000000a3', '+237677200003', 'fr') from generate_series(1, 2);
select throws_ok($$ select public.request_signup_code('b2000000-0000-0000-0000-0000000000a3', '+237677200003', 'fr') $$, 'P0429', 'rate_limited',
  '4e code dans l''heure pour la même adresse : refusé');
select tests.logout();

-- ─── Canal SMS (fournisseur prêt) : parcours téléphone ──────────────────────
update public.platform_settings set signup_code_channel = 'sms';
select tests.as_service();
insert into vals select 'r5', public.request_signup_code('b2000000-0000-0000-0000-0000000000a2', '+237677200005', 'fr');
select tests.logout();
select is(tests.v('r5') ->> 'channel', 'phone', 'canal SMS : téléphone vérifié');
select is(tests.v('r5') ->> 'destination', '+237 6 •• •• •• 05', 'numéro masqué');
select is((select array_agg(channel order by channel)::text from public.account_messages where dedupe_key like 'phone_code:' || tests.vid('r5') || ':%'),
  '{whatsapp}', 'aucun e-mail : WhatsApp (SMS de secours en cas d''échec)');

select * from finish();
rollback;
