-- B2 — Inscription d'un établissement : code de vérification envoyé par e-mail tant qu'aucun fournisseur SMS n'est
-- configuré. Canal réglé dans la console Wintek (`platform_settings.signup_code_channel`) : `email` par défaut,
-- `sms` = parcours téléphone existant (WhatsApp, SMS en secours). Mêmes règles que le code des demandes de rendez-vous :
-- 6 chiffres hachés, 10 minutes, 5 essais, limites par adresse et par compte, captcha vérifié par le serveur.
-- En mode e-mail, le téléphone reste demandé (contact et rappels) mais n'est pas vérifié.
-- Un seul essai gratuit par numéro **et** par adresse e-mail.
--
-- Compatibilité avec le code en ligne : `request_phone_code`, `verify_phone_code` et `self_service_signup` gardent
-- leur signature ; seuls des colonnes avec valeur par défaut, une table et une fonction sont ajoutées.

alter table public.platform_settings
  add column signup_code_channel text not null default 'email' check (signup_code_channel in ('email', 'sms'));

alter table public.phone_verifications
  -- Canal du code : `phone` (WhatsApp / SMS, téléphone vérifié) ou `email` (adresse du compte vérifiée).
  add column channel text not null default 'phone' check (channel in ('phone', 'email'));

-- Un seul essai par adresse e-mail (empreinte salée, comme pour les numéros).
create table public.trial_email_claims (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  organization_id uuid references public.organizations (id) on delete set null,
  claimed_at timestamptz not null default now()
);
alter table public.trial_email_claims enable row level security;
-- Aucune politique : lu et écrit seulement par `self_service_signup` (SECURITY DEFINER).

create or replace function public.email_fingerprint(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.sha256_hex('nextin-trial-email:' || lower(trim(p_email)));
$$;

/**
 * Code de vérification de l'inscription (serveur de l'application, après captcha). Canal de la console :
 * - `sms` : parcours téléphone (`request_phone_code`) ;
 * - `email` : code envoyé à l'adresse du compte ; le numéro est gardé sans être vérifié.
 * Renvoie { verification_id, channel, destination } (destination masquée).
 */
create or replace function public.request_signup_code(p_user uuid, p_phone text, p_locale text default 'fr')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
  v_email text;
  v_code text := public.random_string(6, '0123456789');
  v_id uuid;
  v_locale text := case when p_locale = 'en' then 'en' else 'fr' end;
begin
  if p_user is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_phone is null or p_phone !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  select signup_code_channel into v_channel from public.platform_settings;
  if coalesce(v_channel, 'email') = 'sms' then
    v_id := public.request_phone_code(p_user, p_phone, v_locale);
    return jsonb_build_object('verification_id', v_id, 'channel', 'phone',
      'destination', '+237 ' || substr(p_phone, 5, 1) || ' •• •• •• ' || right(p_phone, 2));
  end if;

  select email into v_email from auth.users where id = p_user;
  if v_email is null then raise exception 'email_required' using errcode = 'P0422'; end if;
  if not public.check_rate_limit('signup_code:' || public.email_fingerprint(v_email), 3, interval '1 hour')
     or not public.check_rate_limit('phone_code:uid:' || p_user, 6, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  insert into public.phone_verifications (user_id, phone_e164, phone_hash, code_hash, expires_at, channel)
  values (p_user, p_phone, public.phone_fingerprint(p_phone), '', now() + interval '10 minutes', 'email')
  returning id into v_id;
  update public.phone_verifications set code_hash = public.sha256_hex(v_code || ':' || v_id) where id = v_id;
  -- Clé `phone_code:<id>:email` : le code est effacé de la file après vérification (`clear_phone_code`).
  insert into public.account_messages (organization_id, kind, channel, to_email, locale, payload, dedupe_key)
  values (null, 'phone_code', 'email', v_email, v_locale, jsonb_build_object('code', v_code), 'phone_code:' || v_id || ':email');
  perform public.kick_notification_dispatch();
  return jsonb_build_object('verification_id', v_id, 'channel', 'email', 'destination', public.mask_email(v_email));
end;
$$;

/**
 * Inscription (M10a, B2) : comme avant, mais un seul essai par numéro **et** par adresse e-mail du compte.
 * Un numéro ou une adresse ayant déjà servi : l'établissement est créé en lecture seule (paiement requis).
 */
create or replace function public.self_service_signup(
  p_name text, p_slug text, p_type public.org_type, p_default_locale text, p_verification uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_v public.phone_verifications;
  v_org uuid;
  v_settings public.platform_settings;
  v_trial_plan uuid;
  v_trial boolean;
  v_phone_free boolean;
  v_email_free boolean := true;
  v_sub uuid;
  v_email text;
begin
  if v_user is null or public.is_anonymous() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_v from public.phone_verifications
  where id = p_verification and user_id = v_user and verified_at is not null and used_at is null
    and verified_at > now() - interval '1 hour'
  for update;
  if not found then raise exception 'phone_not_verified' using errcode = 'P0422'; end if;
  if not public.check_rate_limit('signup:uid:' || v_user, 3, interval '1 day') then
    raise exception 'too_many_organizations' using errcode = 'P0429';
  end if;
  v_org := public.create_organization(p_name, p_slug, p_type, p_default_locale);
  update public.organizations set phone_e164 = v_v.phone_e164 where id = v_org;
  update public.phone_verifications set used_at = now(), phone_e164 = null where id = v_v.id;

  select * into v_settings from public.platform_settings;
  select id into v_trial_plan from public.plans where trial_eligible and active and not quote_only order by sort_order limit 1;
  if v_trial_plan is null then
    select id into v_trial_plan from public.plans where active and not quote_only order by sort_order limit 1;
  end if;
  select email into v_email from auth.users where id = v_user;
  -- Un seul essai par numéro et par adresse : les deux empreintes sont réservées ensemble.
  v_phone_free := not exists (select 1 from public.trial_claims where phone_hash = v_v.phone_hash);
  if v_email is not null then
    v_email_free := not exists (select 1 from public.trial_email_claims where email_hash = public.email_fingerprint(v_email));
  end if;
  v_trial := v_phone_free and v_email_free;
  if v_trial then
    insert into public.trial_claims (phone_hash, organization_id) values (v_v.phone_hash, v_org) on conflict (phone_hash) do nothing;
    v_trial := found;
    if v_trial and v_email is not null then
      insert into public.trial_email_claims (email_hash, organization_id) values (public.email_fingerprint(v_email), v_org)
      on conflict (email_hash) do nothing;
      v_trial := found;
    end if;
  end if;
  insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at, read_only_since, billing_phone_e164, billing_email, locale)
  values (v_org, v_trial_plan, case when v_trial then 'trialing' else 'read_only' end::public.subscription_status,
    case when v_trial then now() + make_interval(days => v_settings.trial_days) end,
    case when v_trial then null else now() end,
    v_v.phone_e164, v_email, case when p_default_locale = 'en' then 'en' else 'fr' end)
  returning id into v_sub;
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_sub, v_org, case when v_trial then 'trial_started' else 'no_trial' end, v_user,
    jsonb_build_object('trial_days', case when v_trial then v_settings.trial_days else 0 end, 'verified_by', v_v.channel));
  perform public.audit(v_org, 'subscription.create', 'subscription', v_sub, jsonb_build_object('trial', v_trial, 'verified_by', v_v.channel));
  return jsonb_build_object('organization_id', v_org, 'trial', v_trial);
end;
$$;

/** Console Wintek : réglages, avec le canal du code d'inscription. */
create or replace function public.admin_update_settings(p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  update public.platform_settings set
    company_legal_name = coalesce(p_fields ->> 'company_legal_name', company_legal_name),
    company_rc = coalesce(p_fields ->> 'company_rc', company_rc),
    company_niu = coalesce(p_fields ->> 'company_niu', company_niu),
    company_address = coalesce(p_fields ->> 'company_address', company_address),
    company_phone = coalesce(p_fields ->> 'company_phone', company_phone),
    company_email = coalesce(p_fields ->> 'company_email', company_email),
    invoice_footer = coalesce(p_fields ->> 'invoice_footer', invoice_footer),
    trial_days = coalesce((p_fields ->> 'trial_days')::smallint, trial_days),
    grace_days = coalesce((p_fields ->> 'grace_days')::smallint, grace_days),
    read_only_days = coalesce((p_fields ->> 'read_only_days')::smallint, read_only_days),
    retention_after_suspension_days = coalesce((p_fields ->> 'retention_after_suspension_days')::smallint, retention_after_suspension_days),
    default_closing_time = coalesce((p_fields ->> 'default_closing_time')::time, default_closing_time),
    vat_rate = coalesce((p_fields ->> 'vat_rate')::numeric, vat_rate),
    invoice_lead_days = coalesce((p_fields ->> 'invoice_lead_days')::smallint, invoice_lead_days),
    quota_alert_percent = coalesce((p_fields ->> 'quota_alert_percent')::smallint, quota_alert_percent),
    request_channels = case when jsonb_typeof(p_fields -> 'request_channels') = 'array'
      then array(select v from jsonb_array_elements_text(p_fields -> 'request_channels') with ordinality e(v, n) order by n)
      else request_channels end,
    signup_code_channel = coalesce(p_fields ->> 'signup_code_channel', signup_code_channel),
    updated_by = (select auth.uid())
  where id;
  perform public.audit(null, 'platform.settings', 'platform_settings', null, p_fields);
end;
$$;

revoke execute on function public.request_signup_code(uuid, text, text), public.email_fingerprint(text) from public, anon, authenticated;
-- Serveur de l'application seulement (captcha vérifié avant).
grant execute on function public.request_signup_code(uuid, text, text) to service_role;
