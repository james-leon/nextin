-- ═════════════════════════════════════════════════════════════════════════════
-- M5 — Postes réception et agent : sessions et pauses des postes, absences et retards
-- des praticiens (réorientation automatique, §12.2), contact WhatsApp saisi à l'accueil
-- avec consentement, appel d'un ticket précis (rejeu hors ligne, §5.4).
-- ═════════════════════════════════════════════════════════════════════════════

create type public.absence_kind as enum ('absent', 'late');

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.counter_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  counter_id uuid not null,
  agent_id uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, counter_id) references public.counters (organization_id, id) on delete cascade,
  check (ended_at is null or ended_at >= started_at)
);
create index counter_sessions_counter_idx on public.counter_sessions (counter_id, started_at desc);
create unique index counter_sessions_one_open_idx on public.counter_sessions (counter_id) where ended_at is null;

create table public.counter_pauses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  counter_id uuid not null,
  session_id uuid references public.counter_sessions (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, counter_id) references public.counters (organization_id, id) on delete cascade,
  check (ended_at is null or ended_at >= started_at)
);
create index counter_pauses_counter_idx on public.counter_pauses (counter_id, started_at desc);
create unique index counter_pauses_one_open_idx on public.counter_pauses (counter_id) where ended_at is null;

-- Absence (jusqu'à `until`, ou jusqu'à la fin déclarée) ou retard (retour prévu à `until`).
create table public.practitioner_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  practitioner_id uuid not null,
  kind public.absence_kind not null,
  starts_at timestamptz not null default now(),
  until timestamptz,
  reason text check (char_length(reason) <= 200),
  declared_by uuid references auth.users (id) on delete set null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'absent' or until is not null),
  check (until is null or until > starts_at),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, practitioner_id) references public.practitioners (organization_id, id) on delete cascade
);
create index practitioner_absences_active_idx on public.practitioner_absences (practitioner_id) where ended_at is null;
create index practitioner_absences_branch_idx on public.practitioner_absences (branch_id, created_at desc);

-- Contact d'alerte d'un ticket (envoi au M7). Numéro saisi par l'accueil uniquement avec l'accord du patient.
create table public.notification_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  ticket_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  consent_source text not null check (consent_source in ('customer_optin', 'reception_with_consent')),
  consent_at timestamptz not null,
  consent_by uuid references auth.users (id) on delete set null,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, ticket_id) references public.tickets (organization_id, id) on delete cascade
);
create index notification_contacts_ticket_idx on public.notification_contacts (ticket_id);

alter table public.ticket_events drop constraint ticket_events_type_check;
alter table public.ticket_events add constraint ticket_events_type_check check (type in (
  'created', 'called', 'recalled', 'admitted', 'served', 'no_show', 'cancelled', 'transferred',
  'moved_back', 'priority_changed', 'expired', 'rated', 'rerouted'
));

-- ─── Praticiens : présence et postes ─────────────────────────────────────────

/** Absence en cours (non terminée, pas encore échue). */
create or replace function public.practitioner_absence_now(p_practitioner uuid)
returns public.practitioner_absences
language sql
stable
security definer
set search_path = ''
as $$
  select a.* from public.practitioner_absences a
  where a.practitioner_id = p_practitioner and a.ended_at is null and a.starts_at <= now()
    and (a.until is null or a.until > now())
  order by a.created_at desc
  limit 1;
$$;

/** Heure de retour prévue d'un praticien en retard (null s'il n'est pas en retard). */
create or replace function public.practitioner_late_until(p_practitioner uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case when (public.practitioner_absence_now(p_practitioner)).kind = 'late'
              then (public.practitioner_absence_now(p_practitioner)).until end;
$$;

/** Poste attitré d'un praticien (un poste ouvert d'abord). */
create or replace function public.practitioner_counter(p_practitioner uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.counters c
  where c.default_practitioner_id = p_practitioner and c.active
  order by (c.status = 'open') desc, c.kind, c.number
  limit 1;
$$;

/**
 * Collègue de remplacement (§12.2) : même spécialité, même agence, actif, ni absent ni en retard,
 * avec un poste actif (ouvert d'abord). Renvoie le poste, ou null (file commune du service).
 */
create or replace function public.reroute_counter(p_practitioner uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.practitioners p
  join public.practitioners o on o.branch_id = p.branch_id and o.specialty_id = p.specialty_id and o.id <> p.id and o.active
  join public.counters c on c.default_practitioner_id = o.id and c.active
  where p.id = p_practitioner and p.specialty_id is not null
    and (public.practitioner_absence_now(o.id)).id is null
  order by (c.status = 'open') desc, c.kind, c.number
  limit 1;
$$;

-- ─── Vue client : retour prévu du praticien en retard ────────────────────────

create or replace function public.ticket_practitioner_late_until(p_ticket uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.practitioner_late_until(c.default_practitioner_id)
  from public.tickets t
  join public.counters c on c.id = t.preferred_counter_id
  where t.id = p_ticket and c.default_practitioner_id is not null;
$$;

/** Attente : estimation de la file, mais jamais avant le retour prévu d'un praticien en retard. */
create or replace function public.ticket_wait_seconds(p_ticket uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(
    public.estimate_wait_seconds(public.ticket_position(t.id) - 1, array_agg(l.duration_seconds), array_agg(l.busy_remaining_seconds)),
    coalesce(round(extract(epoch from public.ticket_practitioner_late_until(t.id) - now()))::integer, 0)
  )
  from public.tickets t, public.service_counter_loads(t.service_id) l
  where t.id = p_ticket
  group by t.id;
$$;

create or replace function public.ticket_view(p_ticket uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'display_code', t.display_code,
    'status', t.status,
    'source', t.source,
    'priority_reason', t.priority_reason,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color),
    'branch', jsonb_build_object('id', b.id, 'name', b.name),
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
    'position', case when t.status = 'waiting' then public.ticket_position(t.id) end,
    'wait_seconds', case when t.status = 'waiting' then public.ticket_wait_seconds(t.id) end,
    'practitioner_late_until', case when t.status = 'waiting' then public.ticket_practitioner_late_until(t.id) end,
    'counter', case when c.id is not null then jsonb_build_object('kind', c.kind, 'number', c.number, 'label', c.label) end,
    'called_at', t.called_at,
    'serving_started_at', t.serving_started_at,
    'finished_at', t.finished_at,
    'rating', t.rating,
    'rating_enabled', bs.rating_enabled,
    'created_at', t.created_at
  )
  from public.tickets t
  join public.services s on s.id = t.service_id
  join public.branches b on b.id = t.branch_id
  join public.organizations o on o.id = t.organization_id
  join public.branch_settings bs on bs.branch_id = t.branch_id
  left join public.counters c on c.id = t.counter_id
  where t.id = p_ticket;
$$;

/** Rediffuse la vue des tickets en attente rattachés aux postes d'un praticien (retard déclaré ou levé). */
create or replace function public.broadcast_practitioner_tickets(p_practitioner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket record;
begin
  for v_ticket in
    select t.id, t.public_token from public.tickets t
    join public.counters c on c.id = t.preferred_counter_id
    where c.default_practitioner_id = p_practitioner and t.status = 'waiting' and t.public_token is not null
  loop
    perform public.broadcast('ticket:' || v_ticket.public_token, 'ticket', public.ticket_view(v_ticket.id), false);
  end loop;
end;
$$;

-- ─── Postes : sessions et pauses ─────────────────────────────────────────────

create or replace function public.set_counter_status(p_counter uuid, p_status public.counter_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.counters;
  v_session uuid;
begin
  select * into v_c from public.counters where id = p_counter for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_c.branch_id);
  if not v_c.active then raise exception 'counter_not_open' using errcode = 'P0409'; end if;
  if p_status <> 'open' and exists (select 1 from public.tickets where counter_id = p_counter and status in ('called', 'serving')) then
    raise exception 'counter_busy' using errcode = 'P0409';
  end if;

  -- Toute pause en cours se termine (reprise, fermeture).
  update public.counter_pauses set ended_at = now() where counter_id = p_counter and ended_at is null;
  select id into v_session from public.counter_sessions where counter_id = p_counter and ended_at is null;

  if p_status = 'open' then
    -- Ouverture par un autre membre du personnel : nouvelle session à son nom.
    if v_session is not null and v_c.current_agent_id is distinct from (select auth.uid()) then
      update public.counter_sessions set ended_at = now() where id = v_session;
      v_session := null;
    end if;
    if v_session is null then
      insert into public.counter_sessions (organization_id, branch_id, counter_id, agent_id)
      values (v_c.organization_id, v_c.branch_id, p_counter, (select auth.uid()));
    end if;
  elsif p_status = 'paused' then
    insert into public.counter_pauses (organization_id, branch_id, counter_id, session_id)
    values (v_c.organization_id, v_c.branch_id, p_counter, v_session);
  else
    update public.counter_sessions set ended_at = now() where id = v_session;
  end if;

  update public.counters
  set status = p_status,
      status_changed_at = now(),
      current_agent_id = case when p_status = 'open' then (select auth.uid()) when p_status = 'closed' then null else current_agent_id end
  where id = p_counter
  returning * into v_c;
  -- Pause ou fermeture : les patients attitrés repassent dans la file commune, sauf si le praticien
  -- est déclaré en retard (ils l'attendent, §12.2).
  if p_status <> 'open' and public.practitioner_late_until(v_c.default_practitioner_id) is null then
    update public.tickets set preferred_counter_id = null where preferred_counter_id = p_counter and status = 'waiting';
  end if;
  perform public.audit(v_c.organization_id, 'counter.' || p_status::text, 'counter', p_counter, '{}'::jsonb);
  return jsonb_build_object('id', v_c.id, 'status', v_c.status, 'status_changed_at', v_c.status_changed_at);
end;
$$;

-- ─── Appel : choix du ticket, appel d'un ticket précis ───────────────────────

/** Prochain ticket pour un poste (verrouillé) : attitré d'abord, puis priorité, ancienneté, numéro. */
create or replace function public.pick_next_ticket(p_counter uuid)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.counters;
  v_next public.tickets;
begin
  select * into v_c from public.counters where id = p_counter;
  select t.* into v_next
  from public.tickets t
  join public.counter_services cs on cs.service_id = t.service_id and cs.counter_id = p_counter
  left join public.counters pc on pc.id = t.preferred_counter_id
  where t.branch_id = v_c.branch_id
    and t.status = 'waiting'
    and t.service_day = public.branch_service_day(v_c.branch_id)
    and (
      t.preferred_counter_id is null
      or t.preferred_counter_id = p_counter
      -- Poste attitré fermé ou en pause : un autre poste le prend, sauf praticien en retard (le patient l'attend).
      or (pc.status <> 'open' and public.practitioner_late_until(pc.default_practitioner_id) is null)
    )
  order by coalesce(t.preferred_counter_id = p_counter, false) desc, t.priority_level desc, t.sort_key, t.number
  limit 1
  for update of t skip locked;
  return v_next;
end;
$$;

create or replace function public.call_ticket_internal(p_counter uuid, p_ticket public.tickets)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  update public.tickets set status = 'called', counter_id = p_counter, called_at = now()
  where id = p_ticket.id returning * into v_row;
  perform public.log_ticket_event(v_row, 'called');
  return public.staff_ticket_json(v_row);
end;
$$;

/** Contrôles communs : poste existant, personnel de l'agence, rejeu, poste ouvert et libre. */
create or replace function public.lock_counter_for_call(p_counter uuid, p_finish_current boolean)
returns public.counters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.counters;
  v_current public.tickets;
begin
  select * into v_c from public.counters where id = p_counter for update;
  if v_c.status <> 'open' or not v_c.active then
    raise exception 'counter_not_open' using errcode = 'P0409';
  end if;
  select * into v_current from public.tickets where counter_id = p_counter and status in ('called', 'serving') for update;
  if found then
    if v_current.status = 'serving' and p_finish_current then
      perform public.finish_ticket_internal(v_current);
    else
      raise exception 'counter_busy' using errcode = 'P0409';
    end if;
  end if;
  return v_c;
end;
$$;

create or replace function public.call_next(p_counter uuid, p_client_op_id uuid default null, p_finish_current boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_next public.tickets;
  v_replay jsonb;
  v_result jsonb;
begin
  select branch_id into v_branch from public.counters where id = p_counter;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_branch);
  if p_client_op_id is not null then
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then return v_replay -> 'result'; end if;
  end if;
  perform public.lock_counter_for_call(p_counter, p_finish_current);
  v_next := public.pick_next_ticket(p_counter);
  if v_next.id is not null then v_result := public.call_ticket_internal(p_counter, v_next); end if;
  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, 'call_next', v_result); end if;
  return v_result;
end;
$$;

/**
 * Appel d'un ticket précis (poste hors ligne qui avait choisi ce ticket dans sa copie de la file, §5.4).
 * Si ce ticket n'est plus disponible (appelé ailleurs, annulé…), le prochain disponible est appelé
 * à la place : la réponse porte alors `conflict: true` et `requested_code`.
 */
create or replace function public.call_ticket(p_counter uuid, p_ticket uuid, p_client_op_id uuid default null, p_finish_current boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_ticket public.tickets;
  v_next public.tickets;
  v_replay jsonb;
  v_result jsonb;
  v_requested text;
begin
  select branch_id into v_branch from public.counters where id = p_counter;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_branch);
  if p_client_op_id is not null then
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then return v_replay -> 'result'; end if;
  end if;
  perform public.lock_counter_for_call(p_counter, p_finish_current);

  select t.* into v_ticket
  from public.tickets t
  join public.counter_services cs on cs.service_id = t.service_id and cs.counter_id = p_counter
  where t.id = p_ticket and t.branch_id = v_branch and t.status = 'waiting'
    and t.service_day = public.branch_service_day(v_branch)
  for update of t skip locked;

  if v_ticket.id is not null then
    v_result := public.call_ticket_internal(p_counter, v_ticket) || jsonb_build_object('conflict', false);
  else
    select display_code into v_requested from public.tickets where id = p_ticket and branch_id = v_branch;
    v_next := public.pick_next_ticket(p_counter);
    v_result := coalesce(public.call_ticket_internal(p_counter, v_next), '{}'::jsonb)
      || jsonb_build_object('conflict', true, 'requested_code', v_requested, 'empty', v_next.id is null);
    if v_next.id is null then v_result := v_result - 'id'; end if;
  end if;
  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, 'call_ticket', v_result); end if;
  return v_result;
end;
$$;

-- ─── Accueil : ticket avec praticien choisi et contact WhatsApp ──────────────

drop function public.reception_create_ticket(uuid, public.priority_reason, uuid);

/**
 * Ticket créé à l'accueil (patient sans smartphone). Praticien choisi : ticket attitré à son poste,
 * ou à un collègue de la même spécialité s'il est absent. Numéro WhatsApp seulement avec l'accord du patient.
 */
create or replace function public.reception_create_ticket(
  p_service uuid,
  p_priority_reason public.priority_reason default null,
  p_client_op_id uuid default null,
  p_practitioner uuid default null,
  p_phone_e164 text default null,
  p_consent boolean default false,
  p_locale text default 'fr'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.services;
  v_row public.tickets;
  v_counter uuid;
  v_rerouted boolean := false;
  v_replay jsonb;
  v_result jsonb;
begin
  select * into v_s from public.services where id = p_service;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_s.branch_id);
  if p_client_op_id is not null then
    v_replay := public.client_op_replay(p_client_op_id);
    if v_replay is not null then return v_replay -> 'result'; end if;
  end if;
  if p_phone_e164 is not null then
    if p_phone_e164 !~ '^\+237[26][0-9]{8}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
    if not coalesce(p_consent, false) then raise exception 'consent_required' using errcode = 'P0422'; end if;
  end if;
  if p_practitioner is not null then
    if not exists (select 1 from public.practitioners where id = p_practitioner and branch_id = v_s.branch_id and active) then
      raise exception 'not_found' using errcode = 'P0404';
    end if;
    if (public.practitioner_absence_now(p_practitioner)).kind = 'absent' then
      v_counter := public.reroute_counter(p_practitioner);
      v_rerouted := true;
    else
      v_counter := public.practitioner_counter(p_practitioner);
    end if;
  end if;

  perform public.assert_can_issue(p_service, p_priority_reason, false);
  v_row := public.insert_ticket(p_service, 'reception', p_priority_reason, null, (select auth.uid()));
  if v_counter is not null then
    update public.tickets set preferred_counter_id = v_counter where id = v_row.id returning * into v_row;
  end if;
  if p_phone_e164 is not null then
    insert into public.notification_contacts (organization_id, branch_id, ticket_id, channel, phone_e164, locale, consent_source, consent_at, consent_by)
    values (v_row.organization_id, v_row.branch_id, v_row.id, 'whatsapp', p_phone_e164,
            case when p_locale = 'en' then 'en' else 'fr' end, 'reception_with_consent', now(), (select auth.uid()));
  end if;
  v_result := public.staff_ticket_json(v_row) || jsonb_build_object('rerouted', v_rerouted, 'preferred_counter_id', v_counter);
  if p_client_op_id is not null then perform public.client_op_save(p_client_op_id, 'reception_create_ticket', v_result); end if;
  return v_result;
end;
$$;

-- ─── Absences et retards des praticiens (§12.2) ──────────────────────────────

create or replace function public.declare_practitioner_absence(
  p_practitioner uuid,
  p_kind public.absence_kind,
  p_until timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.practitioners;
  v_absence uuid;
  v_target uuid;
  v_count integer := 0;
  v_ticket public.tickets;
begin
  select * into v_p from public.practitioners where id = p_practitioner;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_p.branch_id);
  if p_kind = 'late' and (p_until is null or p_until <= now()) then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  if p_until is not null and p_until > now() + interval '24 hours' and p_kind = 'late' then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;

  update public.practitioner_absences set ended_at = now() where practitioner_id = p_practitioner and ended_at is null;
  insert into public.practitioner_absences (organization_id, branch_id, practitioner_id, kind, until, reason, declared_by)
  values (v_p.organization_id, v_p.branch_id, p_practitioner, p_kind, p_until, nullif(trim(p_reason), ''), (select auth.uid()))
  returning id into v_absence;

  if p_kind = 'absent' then
    -- Réorientation : ancienneté et priorité conservées (seul le poste attitré change).
    v_target := public.reroute_counter(p_practitioner);
    for v_ticket in
      update public.tickets t set preferred_counter_id = v_target
      from public.counters c
      where c.id = t.preferred_counter_id and c.default_practitioner_id = p_practitioner and t.status = 'waiting'
      returning t.*
    loop
      v_count := v_count + 1;
      perform public.log_ticket_event(v_ticket, 'rerouted',
        jsonb_build_object('from_practitioner_id', p_practitioner, 'to_counter_id', v_target));
    end loop;
  else
    perform public.broadcast_practitioner_tickets(p_practitioner);
  end if;

  perform public.audit(v_p.organization_id, 'practitioner.' || p_kind::text, 'practitioner', p_practitioner,
    jsonb_build_object('until', p_until, 'rerouted', v_count, 'to_counter_id', v_target));
  return jsonb_build_object('absence_id', v_absence, 'kind', p_kind, 'rerouted', v_count, 'to_counter_id', v_target);
end;
$$;

create or replace function public.end_practitioner_absence(p_absence uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.practitioner_absences;
begin
  select * into v_a from public.practitioner_absences where id = p_absence for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_a.branch_id);
  if v_a.ended_at is not null then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.practitioner_absences set ended_at = now() where id = p_absence;
  perform public.broadcast_practitioner_tickets(v_a.practitioner_id);
  perform public.broadcast_branch(v_a.branch_id);
  perform public.audit(v_a.organization_id, 'practitioner.back', 'practitioner', v_a.practitioner_id, '{}'::jsonb);
  return jsonb_build_object('absence_id', p_absence, 'ended', true);
end;
$$;

-- ─── Purge des données personnelles : contacts inclus ───────────────────────

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
  public.practitioner_absence_now(uuid), public.practitioner_late_until(uuid), public.practitioner_counter(uuid),
  public.reroute_counter(uuid), public.ticket_practitioner_late_until(uuid), public.broadcast_practitioner_tickets(uuid),
  public.pick_next_ticket(uuid), public.call_ticket_internal(uuid, public.tickets), public.lock_counter_for_call(uuid, boolean),
  public.ticket_wait_seconds(uuid), public.ticket_view(uuid), public.set_counter_status(uuid, public.counter_status),
  public.purge_personal_data()
from public, anon, authenticated;

grant execute on function
  public.call_ticket(uuid, uuid, uuid, boolean),
  public.reception_create_ticket(uuid, public.priority_reason, uuid, uuid, text, boolean, text),
  public.declare_practitioner_absence(uuid, public.absence_kind, timestamptz, text),
  public.end_practitioner_absence(uuid)
to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.counter_sessions enable row level security;
alter table public.counter_pauses enable row level security;
alter table public.practitioner_absences enable row level security;
alter table public.notification_contacts enable row level security;

revoke all on public.counter_sessions, public.counter_pauses, public.practitioner_absences, public.notification_contacts from anon;
revoke insert, update, delete, truncate on public.counter_sessions, public.counter_pauses, public.practitioner_absences,
  public.notification_contacts from authenticated;

create policy counter_sessions_select on public.counter_sessions for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin());
create policy counter_pauses_select on public.counter_pauses for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin());
create policy practitioner_absences_select on public.practitioner_absences for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin());
-- Numéro de téléphone : personnel de l'agence seulement (jamais le client, jamais un autre établissement).
create policy notification_contacts_select on public.notification_contacts for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) and not public.is_anonymous());
