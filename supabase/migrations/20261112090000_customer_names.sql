-- Nom du client sur les tickets et les rendez-vous (étape « nom du client », après la revue responsive).
-- Règles : nom (et âge ou numéro de dossier) visibles du seul personnel de l'agence ; jamais sur l'écran TV, dans
-- l'annonce vocale, les messages WhatsApp / SMS, les diffusions temps réel publiques ni les statistiques ;
-- jamais dans le journal d'audit ; effacés après `organizations.data_retention_days` (`purge_personal_data`).

-- ─── Réglage par agence ──────────────────────────────────────────────────────
alter table public.branch_settings
  add column customer_name_mode text check (customer_name_mode in ('off', 'optional', 'required')),
  add column customer_name_extra text not null default 'none' check (customer_name_extra in ('none', 'age', 'file_number'));
update public.branch_settings bs
set customer_name_mode = case when o.type in ('clinic', 'hospital') then 'required' else 'off' end
from public.organizations o where o.id = bs.organization_id;
alter table public.branch_settings alter column customer_name_mode set not null;

/** Valeur par défaut selon le secteur : obligatoire pour les cliniques et hôpitaux, non demandé ailleurs. */
create function public.branch_settings_name_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_name_mode is null then
    select case when o.type in ('clinic', 'hospital') then 'required' else 'off' end into new.customer_name_mode
    from public.organizations o where o.id = new.organization_id;
    new.customer_name_mode := coalesce(new.customer_name_mode, 'off');
  end if;
  return new;
end;
$$;
create trigger branch_settings_name_default before insert on public.branch_settings
  for each row execute function public.branch_settings_name_default();

/** Règles d'identité d'une agence (pages client et accueil) : mode du nom et champ supplémentaire. */
create function public.customer_identity_rules(p_branch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('mode', bs.customer_name_mode, 'extra', bs.customer_name_extra)
  from public.branch_settings bs where bs.branch_id = p_branch;
$$;

/**
 * Identité saisie, nettoyée selon les règles de l'agence : rien si le nom n'est pas demandé ; le champ supplémentaire
 * seulement s'il est demandé. Valeurs invalides refusées (`identity_invalid`).
 */
create function public.normalize_customer_identity(p_branch uuid, p_name text, p_age smallint, p_file_number text,
  out name text, out age smallint, out file_number text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bs public.branch_settings;
begin
  select * into v_bs from public.branch_settings where branch_id = p_branch;
  if not found or v_bs.customer_name_mode = 'off' then return; end if;
  name := nullif(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  if name is not null and char_length(name) > 80 then raise exception 'identity_invalid' using errcode = 'P0422'; end if;
  if v_bs.customer_name_extra = 'age' and p_age is not null then
    if p_age < 0 or p_age > 130 then raise exception 'identity_invalid' using errcode = 'P0422'; end if;
    age := p_age;
  end if;
  if v_bs.customer_name_extra = 'file_number' then
    file_number := nullif(trim(coalesce(p_file_number, '')), '');
    if file_number is not null and char_length(file_number) > 40 then raise exception 'identity_invalid' using errcode = 'P0422'; end if;
  end if;
end;
$$;

/** Nom exigé par l'agence et absent : `name_required` (demandes des clients). */
create function public.assert_customer_name(p_branch uuid, p_name text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.branch_settings where branch_id = p_branch and customer_name_mode = 'required')
     and nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'name_required' using errcode = 'P0422';
  end if;
end;
$$;

-- ─── Identité des tickets : table à part, lisible du seul personnel de l'agence ──
create table public.ticket_identities (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  organization_id uuid not null,
  branch_id uuid not null,
  full_name text check (char_length(full_name) between 1 and 80),
  age smallint check (age between 0 and 130),
  file_number text check (char_length(file_number) between 1 and 40),
  updated_at timestamptz not null default now(),
  check (full_name is not null or age is not null or file_number is not null),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);
create index ticket_identities_branch_idx on public.ticket_identities (branch_id);
alter table public.ticket_identities enable row level security;
-- Personnel de l'agence uniquement (ni les clients, ni la console Wintek).
create policy ticket_identities_select on public.ticket_identities for select to authenticated
  using (not public.is_anonymous() and public.can_access_branch(organization_id, branch_id));
revoke all on public.ticket_identities from anon, authenticated;
grant select on public.ticket_identities to authenticated;

/** Enregistre (ou efface) l'identité d'un ticket ; prévient les postes sans jamais diffuser le nom. */
create function public.save_ticket_identity(p_ticket uuid, p_name text, p_age smallint, p_file_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets;
  v_name text;
  v_age smallint;
  v_file text;
begin
  select * into v_t from public.tickets where id = p_ticket;
  if not found then return; end if;
  select i.name, i.age, i.file_number into v_name, v_age, v_file
  from public.normalize_customer_identity(v_t.branch_id, p_name, p_age, p_file_number) i;
  if v_name is null and v_age is null and v_file is null then
    delete from public.ticket_identities where ticket_id = p_ticket;
    if not found then return; end if;
  else
    insert into public.ticket_identities (ticket_id, organization_id, branch_id, full_name, age, file_number)
    values (p_ticket, v_t.organization_id, v_t.branch_id, v_name, v_age, v_file)
    on conflict (ticket_id) do update
      set full_name = excluded.full_name, age = excluded.age, file_number = excluded.file_number, updated_at = now();
  end if;
  perform public.broadcast('staff:branch:' || v_t.branch_id, 'identity', jsonb_build_object('ticket_id', p_ticket), true);
end;
$$;

/** Accueil ou poste : saisir ou corriger le nom d'un ticket actif (journalisé, sans le nom). */
create function public.set_ticket_identity(p_ticket uuid, p_name text, p_age smallint default null, p_file_number text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets;
begin
  select * into v_t from public.tickets where id = p_ticket;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if public.is_anonymous() or not public.can_access_branch(v_t.organization_id, v_t.branch_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_t.status not in ('waiting', 'called', 'serving') then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  perform public.save_ticket_identity(p_ticket, p_name, p_age, p_file_number);
  perform public.audit(v_t.organization_id, 'ticket.identity', 'ticket', v_t.id, '{}'::jsonb);
  return jsonb_build_object('ticket_id', p_ticket);
end;
$$;

/** Réorientation : l'identité suit le nouveau ticket. */
create function public.tickets_copy_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.transferred_from_id is not null then
    insert into public.ticket_identities (ticket_id, organization_id, branch_id, full_name, age, file_number)
    select new.id, new.organization_id, new.branch_id, i.full_name, i.age, i.file_number
    from public.ticket_identities i where i.ticket_id = new.transferred_from_id
    on conflict (ticket_id) do nothing;
  end if;
  return null;
end;
$$;
create trigger tickets_copy_identity after insert on public.tickets
  for each row execute function public.tickets_copy_identity();

-- ─── Prise de ticket (client, accueil) ───────────────────────────────────────
drop function public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid);
drop function public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid);

/** Prise de ticket sur place (serveur de l'application) : priorité refusée, nom exigé si l'agence le demande. */
create function public.take_ticket(
  p_service uuid,
  p_source public.ticket_source,
  p_entry_code text,
  p_priority_reason public.priority_reason,
  p_customer uuid,
  p_customer_name text default null,
  p_customer_age smallint default null,
  p_customer_file_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_result jsonb;
begin
  if p_priority_reason is not null then raise exception 'priority_staff_only' using errcode = 'P0422'; end if;
  -- Contrôles du ticket d'abord (agence fermée, lecture seule…), puis le nom : un refus annule tout.
  v_result := public.take_ticket_core(p_service, p_source, p_entry_code, null, p_customer);
  select branch_id into v_branch from public.services where id = p_service;
  perform public.assert_customer_name(v_branch, p_customer_name);
  perform public.save_ticket_identity((v_result ->> 'ticket_id')::uuid, p_customer_name, p_customer_age, p_customer_file_number);
  return v_result;
end;
$$;

/** Ticket à distance (serveur de l'application) : mêmes règles. */
create function public.take_remote_ticket(
  p_service uuid,
  p_lat double precision,
  p_lng double precision,
  p_priority_reason public.priority_reason,
  p_customer uuid,
  p_customer_name text default null,
  p_customer_age smallint default null,
  p_customer_file_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_result jsonb;
begin
  if p_priority_reason is not null then raise exception 'priority_staff_only' using errcode = 'P0422'; end if;
  -- Contrôles du ticket d'abord (agence fermée, lecture seule…), puis le nom : un refus annule tout.
  v_result := public.take_remote_ticket_core(p_service, p_lat, p_lng, null, p_customer);
  select branch_id into v_branch from public.services where id = p_service;
  perform public.assert_customer_name(v_branch, p_customer_name);
  perform public.save_ticket_identity((v_result ->> 'ticket_id')::uuid, p_customer_name, p_customer_age, p_customer_file_number);
  return v_result;
end;
$$;

alter function public.reception_create_ticket(uuid, public.priority_reason, uuid, uuid, text, boolean, text) rename to reception_create_ticket_core;

/**
 * Ticket créé par l'accueil, avec le nom du patient (sans téléphone, ticket imprimé). Le formulaire de l'accueil
 * exige le nom quand l'agence le demande ; la base l'accepte vide pour ne jamais bloquer l'accueil (« Saisir le nom »
 * reste possible ensuite).
 */
create function public.reception_create_ticket(
  p_service uuid,
  p_priority_reason public.priority_reason default null,
  p_client_op_id uuid default null,
  p_practitioner uuid default null,
  p_phone_e164 text default null,
  p_consent boolean default false,
  p_locale text default 'fr',
  p_customer_name text default null,
  p_customer_age smallint default null,
  p_customer_file_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.reception_create_ticket_core(p_service, p_priority_reason, p_client_op_id, p_practitioner, p_phone_e164, p_consent, p_locale);
  if p_customer_name is not null or p_customer_age is not null or p_customer_file_number is not null then
    perform public.save_ticket_identity((v_result ->> 'id')::uuid, p_customer_name, p_customer_age, p_customer_file_number);
  end if;
  return v_result;
end;
$$;

-- ─── Rendez-vous et demandes : le nom remplace le repère (initiales) ─────────
alter table public.appointments drop constraint if exists appointments_customer_label_check;
alter table public.appointments
  add constraint appointments_customer_label_check check (char_length(customer_label) between 1 and 80),
  add column customer_age smallint check (customer_age between 0 and 130),
  add column customer_file_number text check (char_length(customer_file_number) between 1 and 40);
alter table public.appointment_requests drop constraint if exists appointment_requests_customer_label_check;
alter table public.appointment_requests
  add constraint appointment_requests_customer_label_check check (char_length(customer_label) between 1 and 80),
  add column customer_age smallint check (customer_age between 0 and 130),
  add column customer_file_number text check (char_length(customer_file_number) between 1 and 40);

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

create or replace function public.request_staff_json(p_request uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.request_view(r.id) || jsonb_build_object(
    'phone_e164', r.phone_e164,
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

drop function public.book_appointment(uuid, timestamptz, text, text, boolean, text, uuid);

/**
 * Prise de rendez-vous par l'accueil (nom, et âge ou numéro de dossier selon l'agence). Erreurs : `slot_unavailable`,
 * `consent_required`, `phone_invalid`, `identity_invalid`.
 */
create function public.book_appointment(
  p_practitioner uuid,
  p_starts_at timestamptz,
  p_customer_label text default null,
  p_phone_e164 text default null,
  p_consent boolean default false,
  p_locale text default 'fr',
  p_rescheduled_from uuid default null,
  p_customer_age smallint default null,
  p_customer_file_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.practitioners;
  v_tz text;
  v_slot record;
  v_id uuid;
  v_id_name text;
  v_id_age smallint;
  v_id_file text;
begin
  select * into v_p from public.practitioners where id = p_practitioner and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_p.branch_id);
  if p_phone_e164 is not null then
    if p_phone_e164 !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
    if not coalesce(p_consent, false) then raise exception 'consent_required' using errcode = 'P0422'; end if;
  end if;
  select i.name, i.age, i.file_number into v_id_name, v_id_age, v_id_file
  from public.normalize_customer_identity(v_p.branch_id, p_customer_label, p_customer_age, p_customer_file_number) i;
  select timezone into v_tz from public.branches where id = v_p.branch_id;
  select * into v_slot from public.practitioner_free_slots(p_practitioner, (p_starts_at at time zone v_tz)::date, 1) s
  where s.starts_at = p_starts_at;
  if not found then raise exception 'slot_unavailable' using errcode = 'P0409'; end if;

  begin
    insert into public.appointments (organization_id, branch_id, practitioner_id, service_id, starts_at, ends_at,
      customer_label, customer_age, customer_file_number, phone_e164, locale, rescheduled_from_id, booked_by)
    values (v_p.organization_id, v_p.branch_id, p_practitioner, v_slot.service_id, v_slot.starts_at, v_slot.ends_at,
      v_id_name, v_id_age, v_id_file, p_phone_e164, case when p_locale = 'en' then 'en' else 'fr' end,
      p_rescheduled_from, (select auth.uid()))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0409';
  end;
  if p_phone_e164 is not null then
    insert into public.notification_contacts (organization_id, branch_id, appointment_id, channel, phone_e164, locale,
      consent_source, consent_at, consent_by)
    values (v_p.organization_id, v_p.branch_id, v_id, 'whatsapp', p_phone_e164, case when p_locale = 'en' then 'en' else 'fr' end,
      'reception_with_consent', now(), (select auth.uid()));
  end if;
  perform public.schedule_appointment_notifications(v_id,
    case when p_rescheduled_from is null then 'appointment_confirmed' else 'appointment_rescheduled' end::public.notif_event);
  perform public.audit(v_p.organization_id, 'appointment.book', 'appointment', v_id,
    jsonb_build_object('practitioner_id', p_practitioner, 'starts_at', v_slot.starts_at, 'rescheduled_from', p_rescheduled_from));
  return public.appointment_json(v_id);
end;
$$;

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
  perform public.audit(v_a.organization_id, 'appointment.reschedule', 'appointment', v_a.id,
    jsonb_build_object('to', v_new ->> 'id', 'starts_at', p_starts_at));
  return v_new;
end;
$$;

alter function public.check_in_appointment(uuid) rename to check_in_appointment_core;

/** Arrivée d'un rendez-vous : le nom (et l'âge ou le numéro de dossier) est recopié sur le ticket. */
create function public.check_in_appointment(p_appointment uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_a public.appointments;
begin
  v_result := public.check_in_appointment_core(p_appointment);
  select * into v_a from public.appointments where id = p_appointment;
  if v_a.customer_label is not null or v_a.customer_age is not null or v_a.customer_file_number is not null then
    perform public.save_ticket_identity((v_result -> 'ticket' ->> 'id')::uuid, v_a.customer_label, v_a.customer_age, v_a.customer_file_number);
  end if;
  return v_result;
end;
$$;

alter function public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid)
  rename to create_appointment_request_core;

/** Demande de rendez-vous du patient (serveur) : nom exigé si l'agence le demande, âge ou numéro de dossier. */
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
  p_customer_file_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_name text;
  v_age smallint;
  v_file text;
begin
  perform public.assert_customer_name(p_branch, p_label);
  select i.name, i.age, i.file_number into v_name, v_age, v_file
  from public.normalize_customer_identity(p_branch, p_label, p_customer_age, p_customer_file_number) i;
  v_result := public.create_appointment_request_core(p_branch, p_service, p_practitioner, p_starts_at, p_day, p_period,
    p_phone_e164, v_name, p_locale, p_customer);
  update public.appointment_requests set customer_age = v_age, customer_file_number = v_file
  where id = (v_result ->> 'id')::uuid;
  return v_result;
end;
$$;

alter function public.accept_appointment_request(uuid, uuid, timestamptz) rename to accept_appointment_request_core;

/** Acceptation d'une demande : l'âge ou le numéro de dossier suivent le rendez-vous créé. */
create function public.accept_appointment_request(p_request uuid, p_practitioner uuid, p_starts_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_r public.appointment_requests;
  v_appointment uuid;
begin
  v_result := public.accept_appointment_request_core(p_request, p_practitioner, p_starts_at);
  select * into v_r from public.appointment_requests where id = p_request;
  v_appointment := (v_result -> 'appointment' ->> 'id')::uuid;
  update public.appointments set customer_age = v_r.customer_age, customer_file_number = v_r.customer_file_number
  where id = v_appointment;
  return jsonb_set(v_result, '{appointment}', public.appointment_json(v_appointment));
end;
$$;

-- ─── Purge des données personnelles ──────────────────────────────────────────
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
  update public.appointments a set phone_e164 = null, customer_label = null, customer_age = null, customer_file_number = null
  from public.organizations o
  where o.id = a.organization_id and a.starts_at < now() - make_interval(days => o.data_retention_days)
    and (a.phone_e164 is not null or a.customer_label is not null or a.customer_age is not null or a.customer_file_number is not null);
  update public.appointment_requests r set phone_e164 = null, customer_label = null, customer_age = null, customer_file_number = null,
    customer_user_id = null, code_hash = null
  from public.organizations o
  where o.id = r.organization_id and r.created_at < now() - make_interval(days => o.data_retention_days)
    and (r.phone_e164 is not null or r.customer_label is not null or r.customer_age is not null or r.customer_file_number is not null
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
  public.branch_settings_name_default(), public.normalize_customer_identity(uuid, text, smallint, text),
  public.assert_customer_name(uuid, text), public.save_ticket_identity(uuid, text, smallint, text), public.tickets_copy_identity(),
  public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid, text, smallint, text),
  public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid, text, smallint, text),
  public.reception_create_ticket_core(uuid, public.priority_reason, uuid, uuid, text, boolean, text),
  public.check_in_appointment_core(uuid),
  public.create_appointment_request_core(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid),
  public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid, smallint, text),
  public.accept_appointment_request_core(uuid, uuid, timestamptz),
  public.reception_create_ticket(uuid, public.priority_reason, uuid, uuid, text, boolean, text, text, smallint, text),
  public.set_ticket_identity(uuid, text, smallint, text), public.check_in_appointment(uuid),
  public.accept_appointment_request(uuid, uuid, timestamptz),
  public.book_appointment(uuid, timestamptz, text, text, boolean, text, uuid, smallint, text),
  public.customer_identity_rules(uuid)
from public, anon, authenticated;
-- Pages client (sans compte) : seulement les règles de l'agence (aucune donnée personnelle).
grant execute on function public.customer_identity_rules(uuid) to anon, authenticated;
-- Personnel (droits vérifiés dans chaque fonction).
grant execute on function
  public.reception_create_ticket(uuid, public.priority_reason, uuid, uuid, text, boolean, text, text, smallint, text),
  public.set_ticket_identity(uuid, text, smallint, text), public.check_in_appointment(uuid),
  public.accept_appointment_request(uuid, uuid, timestamptz),
  public.book_appointment(uuid, timestamptz, text, text, boolean, text, uuid, smallint, text)
to authenticated;
-- Serveur de l'application (captcha et limitation en amont).
grant execute on function
  public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid, text, smallint, text),
  public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid, text, smallint, text),
  public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid, smallint, text)
to service_role;
revoke execute on function
  public.reception_create_ticket_core(uuid, public.priority_reason, uuid, uuid, text, boolean, text),
  public.check_in_appointment_core(uuid),
  public.create_appointment_request_core(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid),
  public.accept_appointment_request_core(uuid, uuid, timestamptz)
from service_role;
