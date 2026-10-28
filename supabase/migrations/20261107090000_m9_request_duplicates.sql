-- M9 (correctif) — Demandes de rendez-vous en double.
-- Avant : une seule demande en attente par numéro et par agence, sans distinction de créneau (et rien n'empêchait
-- les demandes non vérifiées de s'accumuler pour le même créneau).
-- Désormais, garanti par la base :
--   • une seule demande en attente par numéro vérifié, par agence et par créneau (index unique) ;
--   • au plus `appointment_request_max_pending` demandes en attente par numéro et par agence (réglage d'agence, 2 par défaut) ;
--   • un nouvel envoi du même créneau avant vérification remplace la demande non vérifiée.
-- Erreurs : `request_duplicate` (même créneau), `request_limit` (trop de demandes en attente).

alter table public.branch_settings
  add column appointment_request_max_pending smallint not null default 2 check (appointment_request_max_pending between 1 and 10);

/** Créneau d'une demande : instant précis, ou jour + moment de la journée (« 2026-10-30:morning »). */
create or replace function public.request_slot_key(p_starts_at timestamptz, p_day date, p_period text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_starts_at is not null then 'at:' || to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI')
              else 'day:' || p_day::text || ':' || coalesce(p_period, 'any') end;
$$;

-- Les anciennes demandes en double (même numéro, même créneau, en attente) : la plus récente est gardée.
update public.appointment_requests r set status = 'cancelled'
where r.status = 'pending' and exists (
  select 1 from public.appointment_requests o
  where o.branch_id = r.branch_id and o.phone_e164 = r.phone_e164 and o.status = 'pending' and o.id <> r.id
    and public.request_slot_key(o.preferred_starts_at, o.preferred_day, o.preferred_period)
      = public.request_slot_key(r.preferred_starts_at, r.preferred_day, r.preferred_period)
    and (o.created_at, o.id) > (r.created_at, r.id)
);

drop index public.appointment_requests_open_uidx;
create unique index appointment_requests_slot_uidx on public.appointment_requests
  (branch_id, phone_e164, public.request_slot_key(preferred_starts_at, preferred_day, preferred_period))
  where status = 'pending';

/**
 * Contrôle avant d'enregistrer (ou de vérifier) une demande : même créneau déjà en attente → `request_duplicate` ;
 * nombre de demandes en attente du numéro dans l'agence au maximum → `request_limit`. Verrou par numéro et agence :
 * deux envois simultanés sont traités l'un après l'autre.
 */
create or replace function public.assert_request_allowed(p_branch uuid, p_phone text, p_slot text, p_exclude uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('appointment_request:' || p_branch || ':' || p_phone, 0));
  if exists (
    select 1 from public.appointment_requests r
    where r.branch_id = p_branch and r.phone_e164 = p_phone and r.status = 'pending' and r.id is distinct from p_exclude
      and public.request_slot_key(r.preferred_starts_at, r.preferred_day, r.preferred_period) = p_slot
  ) then
    raise exception 'request_duplicate' using errcode = 'P0409';
  end if;
  select appointment_request_max_pending into v_max from public.branch_settings where branch_id = p_branch;
  if (select count(*) from public.appointment_requests r
      where r.branch_id = p_branch and r.phone_e164 = p_phone and r.status = 'pending' and r.id is distinct from p_exclude)
     >= coalesce(v_max, 2) then
    raise exception 'request_limit' using errcode = 'P0409';
  end if;
end;
$$;

/**
 * Demande de rendez-vous d'un patient (serveur de l'application, service role : captcha et limitation par IP en amont).
 * Créneau précis libre (praticien choisi ou n'importe lequel du service), ou jour + moment dans les jours ouverts.
 * La demande n'est visible de l'accueil qu'après vérification du numéro par code. Erreurs : `requests_disabled`,
 * `slot_unavailable`, `phone_invalid`, `request_duplicate`, `request_limit`, `rate_limited`.
 */
create or replace function public.create_appointment_request(
  p_branch uuid,
  p_service uuid,
  p_practitioner uuid,
  p_starts_at timestamptz,
  p_day date,
  p_period text,
  p_phone_e164 text,
  p_label text,
  p_locale text,
  p_customer uuid
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
begin
  if p_customer is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_bs := public.assert_requests_open(p_branch);
  if p_phone_e164 is null or p_phone_e164 !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  if not public.check_rate_limit('appointment_request:phone:' || public.sha256_hex(p_phone_e164), 5, interval '1 day')
     or not public.check_rate_limit('appointment_request:uid:' || p_customer, 5, interval '1 day') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
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
  perform public.assert_request_allowed(p_branch, p_phone_e164,
    public.request_slot_key(p_starts_at, case when p_starts_at is null then p_day end, case when p_starts_at is null then p_period end), null);
  -- Une demande non vérifiée du même numéro pour le même créneau est remplacée (nouvel envoi du formulaire).
  update public.appointment_requests set status = 'cancelled', code_hash = null
  where branch_id = p_branch and phone_e164 = p_phone_e164 and status = 'unverified'
    and public.request_slot_key(preferred_starts_at, preferred_day, preferred_period)
      = public.request_slot_key(p_starts_at, case when p_starts_at is null then p_day end, case when p_starts_at is null then p_period end);

  v_token := public.random_string(22, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
  insert into public.appointment_requests (organization_id, branch_id, service_id, practitioner_id, preferred_starts_at,
    preferred_day, preferred_period, customer_label, phone_e164, locale, public_token, customer_user_id)
  values (v_s.organization_id, p_branch, p_service, p_practitioner, p_starts_at,
    case when p_starts_at is null then p_day end, case when p_starts_at is null then p_period end,
    nullif(trim(p_label), ''), p_phone_e164, case when p_locale = 'en' then 'en' else 'fr' end, v_token, p_customer)
  returning id into v_id;
  insert into public.notification_contacts (organization_id, branch_id, appointment_request_id, channel, phone_e164, locale,
    consent_source, consent_at)
  values (v_s.organization_id, p_branch, v_id, 'whatsapp', p_phone_e164, case when p_locale = 'en' then 'en' else 'fr' end,
    'patient_request', now());
  perform public.issue_request_code(v_id);
  return jsonb_build_object('id', v_id, 'public_token', v_token);
end;
$$;

/**
 * Vérification du numéro : 5 essais par code, code valable 10 minutes. La demande passe « en attente » et l'accueil
 * est prévenu en direct. Erreurs : `code_invalid`, `code_expired` (nouveau code nécessaire), `request_duplicate`, `request_limit`.
 */
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
  perform public.assert_request_allowed(v_r.branch_id, v_r.phone_e164,
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

revoke execute on function public.request_slot_key(timestamptz, date, text), public.assert_request_allowed(uuid, text, text, uuid)
from public, anon, authenticated;
