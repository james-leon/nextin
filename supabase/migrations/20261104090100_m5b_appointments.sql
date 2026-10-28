-- M5b — Rendez-vous (docs/PLAN.md §12.3) : créneaux par praticien, congés, prise de rendez-vous par l'accueil,
-- arrivée du patient et intégration dans la file selon une règle d'équité configurable par agence,
-- confirmation et rappels WhatsApp (mêmes règles que le M7).
-- Jamais de nom de patient : un libellé court (initiales) visible du personnel seulement, jamais annoncé ni envoyé.

create extension if not exists btree_gist with schema extensions;

-- ─── Réglages de l'agence ────────────────────────────────────────────────────

alter table public.branch_settings
  -- `ratio` : après un rendez-vous, au moins N patients sans rendez-vous passent ; `strict` : rendez-vous d'abord.
  add column appointment_mode text not null default 'ratio' check (appointment_mode in ('ratio', 'strict')),
  add column appointment_walkin_ratio smallint not null default 2 check (appointment_walkin_ratio between 0 and 10),
  -- Priorité seulement à partir de X minutes avant l'heure du rendez-vous.
  add column appointment_early_minutes smallint not null default 15 check (appointment_early_minutes between 0 and 120),
  -- Arrivé plus de X minutes après l'heure : ticket ordinaire.
  add column appointment_late_grace_minutes smallint not null default 10 check (appointment_late_grace_minutes between 0 and 120),
  -- Sans arrivée X minutes après l'heure : absent.
  add column appointment_no_show_minutes smallint not null default 60 check (appointment_no_show_minutes between 15 and 480);

-- ─── Créneaux et congés des praticiens ───────────────────────────────────────

create table public.practitioner_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  practitioner_id uuid not null,
  -- Service des rendez-vous de cette plage (ex. Consultation) ; ticket créé dans ce service à l'arrivée.
  service_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  slot_minutes smallint not null check (slot_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, practitioner_id) references public.practitioners (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete cascade
);
create index practitioner_schedules_practitioner_idx on public.practitioner_schedules (practitioner_id, weekday);

/** Plages d'un même praticien et d'un même jour : jamais de chevauchement ; praticien et service de l'agence. */
create or replace function public.practitioner_schedules_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.practitioners where id = new.practitioner_id and branch_id = new.branch_id)
     or not exists (select 1 from public.services where id = new.service_id and branch_id = new.branch_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if exists (
    select 1 from public.practitioner_schedules s
    where s.practitioner_id = new.practitioner_id and s.weekday = new.weekday and s.id <> new.id
      and s.starts_at < new.ends_at and new.starts_at < s.ends_at
  ) then
    raise exception 'schedule_overlap' using errcode = 'P0409';
  end if;
  return new;
end;
$$;
create trigger practitioner_schedules_check before insert or update on public.practitioner_schedules
  for each row execute function public.practitioner_schedules_check();

create table public.practitioner_leaves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  practitioner_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reason text check (char_length(reason) <= 120),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, practitioner_id) references public.practitioners (organization_id, id) on delete cascade
);
create index practitioner_leaves_practitioner_idx on public.practitioner_leaves (practitioner_id, starts_on, ends_on);

-- ─── Rendez-vous ─────────────────────────────────────────────────────────────

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  practitioner_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Initiales ou court libellé pour reconnaître le patient à l'accueil : jamais annoncé, affiché sur TV ni envoyé.
  customer_label text check (char_length(customer_label) between 1 and 40),
  -- Numéro WhatsApp (accord du patient) : purgé avec les données personnelles.
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  status public.appointment_status not null default 'confirmed',
  rescheduled_from_id uuid references public.appointments (id) on delete set null,
  ticket_id uuid unique,
  booked_by uuid references auth.users (id) on delete set null,
  checked_in_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (organization_id, id),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, practitioner_id) references public.practitioners (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id),
  foreign key (organization_id, ticket_id) references public.tickets (organization_id, id) on delete set null (ticket_id),
  -- Un praticien ne reçoit jamais deux rendez-vous actifs sur la même plage.
  constraint appointments_no_overlap exclude using gist (
    practitioner_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status in ('confirmed', 'checked_in', 'completed'))
);
create index appointments_branch_starts_idx on public.appointments (branch_id, starts_at);
create index appointments_practitioner_starts_idx on public.appointments (practitioner_id, starts_at);
create index appointments_due_idx on public.appointments (starts_at) where status = 'confirmed';
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.tickets add column appointment_id uuid;
alter table public.tickets add constraint tickets_appointment_fkey
  foreign key (organization_id, appointment_id) references public.appointments (organization_id, id) on delete set null (appointment_id);
create index tickets_appointment_idx on public.tickets (appointment_id) where appointment_id is not null;

-- Contacts et messages rattachés à un rendez-vous (avant l'arrivée, il n'y a pas de ticket).
alter table public.notification_contacts alter column ticket_id drop not null;
alter table public.notification_contacts add column appointment_id uuid;
alter table public.notification_contacts
  add constraint notification_contacts_appointment_fkey
    foreign key (organization_id, appointment_id) references public.appointments (organization_id, id) on delete cascade,
  add constraint notification_contacts_subject_check check (ticket_id is not null or appointment_id is not null);
create unique index notification_contacts_appointment_uidx on public.notification_contacts (appointment_id, phone_e164)
  where ticket_id is null and channel = 'whatsapp';

alter table public.notification_jobs alter column ticket_id drop not null;
alter table public.notification_jobs add column appointment_id uuid;
alter table public.notification_jobs
  add constraint notification_jobs_appointment_fkey
    foreign key (organization_id, appointment_id) references public.appointments (organization_id, id) on delete cascade,
  add constraint notification_jobs_subject_check check (ticket_id is not null or appointment_id is not null);
create index notification_jobs_appointment_idx on public.notification_jobs (appointment_id) where appointment_id is not null;

-- ─── Créneaux libres ─────────────────────────────────────────────────────────

/** « Dr Mbarga » : titre et nom d'affichage du praticien. */
create or replace function public.practitioner_label(p_practitioner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select trim(coalesce(title || ' ', '') || display_name) from public.practitioners where id = p_practitioner;
$$;

/**
 * Créneaux d'un praticien sur `p_days` jours à partir de `p_from` (heure locale de l'agence) :
 * horaires hebdomadaires − congés − fermetures de l'agence − rendez-vous actifs − absence ou retard en cours − passé.
 */
create or replace function public.practitioner_free_slots(p_practitioner uuid, p_from date, p_days integer default 1)
returns table (starts_at timestamptz, ends_at timestamptz, service_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select pr.id, pr.branch_id, b.timezone from public.practitioners pr join public.branches b on b.id = pr.branch_id
    where pr.id = p_practitioner and pr.active
  ),
  days as (
    select d::date as d from p, generate_series(p_from, p_from + (least(greatest(p_days, 1), 31) - 1), interval '1 day') d
  ),
  raw as (
    select (t.t at time zone p.timezone) as starts_at,
           (t.t at time zone p.timezone) + make_interval(mins => s.slot_minutes) as ends_at,
           s.service_id, days.d
    from p
    join days on true
    join public.practitioner_schedules s on s.practitioner_id = p.id and s.weekday = extract(isodow from days.d)
    cross join lateral generate_series(days.d + s.starts_at, days.d + s.ends_at - make_interval(mins => s.slot_minutes),
      make_interval(mins => s.slot_minutes)) t(t)
  )
  select r.starts_at, r.ends_at, r.service_id
  from raw r, p
  where r.starts_at > now()
    and not exists (select 1 from public.practitioner_leaves l where l.practitioner_id = p.id and r.d between l.starts_on and l.ends_on)
    and not exists (select 1 from public.branch_closures c where c.branch_id = p.branch_id and c.date = r.d)
    and not exists (
      select 1 from public.appointments a
      where a.practitioner_id = p.id and a.status in ('confirmed', 'checked_in', 'completed')
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(r.starts_at, r.ends_at)
    )
    and not exists (
      -- Absence sans heure de retour : le reste de la journée ; retard ou absence datée : jusqu'à l'heure prévue.
      select 1 from public.practitioner_absences ab
      where ab.practitioner_id = p.id and ab.ended_at is null and ab.starts_at <= r.ends_at
        and (case when ab.until is null then r.d = (ab.starts_at at time zone p.timezone)::date else r.starts_at < ab.until end)
    )
  order by r.starts_at;
$$;

/** Créneaux libres, pour le personnel de l'agence (prise de rendez-vous à l'accueil). */
create or replace function public.available_slots(p_practitioner uuid, p_from date, p_days integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
begin
  select branch_id into v_branch from public.practitioners where id = p_practitioner;
  if v_branch is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_branch);
  return coalesce((
    select jsonb_agg(jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at, 'service_id', s.service_id) order by s.starts_at)
    from public.practitioner_free_slots(p_practitioner, p_from, p_days) s
  ), '[]'::jsonb);
end;
$$;

-- ─── Notifications des rendez-vous ───────────────────────────────────────────

/** Message d'un rendez-vous pour chaque contact du rendez-vous (avant l'arrivée), à envoyer à `p_at`. */
create or replace function public.enqueue_appointment_notification(
  p_appointment uuid, p_event public.notif_event, p_dedupe text, p_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification_jobs (organization_id, branch_id, appointment_id, contact_id, event, channel, dedupe_key, next_attempt_at)
  select c.organization_id, c.branch_id, c.appointment_id, c.id, p_event, c.channel::text::public.notif_channel,
         p_dedupe || ':' || c.id, p_at
  from public.notification_contacts c
  where c.appointment_id = p_appointment and c.ticket_id is null and c.opted_out_at is null
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  if v_count > 0 and p_at <= now() then perform public.kick_notification_dispatch(); end if;
  return v_count;
end;
$$;

/**
 * Confirmation (ou « rendez-vous déplacé ») tout de suite, puis rappels : la veille à 18 h et 2 heures avant
 * (heure de l'agence). Un rappel trop proche de la prise de rendez-vous n'est pas programmé.
 */
create or replace function public.schedule_appointment_notifications(p_appointment uuid, p_first public.notif_event)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_tz text;
  v_day_before timestamptz;
  v_two_hours timestamptz;
begin
  select * into v_a from public.appointments where id = p_appointment;
  select timezone into v_tz from public.branches where id = v_a.branch_id;
  perform public.enqueue_appointment_notification(v_a.id, p_first, 'appt:' || v_a.id || ':' || p_first::text);
  v_day_before := ((((v_a.starts_at at time zone v_tz)::date - 1) + time '18:00') at time zone v_tz);
  v_two_hours := v_a.starts_at - interval '2 hours';
  if v_day_before > now() + interval '30 minutes' and v_day_before < v_two_hours then
    perform public.enqueue_appointment_notification(v_a.id, 'appointment_reminder_day_before', 'appt:' || v_a.id || ':day_before', v_day_before);
  end if;
  if v_two_hours > now() + interval '30 minutes' then
    perform public.enqueue_appointment_notification(v_a.id, 'appointment_reminder_2h', 'appt:' || v_a.id || ':2h', v_two_hours);
  end if;
end;
$$;

/** Rappels encore en attente d'un rendez-vous annulé, déplacé, arrivé ou absent. */
create or replace function public.cancel_appointment_reminders(p_appointment uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_jobs set status = 'cancelled', error = 'appointment_changed'
  where appointment_id = p_appointment and status = 'pending'
    and event in ('appointment_confirmed', 'appointment_reminder_day_before', 'appointment_reminder_2h', 'appointment_rescheduled');
$$;

-- ─── Prise, déplacement, annulation ──────────────────────────────────────────

/** Vue d'un rendez-vous pour le personnel (statut affiché : « en attente » si arrivé et praticien absent ou en retard). */
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

/**
 * Prise de rendez-vous par l'accueil sur un créneau libre du praticien. Numéro WhatsApp facultatif, enregistré
 * seulement avec l'accord du patient ; confirmation et rappels programmés. Erreurs : `slot_unavailable`,
 * `consent_required`, `phone_invalid`.
 */
create or replace function public.book_appointment(
  p_practitioner uuid,
  p_starts_at timestamptz,
  p_customer_label text default null,
  p_phone_e164 text default null,
  p_consent boolean default false,
  p_locale text default 'fr',
  p_rescheduled_from uuid default null
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
begin
  select * into v_p from public.practitioners where id = p_practitioner and active;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_p.branch_id);
  if p_phone_e164 is not null then
    if p_phone_e164 !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
    if not coalesce(p_consent, false) then raise exception 'consent_required' using errcode = 'P0422'; end if;
  end if;
  select timezone into v_tz from public.branches where id = v_p.branch_id;
  select * into v_slot from public.practitioner_free_slots(p_practitioner, (p_starts_at at time zone v_tz)::date, 1) s
  where s.starts_at = p_starts_at;
  if not found then raise exception 'slot_unavailable' using errcode = 'P0409'; end if;

  begin
    insert into public.appointments (organization_id, branch_id, practitioner_id, service_id, starts_at, ends_at,
      customer_label, phone_e164, locale, rescheduled_from_id, booked_by)
    values (v_p.organization_id, v_p.branch_id, p_practitioner, v_slot.service_id, v_slot.starts_at, v_slot.ends_at,
      nullif(trim(p_customer_label), ''), p_phone_e164, case when p_locale = 'en' then 'en' else 'fr' end,
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

/** Verrouille un rendez-vous de l'agence du personnel connecté, dans l'un des états permis. */
create or replace function public.lock_appointment(p_appointment uuid, p_allowed public.appointment_status[])
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
begin
  select * into v_a from public.appointments where id = p_appointment for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_a.branch_id);
  if not v_a.status = any (p_allowed) then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  return v_a;
end;
$$;

/** Reprogrammation : l'ancien rendez-vous passe « reprogrammé », le nouveau garde le numéro et l'accord du patient. */
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
    v_a.phone_e164, v_a.phone_e164 is not null, v_a.locale, v_a.id);
  perform public.audit(v_a.organization_id, 'appointment.reschedule', 'appointment', v_a.id,
    jsonb_build_object('to', v_new ->> 'id', 'starts_at', p_starts_at));
  return v_new;
end;
$$;

create or replace function public.cancel_appointment(p_appointment uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
begin
  v_a := public.lock_appointment(p_appointment, array['confirmed']::public.appointment_status[]);
  update public.appointments set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '') where id = v_a.id;
  perform public.cancel_appointment_reminders(v_a.id);
  perform public.enqueue_appointment_notification(v_a.id, 'appointment_cancelled', 'appt:' || v_a.id || ':cancelled');
  perform public.audit(v_a.organization_id, 'appointment.cancel', 'appointment', v_a.id, jsonb_build_object('reason', p_reason));
  return public.appointment_json(v_a.id);
end;
$$;

create or replace function public.mark_appointment_no_show(p_appointment uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
begin
  v_a := public.lock_appointment(p_appointment, array['confirmed']::public.appointment_status[]);
  if v_a.starts_at > now() then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.appointments set status = 'no_show' where id = v_a.id;
  perform public.cancel_appointment_reminders(v_a.id);
  perform public.audit(v_a.organization_id, 'appointment.no_show', 'appointment', v_a.id, '{}'::jsonb);
  return public.appointment_json(v_a.id);
end;
$$;

-- ─── Arrivée du patient ──────────────────────────────────────────────────────

/**
 * Arrivée (accueil ; scan du QR par le patient au M9) : ticket du service du rendez-vous, rattaché au poste du
 * praticien (ou d'un collègue s'il est absent). À l'heure (jusqu'à la tolérance de retard), le ticket est prioritaire
 * « RDV » et classé à l'heure du rendez-vous ; au-delà, ticket ordinaire. Le numéro WhatsApp suit le ticket.
 */
create or replace function public.check_in_appointment(p_appointment uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_bs public.branch_settings;
  v_tz text;
  v_late boolean;
  v_counter uuid;
  v_ticket public.tickets;
begin
  v_a := public.lock_appointment(p_appointment, array['confirmed']::public.appointment_status[]);
  select * into v_bs from public.branch_settings where branch_id = v_a.branch_id;
  select timezone into v_tz from public.branches where id = v_a.branch_id;
  if (v_a.starts_at at time zone v_tz)::date <> public.branch_service_day(v_a.branch_id) then
    raise exception 'appointment_not_today' using errcode = 'P0409';
  end if;
  v_late := now() > v_a.starts_at + make_interval(mins => v_bs.appointment_late_grace_minutes);
  if (public.practitioner_absence_now(v_a.practitioner_id)).kind = 'absent' then
    v_counter := public.reroute_counter(v_a.practitioner_id);
  else
    v_counter := public.practitioner_counter(v_a.practitioner_id);
  end if;

  -- Service actif et quota (la priorité « RDV » ne dépend pas de l'option des priorités de l'agence).
  perform public.assert_can_issue(v_a.service_id, null, false);
  v_ticket := public.insert_ticket(v_a.service_id, 'reception',
    case when v_late then null else 'appointment' end::public.priority_reason, null, (select auth.uid()), null,
    case when v_late then null else (extract(epoch from v_a.starts_at) * 1000000)::bigint end);
  update public.tickets set appointment_id = v_a.id, preferred_counter_id = v_counter where id = v_ticket.id returning * into v_ticket;
  update public.appointments set status = 'checked_in', checked_in_at = now(), ticket_id = v_ticket.id where id = v_a.id;
  perform public.cancel_appointment_reminders(v_a.id);
  -- Le numéro suit le ticket : confirmation du ticket, puis alertes de la file (M7).
  insert into public.notification_contacts (organization_id, branch_id, ticket_id, appointment_id, channel, phone_e164, locale,
    consent_source, consent_at, consent_by)
  select c.organization_id, c.branch_id, v_ticket.id, v_a.id, c.channel, c.phone_e164, c.locale, c.consent_source, c.consent_at, c.consent_by
  from public.notification_contacts c
  where c.appointment_id = v_a.id and c.ticket_id is null and c.opted_out_at is null;
  perform public.audit(v_a.organization_id, 'appointment.check_in', 'appointment', v_a.id,
    jsonb_build_object('ticket_id', v_ticket.id, 'late', v_late));
  return jsonb_build_object('appointment', public.appointment_json(v_a.id), 'ticket', public.staff_ticket_json(v_ticket), 'late', v_late);
end;
$$;

/** Fin du passage : le rendez-vous suit son ticket (servi → terminé, absent à l'appel → absent, annulé → annulé). */
create or replace function public.ticket_events_appointment_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type not in ('served', 'no_show', 'cancelled', 'transferred') then return null; end if;
  update public.appointments a set status = case new.type
      when 'served' then 'completed' when 'transferred' then 'completed'
      when 'no_show' then 'no_show' else 'cancelled' end::public.appointment_status
  from public.tickets t
  where t.id = new.ticket_id and a.id = t.appointment_id and a.status = 'checked_in';
  return null;
end;
$$;
create trigger ticket_events_appointment_sync after insert on public.ticket_events
  for each row execute function public.ticket_events_appointment_sync();

/** Tâche (5 min) : rendez-vous sans arrivée après `appointment_no_show_minutes` → absent. */
create or replace function public.sweep_appointments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.appointments a set status = 'no_show'
  from public.branch_settings bs
  where bs.branch_id = a.branch_id and a.status = 'confirmed'
    and a.starts_at + make_interval(mins => bs.appointment_no_show_minutes) < now();
  get diagnostics v_count = row_count;
  update public.notification_jobs j set status = 'cancelled', error = 'appointment_changed'
  from public.appointments a
  where a.id = j.appointment_id and a.status = 'no_show' and j.status = 'pending';
  return v_count;
end;
$$;
select cron.schedule('nextin-sweep-appointments', '*/5 * * * *', $$select public.sweep_appointments()$$);

/** Rendez-vous d'une agence sur une période (jours locaux inclus), éventuellement d'un seul praticien. */
create or replace function public.list_appointments(p_branch uuid, p_from date, p_to date, p_practitioner uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  perform public.assert_branch_staff(p_branch);
  if p_to < p_from or p_to - p_from > 62 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  select timezone into v_tz from public.branches where id = p_branch;
  return coalesce((
    select jsonb_agg(public.appointment_json(a.id) order by a.starts_at, a.created_at)
    from public.appointments a
    where a.branch_id = p_branch
      and a.starts_at >= (p_from::timestamp at time zone v_tz)
      and a.starts_at < ((p_to + 1)::timestamp at time zone v_tz)
      and (p_practitioner is null or a.practitioner_id = p_practitioner)
  ), '[]'::jsonb);
end;
$$;

-- ─── Règle d'équité dans la file ─────────────────────────────────────────────

/**
 * Miroir exact de `pickNextTicket` (packages/shared/src/appointments/fairness.ts), mêmes cas de référence.
 * `p_candidates` : [{ id, at }] dans l'ordre standard de la file, `at` = heure du rendez-vous encore prioritaire.
 */
create or replace function public.fair_pick(
  p_candidates jsonb, p_mode text, p_ratio integer, p_early integer, p_since integer, p_now timestamptz
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_appointment text;
  v_walkin text;
begin
  if jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) = 0 then return null; end if;
  select c.value ->> 'id' into v_appointment
  from jsonb_array_elements(p_candidates) with ordinality c
  where c.value ->> 'at' is not null and (c.value ->> 'at')::timestamptz - make_interval(mins => p_early) <= p_now
  order by (c.value ->> 'at')::timestamptz, c.ordinality
  limit 1;
  select c.value ->> 'id' into v_walkin
  from jsonb_array_elements(p_candidates) with ordinality c
  where c.value ->> 'at' is null
  order by c.ordinality
  limit 1;
  if p_mode = 'strict' then return coalesce(v_appointment, v_walkin, p_candidates -> 0 ->> 'id'); end if;
  if v_appointment is not null and (p_since is null or p_since >= p_ratio or v_walkin is null) then return v_appointment; end if;
  return coalesce(v_walkin, p_candidates -> 0 ->> 'id');
end;
$$;

-- Compteur d'équité du poste : patients sans rendez-vous appelés depuis le dernier rendez-vous du jour.
alter table public.counters
  add column fairness_day date,
  add column fairness_walkins smallint;

/** Patients sans rendez-vous appelés à ce poste depuis le dernier rendez-vous du jour (null : aucun rendez-vous). */
create or replace function public.walkins_since_appointment(p_counter uuid, p_day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when fairness_day = p_day then fairness_walkins end from public.counters where id = p_counter;
$$;

/** Appel d'un ticket par un poste (M5), avec mise à jour du compteur d'équité des rendez-vous. */
create or replace function public.call_ticket_internal(p_counter uuid, p_ticket public.tickets)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
  v_appointment boolean := p_ticket.appointment_id is not null and p_ticket.priority_reason = 'appointment';
begin
  update public.tickets set status = 'called', counter_id = p_counter, called_at = now()
  where id = p_ticket.id returning * into v_row;
  update public.counters set
    fairness_walkins = case when v_appointment then 0
                            when fairness_day = v_row.service_day then least(fairness_walkins + 1, 1000) end,
    fairness_day = case when v_appointment then v_row.service_day else fairness_day end
  where id = p_counter;
  perform public.log_ticket_event(v_row, 'called');
  return public.staff_ticket_json(v_row);
end;
$$;

/**
 * Prochain ticket d'un poste : ordre standard (poste attitré, priorité, arrivée), puis règle d'équité des
 * rendez-vous de l'agence. Le ticket choisi est verrouillé (SKIP LOCKED) ; s'il vient d'être pris par un autre poste,
 * il est écarté et on recommence (appels simultanés : jamais deux fois le même ticket, jamais de faux « file vide »).
 */
create or replace function public.pick_next_ticket(p_counter uuid)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.counters;
  v_bs public.branch_settings;
  v_day date;
  v_candidates jsonb;
  v_pick uuid;
  v_skip uuid[] := '{}';
  v_next public.tickets;
begin
  select * into v_c from public.counters where id = p_counter;
  select * into v_bs from public.branch_settings where branch_id = v_c.branch_id;
  v_day := public.branch_service_day(v_c.branch_id);
  -- Chaque ticket déjà pris par un autre poste est écarté : la boucle se termine avec la file.
  loop
    select jsonb_agg(jsonb_build_object('id', x.id, 'at', x.at) order by x.rn) into v_candidates
    from (
      select t.id,
             case when t.appointment_id is not null and t.priority_reason = 'appointment' then a.starts_at end as at,
             row_number() over (order by coalesce(t.preferred_counter_id = p_counter, false) desc, t.priority_level desc, t.sort_key, t.number) as rn
      from public.tickets t
      join public.counter_services cs on cs.service_id = t.service_id and cs.counter_id = p_counter
      left join public.counters pc on pc.id = t.preferred_counter_id
      left join public.appointments a on a.id = t.appointment_id
      where t.branch_id = v_c.branch_id
        and t.status = 'waiting'
        and t.service_day = v_day
        and not t.id = any (v_skip)
        and (
          t.preferred_counter_id is null
          or t.preferred_counter_id = p_counter
          -- Poste attitré fermé ou en pause : un autre poste le prend, sauf praticien en retard (le patient l'attend).
          or (pc.status <> 'open' and public.practitioner_late_until(pc.default_practitioner_id) is null)
        )
      order by rn
      limit 50
    ) x;
    v_pick := public.fair_pick(v_candidates, v_bs.appointment_mode, v_bs.appointment_walkin_ratio,
      v_bs.appointment_early_minutes, public.walkins_since_appointment(p_counter, v_day), now())::uuid;
    if v_pick is null then return null; end if;
    select * into v_next from public.tickets where id = v_pick and status = 'waiting' for update skip locked;
    if found then return v_next; end if;
    v_skip := v_skip || v_pick;
  end loop;
end;
$$;

-- ─── Expéditeur (M7) : messages des rendez-vous ──────────────────────────────

/** Données d'un rendez-vous pour un message (praticien, établissement, heure locale) : aucun nom de patient. */
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
    'organization', o.name
  )
  from public.appointments a
  join public.branches b on b.id = a.branch_id
  join public.organizations o on o.id = a.organization_id
  join public.services s on s.id = a.service_id
  where a.id = p_appointment;
$$;

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
    'fallback_status', (select f.status from public.notification_jobs f where f.id = j.fallback_of),
    'contact', case when c.id is not null then jsonb_build_object(
      'id', c.id,
      'phone_e164', c.phone_e164,
      'locale', c.locale,
      'push_subscription', c.push_subscription,
      'window_expires_at', c.window_expires_at,
      'opted_out', c.opted_out_at is not null
        or (c.phone_e164 is not null and exists (
          select 1 from public.whatsapp_opt_outs o where o.phone_hash = public.sha256_hex(c.phone_e164)))
    ) end,
    'token', t.public_token,
    'ticket', case when t.id is not null then public.ticket_view(t.id) end,
    'appointment', case when j.appointment_id is not null and j.ticket_id is null then public.appointment_notification_view(j.appointment_id) end
  )), '[]'::jsonb) into v_result
  from claimed j
  left join public.tickets t on t.id = j.ticket_id
  left join public.notification_contacts c on c.id = j.contact_id;
  return v_result;
end;
$$;

create or replace function public.schedule_sms_fallback(p_job uuid, p_delay_seconds integer default 0, p_guard boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notification_jobs (organization_id, branch_id, ticket_id, appointment_id, contact_id, event, channel, dedupe_key,
    next_attempt_at, fallback_of, guard)
  select j.organization_id, j.branch_id, j.ticket_id, j.appointment_id, j.contact_id, j.event, 'sms', 'sms:' || j.id,
         now() + make_interval(secs => greatest(p_delay_seconds, 0)), j.id, p_guard
  from public.notification_jobs j
  join public.notification_contacts c on c.id = j.contact_id and c.phone_e164 is not null
  where j.id = p_job and j.channel = 'whatsapp'
  on conflict (dedupe_key) do update set
    next_attempt_at = least(public.notification_jobs.next_attempt_at, excluded.next_attempt_at),
    guard = public.notification_jobs.guard and excluded.guard
  where public.notification_jobs.status = 'pending'
  returning id into v_id;
  if v_id is not null and p_delay_seconds <= 0 then perform public.kick_notification_dispatch(); end if;
  return v_id;
end;
$$;

-- ─── Purge : numéros et libellés des rendez-vous ─────────────────────────────

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
  update public.appointments a set phone_e164 = null, customer_label = null
  from public.organizations o
  where o.id = a.organization_id and a.starts_at < now() - make_interval(days => o.data_retention_days)
    and (a.phone_e164 is not null or a.customer_label is not null);
  -- Le texte envoyé contient le lien du ticket ou l'heure du rendez-vous : seuls restent événement, canal, statut, dates.
  update public.notification_jobs j set payload = '{}'::jsonb
  from public.organizations o
  where o.id = j.organization_id and j.payload <> '{}'::jsonb
    and (
      exists (select 1 from public.tickets t where t.id = j.ticket_id and t.created_at < now() - make_interval(days => o.data_retention_days))
      or exists (select 1 from public.appointments a where a.id = j.appointment_id and j.ticket_id is null
                 and a.starts_at < now() - make_interval(days => o.data_retention_days))
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
  public.practitioner_schedules_check(), public.practitioner_label(uuid), public.practitioner_free_slots(uuid, date, integer),
  public.enqueue_appointment_notification(uuid, public.notif_event, text, timestamptz),
  public.schedule_appointment_notifications(uuid, public.notif_event), public.cancel_appointment_reminders(uuid),
  public.appointment_json(uuid), public.lock_appointment(uuid, public.appointment_status[]),
  public.ticket_events_appointment_sync(), public.sweep_appointments(), public.fair_pick(jsonb, text, integer, integer, integer, timestamptz),
  public.walkins_since_appointment(uuid, date), public.pick_next_ticket(uuid), public.call_ticket_internal(uuid, public.tickets), public.appointment_notification_view(uuid),
  public.claim_notification_jobs(integer), public.schedule_sms_fallback(uuid, integer, boolean), public.purge_personal_data(),
  public.available_slots(uuid, date, integer), public.book_appointment(uuid, timestamptz, text, text, boolean, text, uuid),
  public.reschedule_appointment(uuid, timestamptz, uuid), public.cancel_appointment(uuid, text),
  public.mark_appointment_no_show(uuid), public.check_in_appointment(uuid), public.list_appointments(uuid, date, date, uuid)
from public, anon, authenticated;

grant execute on function
  public.available_slots(uuid, date, integer), public.book_appointment(uuid, timestamptz, text, text, boolean, text, uuid),
  public.reschedule_appointment(uuid, timestamptz, uuid), public.cancel_appointment(uuid, text),
  public.mark_appointment_no_show(uuid), public.check_in_appointment(uuid), public.list_appointments(uuid, date, date, uuid)
to authenticated;
grant execute on function public.claim_notification_jobs(integer), public.schedule_sms_fallback(uuid, integer, boolean) to service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.practitioner_schedules enable row level security;
alter table public.practitioner_leaves enable row level security;
alter table public.appointments enable row level security;

revoke all on public.practitioner_schedules, public.practitioner_leaves, public.appointments from anon;
-- Rendez-vous : lecture par le personnel de l'agence, écritures uniquement par RPC.
revoke insert, update, delete, truncate on public.appointments from authenticated;

create policy practitioner_schedules_select on public.practitioner_schedules for select to authenticated
  using ((public.can_access_branch(organization_id, branch_id) and not public.is_anonymous()) or public.is_platform_admin());
create policy practitioner_schedules_write on public.practitioner_schedules for all to authenticated
  using (public.can_manage_branch(organization_id, branch_id))
  with check (public.can_manage_branch(organization_id, branch_id));
create policy practitioner_leaves_select on public.practitioner_leaves for select to authenticated
  using ((public.can_access_branch(organization_id, branch_id) and not public.is_anonymous()) or public.is_platform_admin());
create policy practitioner_leaves_write on public.practitioner_leaves for all to authenticated
  using (public.can_manage_branch(organization_id, branch_id))
  with check (public.can_manage_branch(organization_id, branch_id));
create policy appointments_select on public.appointments for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) and not public.is_anonymous());
