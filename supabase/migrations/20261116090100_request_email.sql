-- Demandes de rendez-vous en ligne : vérification par e-mail tant que WhatsApp est désactivé (docs/modules/RDV-EMAIL.md).
-- Le patient saisit son adresse e-mail (téléphone facultatif, pour l'accueil) ; code à 6 chiffres envoyé par e-mail,
-- mêmes règles que le code WhatsApp (empreinte en base, 10 minutes, 5 essais, 3 envois, limites par adresse, appareil
-- et IP, captcha). Réponse de l'accueil et rappels par e-mail, et par notification du navigateur si le patient l'a autorisée.
-- Canaux proposés réglés dans la console Wintek (`platform_settings.request_channels`) : e-mail par défaut ; WhatsApp et
-- SMS prévus (premier canal activé utilisé, choix du patient si plusieurs le sont).
-- L'adresse suit les règles des données personnelles : personnel de l'agence seulement, purgée après `data_retention_days`.

-- ─── Réglages de la plateforme ───────────────────────────────────────────────

alter table public.platform_settings
  add column request_channels text[] not null default '{email}'
    check (cardinality(request_channels) between 1 and 3 and request_channels <@ array['email', 'whatsapp', 'sms']);

/** Réglages de la plateforme (super admin), dont les canaux des demandes de rendez-vous en ligne. */
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
    -- Canaux des demandes de rendez-vous en ligne, dans l'ordre de préférence.
    request_channels = case when jsonb_typeof(p_fields -> 'request_channels') = 'array'
      then array(select v from jsonb_array_elements_text(p_fields -> 'request_channels') with ordinality e(v, n) order by n)
      else request_channels end,
    updated_by = (select auth.uid())
  where id;
  perform public.audit(null, 'platform.settings', 'platform_settings', null, p_fields);
end;
$$;

-- ─── Adresse e-mail : demandes, rendez-vous, contacts ───────────────────────

alter table public.appointment_requests
  add column email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  -- Canal du code de vérification et des réponses.
  add column verify_channel text not null default 'whatsapp' check (verify_channel in ('email', 'whatsapp', 'sms')),
  -- Identité du demandeur pour les doublons et les limites : adresse e-mail, sinon numéro.
  add column requester_key text generated always as (coalesce(lower(email), phone_e164)) stored;
drop index public.appointment_requests_slot_uidx;
create unique index appointment_requests_slot_uidx on public.appointment_requests
  (branch_id, requester_key, public.request_slot_key(preferred_starts_at, preferred_day, preferred_period))
  where status = 'pending' and requester_key is not null;

alter table public.appointments
  add column email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

alter table public.notification_contacts
  add column email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
alter table public.notification_contacts
  drop constraint notification_contacts_channel_check,
  drop constraint notification_contacts_target_check;
alter table public.notification_contacts
  add constraint notification_contacts_channel_check check (channel in ('whatsapp', 'push', 'email', 'sms')),
  add constraint notification_contacts_target_check check (
    (channel in ('whatsapp', 'sms') and phone_e164 is not null)
    or (channel = 'push' and push_subscription ? 'endpoint' and phone_e164 is null)
    or (channel = 'email' and email is not null and phone_e164 is null)
  );
-- Une demande peut avoir son contact de vérification et des abonnements push.
drop index public.notification_contacts_request_uidx;
create unique index notification_contacts_request_uidx on public.notification_contacts
  (appointment_request_id, channel, coalesce(push_subscription ->> 'endpoint', ''))
  where appointment_request_id is not null and appointment_id is null and ticket_id is null;

/** Adresse masquée (« e•••@gmail.com ») : jamais l'adresse complète hors personnel de l'agence. */
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_email is null or position('@' in p_email) = 0 then null
              else left(p_email, 1) || '•••' || substr(p_email, position('@' in p_email)) end;
$$;

-- ─── Doublons et limites par demandeur (adresse ou numéro) ──────────────────

drop function public.assert_request_allowed(uuid, text, text, uuid);

/**
 * Contrôle avant d'enregistrer (ou de vérifier) une demande : même créneau déjà en attente pour ce demandeur
 * (adresse e-mail, sinon numéro) → `request_duplicate` ; trop de demandes en attente → `request_limit`.
 */
create function public.assert_request_allowed(p_branch uuid, p_key text, p_slot text, p_exclude uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('appointment_request:' || p_branch || ':' || p_key, 0));
  if exists (
    select 1 from public.appointment_requests r
    where r.branch_id = p_branch and r.requester_key = p_key and r.status = 'pending' and r.id is distinct from p_exclude
      and public.request_slot_key(r.preferred_starts_at, r.preferred_day, r.preferred_period) = p_slot
  ) then
    raise exception 'request_duplicate' using errcode = 'P0409';
  end if;
  select appointment_request_max_pending into v_max from public.branch_settings where branch_id = p_branch;
  if (select count(*) from public.appointment_requests r
      where r.branch_id = p_branch and r.requester_key = p_key and r.status = 'pending' and r.id is distinct from p_exclude)
     >= coalesce(v_max, 2) then
    raise exception 'request_limit' using errcode = 'P0409';
  end if;
end;
$$;

-- ─── Création d'une demande ──────────────────────────────────────────────────

drop function public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid, smallint, text);
drop function public.create_appointment_request_core(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid);

/**
 * Demande de rendez-vous d'un patient (serveur de l'application, service role : captcha et limitation par IP en amont).
 * Canal du code : `p_channel` s'il est activé dans la console, sinon le premier canal activé. E-mail : adresse exigée,
 * téléphone facultatif (pour l'accueil) ; WhatsApp ou SMS : numéro exigé. Nom exigé si l'agence le demande.
 * Erreurs : `requests_disabled`, `channel_unavailable`, `email_invalid`, `phone_invalid`, `name_required`, `slot_unavailable`,
 * `request_duplicate`, `request_limit`, `rate_limited`.
 */
create function public.create_appointment_request(
  p_branch uuid,
  p_service uuid,
  p_practitioner uuid,
  p_starts_at timestamptz,
  p_day date,
  p_period text,
  p_phone_e164 text,
  p_label text,
  p_locale text,
  p_customer uuid,
  p_customer_age smallint default null,
  p_customer_file_number text default null,
  p_email text default null,
  p_channel text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bs public.branch_settings;
  v_s public.services;
  v_tz text;
  v_today date;
  v_id uuid;
  v_token text;
  v_channel text;
  v_email text;
  v_phone text := nullif(trim(p_phone_e164), '');
  v_key text;
  v_slot text;
  v_locale text := case when p_locale = 'en' then 'en' else 'fr' end;
  v_name text;
  v_age smallint;
  v_file text;
begin
  if p_customer is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_bs := public.assert_requests_open(p_branch);
  select coalesce(p_channel, request_channels[1]) into v_channel from public.platform_settings;
  if not exists (select 1 from public.platform_settings where v_channel = any (request_channels)) then
    raise exception 'channel_unavailable' using errcode = 'P0422';
  end if;
  if v_channel = 'email' then
    v_email := nullif(lower(trim(p_email)), '');
    if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'email_invalid' using errcode = 'P0422';
    end if;
  elsif v_phone is null then
    raise exception 'phone_invalid' using errcode = 'P0422';
  end if;
  if v_phone is not null and v_phone !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  v_key := coalesce(v_email, v_phone);
  -- Limites par appareil (session anonyme), par adresse et par numéro ; l'adresse IP est limitée par le serveur.
  if not public.check_rate_limit('appointment_request:uid:' || p_customer, 5, interval '1 day')
     or (v_email is not null and not public.check_rate_limit('appointment_request:email:' || public.sha256_hex(v_email), 5, interval '1 day'))
     or (v_phone is not null and not public.check_rate_limit('appointment_request:phone:' || public.sha256_hex(v_phone), 5, interval '1 day')) then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  perform public.assert_customer_name(p_branch, p_label);
  select i.name, i.age, i.file_number into v_name, v_age, v_file
  from public.normalize_customer_identity(p_branch, p_label, p_customer_age, p_customer_file_number) i;
  select * into v_s from public.services where id = p_service and branch_id = p_branch and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if p_practitioner is not null and not exists (
    select 1 from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
    where ps.practitioner_id = p_practitioner and ps.service_id = p_service
  ) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  select timezone into v_tz from public.branches where id = p_branch;
  v_today := (now() at time zone v_tz)::date;
  if p_starts_at is not null then
    if not exists (
      select 1 from public.practitioners p
      cross join lateral public.practitioner_free_slots(p.id, (p_starts_at at time zone v_tz)::date, 1) f
      where p.branch_id = p_branch and p.active and (p_practitioner is null or p.id = p_practitioner)
        and f.service_id = p_service and f.starts_at = p_starts_at
    ) or (p_starts_at at time zone v_tz)::date > v_today + v_bs.appointment_request_days then
      raise exception 'slot_unavailable' using errcode = 'P0409';
    end if;
  elsif p_day is null or p_day < v_today or p_day > v_today + v_bs.appointment_request_days
        or coalesce(p_period, '') not in ('morning', 'afternoon', 'any') then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  v_slot := public.request_slot_key(p_starts_at, case when p_starts_at is null then p_day end, case when p_starts_at is null then p_period end);
  perform public.assert_request_allowed(p_branch, v_key, v_slot, null);
  -- Une demande non vérifiée du même demandeur pour le même créneau est remplacée (nouvel envoi du formulaire).
  update public.appointment_requests set status = 'cancelled', code_hash = null
  where branch_id = p_branch and requester_key = v_key and status = 'unverified'
    and public.request_slot_key(preferred_starts_at, preferred_day, preferred_period) = v_slot;

  v_token := public.random_string(22, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
  insert into public.appointment_requests (organization_id, branch_id, service_id, practitioner_id, preferred_starts_at,
    preferred_day, preferred_period, customer_label, customer_age, customer_file_number, phone_e164, email, verify_channel,
    locale, public_token, customer_user_id)
  values (v_s.organization_id, p_branch, p_service, p_practitioner, p_starts_at,
    case when p_starts_at is null then p_day end, case when p_starts_at is null then p_period end,
    v_name, v_age, v_file, v_phone, v_email, v_channel, v_locale, v_token, p_customer)
  returning id into v_id;
  -- Contact du code puis des réponses : l'adresse e-mail, ou le numéro (WhatsApp, SMS). Le numéro d'une demande
  -- par e-mail ne sert qu'à l'accueil.
  insert into public.notification_contacts (organization_id, branch_id, appointment_request_id, channel, phone_e164, email,
    locale, consent_source, consent_at)
  values (v_s.organization_id, p_branch, v_id, v_channel, case when v_channel = 'email' then null else v_phone end,
    v_email, v_locale, 'patient_request', now());
  perform public.issue_request_code(v_id);
  return jsonb_build_object('id', v_id, 'public_token', v_token, 'channel', v_channel);
end;
$$;

/** Nouveau code à 6 chiffres (10 minutes), envoyé sur le canal de la demande : e-mail, WhatsApp (SMS en secours) ou SMS. */
create or replace function public.issue_request_code(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
  v_code text;
begin
  select * into v_r from public.appointment_requests where id = p_request for update;
  if v_r.status <> 'unverified' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  if v_r.codes_sent >= 3 then raise exception 'rate_limited' using errcode = 'P0429'; end if;
  v_code := public.random_string(6, '0123456789');
  update public.appointment_requests
  set code_hash = public.sha256_hex(v_code || ':' || v_r.id), code_expires_at = now() + interval '10 minutes',
      code_attempts = 0, codes_sent = codes_sent + 1
  where id = v_r.id;
  -- Le code n'est gardé en clair que pendant sa validité (envoi, SMS de secours) : le texte enregistré est masqué
  -- et le code est effacé dès la vérification, l'annulation ou l'expiration (`clear_request_codes`).
  perform public.clear_request_codes(v_r.id);
  update public.notification_jobs set status = 'cancelled', error = 'code_replaced'
  where appointment_request_id = v_r.id and event = 'request_code' and status = 'pending';
  insert into public.notification_jobs (organization_id, branch_id, appointment_request_id, contact_id, event, channel, dedupe_key, payload)
  select c.organization_id, c.branch_id, v_r.id, c.id, 'request_code', c.channel::public.notif_channel,
         'request_code:' || v_r.id || ':' || (v_r.codes_sent + 1), jsonb_build_object('code', v_code)
  from public.notification_contacts c
  where c.appointment_request_id = v_r.id and c.appointment_id is null and c.ticket_id is null
    and c.channel in ('email', 'whatsapp', 'sms');
  perform public.kick_notification_dispatch();
end;
$$;

/** Vérification du code (e-mail, WhatsApp ou SMS) : 5 essais, 10 minutes ; la demande passe « en attente ». */
create or replace function public.verify_appointment_request(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
begin
  v_r := public.lock_request_by_token(p_token);
  if v_r.status <> 'unverified' then return public.request_view(v_r.id); end if;
  if v_r.code_hash is null or v_r.code_expires_at < now() or v_r.code_attempts >= 5 then
    raise exception 'code_expired' using errcode = 'P0409';
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$' or public.sha256_hex(p_code || ':' || v_r.id) <> v_r.code_hash then
    update public.appointment_requests set code_attempts = code_attempts + 1 where id = v_r.id;
    -- L'essai raté est compté même si l'erreur annule la transaction de l'appelant : on ne lève pas d'exception ici.
    return jsonb_build_object('error', 'code_invalid', 'attempts_left', greatest(0, 4 - v_r.code_attempts));
  end if;
  perform public.assert_request_allowed(v_r.branch_id, v_r.requester_key,
    public.request_slot_key(v_r.preferred_starts_at, v_r.preferred_day, v_r.preferred_period), v_r.id);
  begin
    update public.appointment_requests set status = 'pending', verified_at = now(), code_hash = null where id = v_r.id;
  exception when unique_violation then
    -- Deux vérifications simultanées pour le même créneau : l'index unique tranche.
    raise exception 'request_duplicate' using errcode = 'P0409';
  end;
  perform public.clear_request_codes(v_r.id);
  perform public.broadcast('staff:branch:' || v_r.branch_id, 'requests', jsonb_build_object('id', v_r.id, 'status', 'pending'), true);
  return public.request_view(v_r.id);
end;
$$;

/** Formulaire de demande (public) : services, praticiens, créneaux libres et canaux proposés. */
create or replace function public.request_options(p_branch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bs public.branch_settings;
  v_tz text;
  v_today date;
begin
  v_bs := public.assert_requests_open(p_branch);
  select timezone into v_tz from public.branches where id = p_branch;
  v_today := (now() at time zone v_tz)::date;
  return jsonb_build_object(
    'branch', public.branch_summary(p_branch, null) - 'services',
    'timezone', v_tz,
    'days', v_bs.appointment_request_days,
    -- Canaux du code et des réponses, dans l'ordre de préférence (console Wintek).
    'channels', (select to_jsonb(request_channels) from public.platform_settings),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color,
        'practitioners', (
          select jsonb_agg(distinct jsonb_build_object('id', p.id, 'name', public.practitioner_label(p.id)))
          from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
          where ps.service_id = s.id
        )
      ) order by s.sort_order, s.prefix)
      from public.services s
      where s.branch_id = p_branch and s.active
        and exists (select 1 from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
                    where ps.service_id = s.id)
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', f.starts_at, 'practitioner_id', p.id, 'service_id', f.service_id)
        order by f.starts_at, p.id)
      from public.practitioners p
      cross join lateral public.practitioner_free_slots(p.id, v_today, v_bs.appointment_request_days) f
      where p.branch_id = p_branch and p.active
    ), '[]'::jsonb)
  );
end;
$$;

/** Vue publique d'une demande (`/r/<jeton>`) : numéro et adresse masqués, aucune autre donnée personnelle. */
create or replace function public.request_view(p_request uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color),
    'practitioner', case when r.practitioner_id is not null then public.practitioner_label(r.practitioner_id) end,
    'preferred_starts_at', r.preferred_starts_at,
    'preferred_day', r.preferred_day,
    'preferred_period', r.preferred_period,
    'phone_masked', public.mask_phone(r.phone_e164),
    'email_masked', public.mask_email(r.email),
    'verify_channel', r.verify_channel,
    'locale', r.locale,
    'code_expires_at', case when r.status = 'unverified' then r.code_expires_at end,
    'decline_reason', r.decline_reason,
    'created_at', r.created_at,
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address, 'city', b.city, 'timezone', b.timezone,
      'latitude', b.latitude, 'longitude', b.longitude, 'phone_e164', b.phone_e164),
    'organization', jsonb_build_object('name', o.name),
    'appointment', case when a.id is not null then jsonb_build_object(
      'starts_at', a.starts_at, 'status', a.status, 'practitioner', public.practitioner_label(a.practitioner_id)) end
  )
  from public.appointment_requests r
  join public.services s on s.id = r.service_id
  join public.branches b on b.id = r.branch_id
  join public.organizations o on o.id = r.organization_id
  left join public.appointments a on a.id = r.appointment_id
  where r.id = p_request;
$$;

/** Vue d'une demande pour l'accueil : numéro et adresse en clair (le personnel peut recontacter le patient). */
create or replace function public.request_staff_json(p_request uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.request_view(r.id) || jsonb_build_object(
    'phone_e164', r.phone_e164,
    'email', r.email,
    'customer_label', r.customer_label,
    'customer_age', r.customer_age,
    'customer_file_number', r.customer_file_number,
    'practitioner_id', r.practitioner_id,
    'appointment_id', r.appointment_id,
    'handled_at', r.handled_at,
    'verified_at', r.verified_at
  )
  from public.appointment_requests r where r.id = p_request;
$$;

/** Vue d'un rendez-vous pour le personnel, avec l'adresse e-mail d'une demande en ligne. */
create or replace function public.appointment_json(p_appointment uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'status', a.status,
    'display_status', case
      when a.status = 'checked_in' and t.status = 'waiting' and (public.practitioner_absence_now(a.practitioner_id)).id is not null then 'waiting'
      else a.status::text end,
    'customer_label', a.customer_label,
    'customer_age', a.customer_age,
    'customer_file_number', a.customer_file_number,
    'phone_e164', a.phone_e164,
    'email', a.email,
    'locale', a.locale,
    'practitioner', jsonb_build_object('id', p.id, 'name', public.practitioner_label(p.id)),
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color),
    'ticket', case when t.id is not null then jsonb_build_object('id', t.id, 'display_code', t.display_code, 'status', t.status) end,
    'rescheduled_from_id', a.rescheduled_from_id,
    'checked_in_at', a.checked_in_at,
    'cancel_reason', a.cancel_reason,
    -- Congé, fermeture ou absence tombant sur un rendez-vous encore à venir : à reprogrammer.
    'conflict', a.status = 'confirmed' and (
      exists (select 1 from public.practitioner_leaves l where l.practitioner_id = a.practitioner_id
              and (a.starts_at at time zone b.timezone)::date between l.starts_on and l.ends_on)
      or exists (select 1 from public.branch_closures c where c.branch_id = a.branch_id and c.date = (a.starts_at at time zone b.timezone)::date)
      or ((public.practitioner_absence_now(a.practitioner_id)).kind = 'absent'
          and (a.starts_at at time zone b.timezone)::date = (now() at time zone b.timezone)::date)
    )
  )
  from public.appointments a
  join public.practitioners p on p.id = a.practitioner_id
  join public.services s on s.id = a.service_id
  join public.branches b on b.id = a.branch_id
  left join public.tickets t on t.id = a.ticket_id
  where a.id = p_appointment;
$$;

/** Données d'un rendez-vous pour un message : aucun nom de patient ; jeton de la demande d'origine s'il y en a une. */
create or replace function public.appointment_notification_view(p_appointment uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'starts_at', a.starts_at,
    'timezone', b.timezone,
    'practitioner', public.practitioner_label(a.practitioner_id),
    'service', s.name,
    'branch', b.name,
    'organization', o.name,
    -- Rendez-vous issu d'une demande en ligne : lien vers la page de la demande dans les messages.
    'request_token', (select r.public_token from public.appointment_requests r where r.appointment_id = a.id limit 1)
  )
  from public.appointments a
  join public.branches b on b.id = a.branch_id
  join public.organizations o on o.id = a.organization_id
  join public.services s on s.id = a.service_id
  where a.id = p_appointment;
$$;

/**
 * Confirmation d'une demande (partie commune) : rendez-vous créé avec l'adresse e-mail et le numéro de la demande ;
 * ses contacts suivent le rendez-vous (réponse puis rappels sur le même canal).
 */
create or replace function public.accept_appointment_request_core(p_request uuid, p_practitioner uuid, p_starts_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
  v_p public.practitioners;
  v_tz text;
  v_slot record;
  v_local timestamp;
  v_as_asked boolean;
  v_id uuid;
begin
  v_r := public.lock_pending_request(p_request);
  select * into v_p from public.practitioners where id = p_practitioner and branch_id = v_r.branch_id and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select timezone into v_tz from public.branches where id = v_r.branch_id;
  select * into v_slot from public.practitioner_free_slots(p_practitioner, (p_starts_at at time zone v_tz)::date, 1) s
  where s.starts_at = p_starts_at;
  if not found then raise exception 'slot_unavailable' using errcode = 'P0409'; end if;
  v_local := p_starts_at at time zone v_tz;
  v_as_asked := (v_r.practitioner_id is null or v_r.practitioner_id = p_practitioner)
    and v_slot.service_id = v_r.service_id
    and case
      when v_r.preferred_starts_at is not null then v_r.preferred_starts_at = p_starts_at
      else v_local::date = v_r.preferred_day and case v_r.preferred_period
        when 'morning' then v_local::time < time '12:00'
        when 'afternoon' then v_local::time >= time '12:00'
        else true end
    end;

  begin
    insert into public.appointments (organization_id, branch_id, practitioner_id, service_id, starts_at, ends_at,
      customer_label, phone_e164, email, locale, booked_by)
    values (v_r.organization_id, v_r.branch_id, p_practitioner, v_slot.service_id, v_slot.starts_at, v_slot.ends_at,
      v_r.customer_label, v_r.phone_e164, v_r.email, v_r.locale, (select auth.uid()))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0409';
  end;
  -- Les contacts de la demande (e-mail, WhatsApp, SMS, notifications du navigateur) suivent le rendez-vous : réponse et rappels.
  insert into public.notification_contacts (organization_id, branch_id, appointment_id, appointment_request_id, channel,
    phone_e164, email, push_subscription, locale, consent_source, consent_at, consent_by)
  select c.organization_id, c.branch_id, v_id, v_r.id, c.channel, c.phone_e164, c.email, c.push_subscription, c.locale,
    'patient_request', now(), (select auth.uid())
  from public.notification_contacts c
  where c.appointment_request_id = v_r.id and c.appointment_id is null and c.ticket_id is null and c.opted_out_at is null;
  update public.appointment_requests
  set status = case when v_as_asked then 'accepted' else 'modified' end::public.appointment_request_status,
      appointment_id = v_id, handled_by = (select auth.uid()), handled_at = now()
  where id = v_r.id;
  perform public.schedule_appointment_notifications(v_id,
    case when v_as_asked then 'request_accepted' else 'request_modified' end::public.notif_event);
  perform public.audit(v_r.organization_id, 'appointment_request.accept', 'appointment_request', v_r.id,
    jsonb_build_object('appointment_id', v_id, 'as_asked', v_as_asked));
  perform public.broadcast('staff:branch:' || v_r.branch_id, 'requests', jsonb_build_object('id', v_r.id, 'status', 'handled'), true);
  return jsonb_build_object('request', public.request_staff_json(v_r.id), 'appointment', public.appointment_json(v_id));
end;
$$;

/** Refus d'une demande, avec un motif court envoyé au patient sur chacun de ses canaux. */
create or replace function public.decline_appointment_request(p_request uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
begin
  v_r := public.lock_pending_request(p_request);
  if char_length(coalesce(p_reason, '')) > 200 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.appointment_requests
  set status = 'declined', decline_reason = nullif(trim(p_reason), ''), handled_by = (select auth.uid()), handled_at = now()
  where id = v_r.id;
  insert into public.notification_jobs (organization_id, branch_id, appointment_request_id, contact_id, event, channel, dedupe_key)
  select c.organization_id, c.branch_id, v_r.id, c.id, 'request_declined', c.channel::public.notif_channel,
         'request_declined:' || v_r.id || ':' || c.id
  from public.notification_contacts c
  where c.appointment_request_id = v_r.id and c.appointment_id is null and c.ticket_id is null and c.opted_out_at is null
  on conflict (dedupe_key) do nothing;
  perform public.kick_notification_dispatch();
  perform public.audit(v_r.organization_id, 'appointment_request.decline', 'appointment_request', v_r.id, '{}'::jsonb);
  perform public.broadcast('staff:branch:' || v_r.branch_id, 'requests', jsonb_build_object('id', v_r.id, 'status', 'handled'), true);
  return public.request_staff_json(v_r.id);
end;
$$;

/** Déplacement d'un rendez-vous : les contacts e-mail et push d'une demande en ligne suivent le nouveau créneau. */
create or replace function public.reschedule_appointment(p_appointment uuid, p_starts_at timestamptz, p_practitioner uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_new jsonb;
begin
  v_a := public.lock_appointment(p_appointment, array['confirmed']::public.appointment_status[]);
  if p_practitioner is not null and not exists (
    select 1 from public.practitioners where id = p_practitioner and branch_id = v_a.branch_id
  ) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  update public.appointments set status = 'rescheduled' where id = v_a.id;
  perform public.cancel_appointment_reminders(v_a.id);
  v_new := public.book_appointment(coalesce(p_practitioner, v_a.practitioner_id), p_starts_at, v_a.customer_label,
    v_a.phone_e164, v_a.phone_e164 is not null, v_a.locale, v_a.id, v_a.customer_age, v_a.customer_file_number);
  -- Adresse e-mail et notifications du navigateur (demande en ligne) : reprises sur le nouveau rendez-vous, avec la demande.
  update public.appointments set email = v_a.email where id = (v_new ->> 'id')::uuid;
  insert into public.notification_contacts (organization_id, branch_id, appointment_id, appointment_request_id, channel,
    email, push_subscription, locale, consent_source, consent_at, consent_by)
  select c.organization_id, c.branch_id, (v_new ->> 'id')::uuid, c.appointment_request_id, c.channel, c.email, c.push_subscription,
    c.locale, c.consent_source, c.consent_at, c.consent_by
  from public.notification_contacts c
  where c.appointment_id = v_a.id and c.ticket_id is null and c.opted_out_at is null and c.channel in ('email', 'push');
  if found then
    perform public.schedule_appointment_notifications((v_new ->> 'id')::uuid, 'appointment_rescheduled');
  end if;
  -- Numéro donné seulement pour l'accueil (demande par e-mail) : jamais de contact WhatsApp créé par le déplacement.
  if not exists (select 1 from public.notification_contacts c where c.appointment_id = v_a.id and c.ticket_id is null and c.channel = 'whatsapp') then
    update public.notification_jobs j set status = 'cancelled', error = 'no_consent'
    from public.notification_contacts c
    where c.appointment_id = (v_new ->> 'id')::uuid and c.channel = 'whatsapp' and j.contact_id = c.id and j.status = 'pending';
    delete from public.notification_contacts where appointment_id = (v_new ->> 'id')::uuid and channel = 'whatsapp';
  end if;
  update public.appointment_requests set appointment_id = (v_new ->> 'id')::uuid where appointment_id = v_a.id;
  v_new := public.appointment_json((v_new ->> 'id')::uuid);
  perform public.audit(v_a.organization_id, 'appointment.reschedule', 'appointment', v_a.id,
    jsonb_build_object('to', v_new ->> 'id', 'starts_at', p_starts_at));
  return v_new;
end;
$$;

/**
 * Abonnement web push du patient à sa demande (jeton du lien personnel) : réponse de l'accueil et rappels, en plus
 * de l'e-mail. Après confirmation, l'abonnement suit aussi le rendez-vous. 5 abonnements par demande et par heure.
 */
create or replace function public.register_request_push_contact(p_token text, p_subscription jsonb, p_locale text default 'fr')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
  v_appointment uuid;
begin
  v_r := public.lock_request_by_token(p_token);
  if v_r.status not in ('pending', 'accepted', 'modified') then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  if not public.check_rate_limit('push_subscribe:request:' || v_r.id, 5, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  if not (p_subscription ? 'endpoint' and p_subscription -> 'keys' ? 'p256dh' and p_subscription -> 'keys' ? 'auth')
     or (p_subscription ->> 'endpoint') !~ '^https://' then
    raise exception 'invalid_subscription' using errcode = 'P0422';
  end if;
  select a.id into v_appointment from public.appointments a
  where a.id = v_r.appointment_id and a.status = 'confirmed' and v_r.status in ('accepted', 'modified');
  if not exists (
    select 1 from public.notification_contacts c
    where c.appointment_request_id = v_r.id and c.channel = 'push' and c.opted_out_at is null
      and c.appointment_id is not distinct from v_appointment and c.push_subscription ->> 'endpoint' = p_subscription ->> 'endpoint'
  ) then
    insert into public.notification_contacts (organization_id, branch_id, appointment_request_id, appointment_id, channel,
      push_subscription, locale, consent_source, consent_at)
    values (v_r.organization_id, v_r.branch_id, v_r.id, v_appointment, 'push',
      jsonb_build_object('endpoint', p_subscription ->> 'endpoint', 'keys', p_subscription -> 'keys'),
      case when p_locale = 'en' then 'en' else 'fr' end, 'customer_optin', now());
    -- Rendez-vous déjà confirmé : réponse et rappels programmés pour ce nouvel abonnement (une clé par contact).
    if v_appointment is not null then
      perform public.schedule_appointment_notifications(v_appointment,
        case when v_r.status = 'accepted' then 'request_accepted' else 'request_modified' end::public.notif_event);
    end if;
  end if;
  return jsonb_build_object('status', 'subscribed');
end;
$$;

/** Jobs dus (M7), avec l'adresse e-mail du contact pour le canal e-mail. */
create or replace function public.claim_notification_jobs(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with picked as (
    select j.id from public.notification_jobs j
    where (j.status = 'pending' and j.next_attempt_at <= now())
       or (j.status = 'sending' and j.updated_at < now() - interval '2 minutes')
    order by j.next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ),
  claimed as (
    update public.notification_jobs j set status = 'sending', attempt = j.attempt + 1
    from picked where j.id = picked.id
    returning j.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'event', j.event,
    'channel', j.channel,
    'attempt', j.attempt,
    'payload', j.payload,
    'guard', j.guard,
    -- M10a : quota mensuel WhatsApp de la formule atteint (« c'est votre tour » toujours envoyé).
    'quota_exceeded', j.channel = 'whatsapp' and j.event <> 'your_turn' and coalesce(public.whatsapp_quota_exceeded(j.organization_id), false),
    'fallback_status', (select f.status from public.notification_jobs f where f.id = j.fallback_of),
    'contact', case when c.id is not null then jsonb_build_object(
      'id', c.id,
      'phone_e164', c.phone_e164,
      'email', c.email,
      'locale', c.locale,
      'push_subscription', c.push_subscription,
      'window_expires_at', c.window_expires_at,
      'opted_out', c.opted_out_at is not null
        or (c.phone_e164 is not null and exists (
          select 1 from public.whatsapp_opt_outs o where o.phone_hash = public.sha256_hex(c.phone_e164)))
    ) end,
    'token', t.public_token,
    'ticket', case when t.id is not null then public.ticket_view(t.id) end,
    'appointment', case when j.appointment_id is not null and j.ticket_id is null then public.appointment_notification_view(j.appointment_id) end,
    'request', case when j.appointment_request_id is not null and j.appointment_id is null and j.ticket_id is null
                    then public.request_notification_view(j.appointment_request_id) end
  )), '[]'::jsonb) into v_result
  from claimed j
  left join public.tickets t on t.id = j.ticket_id
  left join public.notification_contacts c on c.id = j.contact_id;
  return v_result;
end;
$$;

/** Purge des données personnelles : adresses e-mail des demandes et des rendez-vous comprises. */
create or replace function public.purge_personal_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notification_contacts c
  using public.tickets t, public.organizations o
  where t.id = c.ticket_id and o.id = t.organization_id
    and t.created_at < now() - make_interval(days => o.data_retention_days);
  delete from public.notification_contacts c
  using public.appointments a, public.organizations o
  where c.ticket_id is null and a.id = c.appointment_id and o.id = a.organization_id
    and a.starts_at < now() - make_interval(days => o.data_retention_days);
  delete from public.notification_contacts c
  using public.appointment_requests r, public.organizations o
  where c.ticket_id is null and c.appointment_id is null and r.id = c.appointment_request_id and o.id = r.organization_id
    and r.created_at < now() - make_interval(days => o.data_retention_days);
  delete from public.ticket_identities i
  using public.tickets t, public.organizations o
  where t.id = i.ticket_id and o.id = t.organization_id
    and t.created_at < now() - make_interval(days => o.data_retention_days);
  update public.appointments a set phone_e164 = null, email = null, customer_label = null, customer_age = null, customer_file_number = null
  from public.organizations o
  where o.id = a.organization_id and a.starts_at < now() - make_interval(days => o.data_retention_days)
    and (a.phone_e164 is not null or a.email is not null or a.customer_label is not null or a.customer_age is not null
         or a.customer_file_number is not null);
  update public.appointment_requests r set phone_e164 = null, email = null, customer_label = null, customer_age = null,
    customer_file_number = null, customer_user_id = null, code_hash = null
  from public.organizations o
  where o.id = r.organization_id and r.created_at < now() - make_interval(days => o.data_retention_days)
    and (r.phone_e164 is not null or r.email is not null or r.customer_label is not null or r.customer_age is not null or r.customer_file_number is not null
         or r.customer_user_id is not null);
  update public.notification_jobs j set payload = '{}'::jsonb
  from public.organizations o
  where o.id = j.organization_id and j.payload <> '{}'::jsonb
    and (
      exists (select 1 from public.tickets t where t.id = j.ticket_id and t.created_at < now() - make_interval(days => o.data_retention_days))
      or exists (select 1 from public.appointments a where a.id = j.appointment_id and j.ticket_id is null
                 and a.starts_at < now() - make_interval(days => o.data_retention_days))
      or exists (select 1 from public.appointment_requests r where r.id = j.appointment_request_id
                 and j.ticket_id is null and j.appointment_id is null
                 and r.created_at < now() - make_interval(days => o.data_retention_days))
    );
  delete from public.provider_webhook_events
  where received_at < now() - make_interval(days => (select coalesce(min(data_retention_days), 30) from public.organizations));
  update public.tickets t
  set public_token = null, customer_user_id = null, rating_comment = null
  from public.organizations o
  where o.id = t.organization_id
    and t.created_at < now() - make_interval(days => o.data_retention_days)
    and (t.public_token is not null or t.customer_user_id is not null or t.rating_comment is not null);
  get diagnostics v_count = row_count;
  delete from public.client_ops where created_at < now() - interval '7 days';
  return v_count;
end;
$$;

-- ─── Droits ──────────────────────────────────────────────────────────────────

revoke execute on function
  public.mask_email(text), public.assert_request_allowed(uuid, text, text, uuid),
  public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid, smallint, text, text, text),
  public.register_request_push_contact(text, jsonb, text)
from public, anon, authenticated;
-- Serveur de l'application (captcha et limitation par IP vérifiés avant l'appel).
grant execute on function
  public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid, smallint, text, text, text),
  public.register_request_push_contact(text, jsonb, text)
to service_role;
