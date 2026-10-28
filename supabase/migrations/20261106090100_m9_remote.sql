-- M9 — Distance (docs/PLAN.md §5.3, §12.6) :
-- 1. établissements à proximité (PostGIS) et page publique d'une agence, attente en direct ;
-- 2. ticket à distance (option par agence, désactivée par défaut) : « quand partir », confirmation de présence par scan
--    sur place, recul puis annulation sans confirmation ;
-- 3. demande de rendez-vous par le patient (numéro WhatsApp vérifié par code), confirmée ou modifiée par l'accueil,
--    réponse sur WhatsApp (option par agence, désactivée par défaut).
-- Aucune coordonnée du client n'est enregistrée : seul le temps de trajet estimé est gardé sur le ticket.

-- ─── Réglages de l'agence ────────────────────────────────────────────────────

alter table public.branch_settings
  -- Visible dans « Établissements à proximité » (attente en direct). Le ticket à distance reste une option à part.
  add column public_listing_enabled boolean not null default true,
  -- « Quand partir » : vitesse moyenne en ville (distance à vol d'oiseau × 1,3) et marge avant l'heure de départ.
  add column remote_travel_kmh smallint not null default 20 check (remote_travel_kmh between 5 and 80),
  add column remote_leave_margin_minutes smallint not null default 10 check (remote_leave_margin_minutes between 0 and 60),
  add column appointment_requests_enabled boolean not null default false,
  -- Jours proposés au patient pour une demande de rendez-vous.
  add column appointment_request_days smallint not null default 14 check (appointment_request_days between 1 and 60);

-- ─── Ticket à distance ───────────────────────────────────────────────────────

alter table public.tickets
  add column on_my_way_at timestamptz,
  -- Trajet estimé (secondes) : calculé à la prise du ticket ou saisi par le client ; jamais ses coordonnées.
  add column remote_travel_seconds integer check (remote_travel_seconds between 0 and 86400);

alter table public.ticket_events drop constraint ticket_events_type_check;
alter table public.ticket_events add constraint ticket_events_type_check check (type in (
  'created', 'called', 'recalled', 'admitted', 'served', 'no_show', 'cancelled', 'transferred',
  'moved_back', 'priority_changed', 'expired', 'rated', 'rerouted', 'presence_confirmed', 'on_my_way'
));

-- ─── Établissements à proximité ──────────────────────────────────────────────

/** Résumé public d'une agence : files, attente, options ; aucune donnée personnelle. */
create or replace function public.branch_summary(p_branch uuid, p_distance_m double precision)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with board as (select public.branch_board(p_branch) as v)
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'address', b.address,
    'city', b.city,
    'latitude', b.latitude,
    'longitude', b.longitude,
    'distance_m', case when p_distance_m is null then null else round(p_distance_m) end,
    'organization', jsonb_build_object('name', o.name, 'type', o.type),
    'is_open', public.branch_is_open(b.id),
    'remote_enabled', bs.remote_tickets_enabled and exists (
      select 1 from public.services s where s.branch_id = b.id and s.active and s.allow_remote),
    'requests_enabled', bs.appointment_requests_enabled and exists (
      select 1 from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
      where ps.branch_id = b.id),
    'waiting', (select coalesce(sum(jsonb_array_length(s -> 'waiting')), 0)::integer from board, jsonb_array_elements(board.v -> 'services') s),
    -- Attente la plus courte parmi les services ouverts (indication de la liste).
    'min_wait_seconds', (select min((s ->> 'wait_seconds')::integer) from board, jsonb_array_elements(board.v -> 'services') s
                         where (s ->> 'open')::boolean),
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s ->> 'id', 'prefix', s ->> 'prefix', 'name', s ->> 'name', 'name_en', s ->> 'name_en', 'color', s ->> 'color',
        'open', (s ->> 'open')::boolean, 'waiting', jsonb_array_length(s -> 'waiting'), 'wait_seconds', (s ->> 'wait_seconds')::integer
      )), '[]'::jsonb) from board, jsonb_array_elements(board.v -> 'services') s)
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id
  join public.branch_settings bs on bs.branch_id = b.id
  where b.id = p_branch;
$$;

/**
 * Agences visibles du public, les plus proches d'abord (rayon en km), ou par ville et nom sans position.
 * Recherche facultative sur l'établissement, l'agence et la ville. 30 résultats au plus.
 */
create or replace function public.nearby_branches(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default 25,
  p_query text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_point extensions.geography;
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or p_radius_km not between 0.5 and 200 or char_length(v_q) > 60 then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  if p_lat is not null then
    v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;
  return coalesce((
    select jsonb_agg(public.branch_summary(x.id, x.distance_m) order by x.distance_m nulls last, x.city, x.org, x.name)
    from (
      select b.id, b.name, b.city, o.name as org,
             case when v_point is not null and b.location is not null then extensions.st_distance(b.location, v_point) end as distance_m
      from public.branches b
      join public.organizations o on o.id = b.organization_id and o.status = 'active'
      join public.branch_settings bs on bs.branch_id = b.id and bs.public_listing_enabled
      where b.active
        and (v_point is null or (b.location is not null and extensions.st_dwithin(b.location, v_point, p_radius_km * 1000)))
        and (v_q is null or o.name ilike '%' || v_q || '%' or b.name ilike '%' || v_q || '%' or b.city ilike '%' || v_q || '%')
      order by distance_m nulls last, b.city, o.name, b.name
      limit 30
    ) x
  ), '[]'::jsonb);
end;
$$;

/** Page publique d'une agence (`/b/<agence>`) : résumé, horaires de la semaine, files en direct, options de distance. */
create or replace function public.branch_public(p_branch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.branch_summary(b.id, null) || jsonb_build_object(
    'phone_e164', b.phone_e164,
    'timezone', b.timezone,
    'organization', jsonb_build_object('name', o.name, 'type', o.type, 'default_locale', o.default_locale),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at)
        order by h.weekday, h.opens_at)
      from public.opening_hours h where h.branch_id = b.id
    ), '[]'::jsonb),
    'priorities_enabled', bs.priorities_enabled,
    'priority_service_ids', coalesce((
      select jsonb_agg(s.id) from public.services s where s.branch_id = b.id and s.active and s.allow_priority
    ), '[]'::jsonb),
    'remote', jsonb_build_object(
      'enabled', bs.remote_tickets_enabled,
      'service_ids', coalesce((
        select jsonb_agg(s.id) from public.services s where s.branch_id = b.id and s.active and s.allow_remote
      ), '[]'::jsonb),
      'max_distance_km', bs.remote_max_distance_km,
      'confirm_threshold', bs.remote_confirm_threshold,
      'penalty_places', bs.remote_penalty_places,
      'max_delays', bs.remote_max_delays
    ),
    'board', public.branch_board(b.id)
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id and o.status = 'active'
  join public.branch_settings bs on bs.branch_id = b.id and bs.public_listing_enabled
  where b.id = p_branch and b.active;
$$;

-- ─── Ticket à distance : prise, présence, trajet ─────────────────────────────

/** Trajet estimé : distance à vol d'oiseau × 1,3 (rues), à la vitesse moyenne de l'agence ; 2 minutes au moins. */
create or replace function public.remote_travel_seconds(p_distance_m double precision, p_kmh integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(120, round(p_distance_m * 1.3 / (p_kmh * 1000.0 / 3600)))::integer;
$$;

/**
 * Ticket pris à distance (serveur de l'application, service role : captcha et limitation faits en amont).
 * Position du client facultative, sauf si l'agence fixe une distance maximale ; elle sert au calcul du trajet,
 * puis est oubliée. Erreurs : `remote_not_allowed`, `location_required`, `too_far`, `active_ticket_exists`.
 */
create or replace function public.take_remote_ticket(
  p_service uuid,
  p_lat double precision,
  p_lng double precision,
  p_priority_reason public.priority_reason,
  p_customer uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.services;
  v_settings public.branch_settings;
  v_location extensions.geography;
  v_distance double precision;
  v_existing public.tickets;
  v_row public.tickets;
begin
  if p_customer is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'location_required' using errcode = 'P0422';
  end if;
  v_s := public.assert_can_issue(p_service, p_priority_reason, true);
  select * into v_settings from public.branch_settings where branch_id = v_s.branch_id;
  if not (v_settings.remote_tickets_enabled and v_s.allow_remote) then
    raise exception 'remote_not_allowed' using errcode = 'P0422';
  end if;
  select location into v_location from public.branches where id = v_s.branch_id;
  if p_lat is not null and v_location is not null then
    v_distance := extensions.st_distance(v_location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography);
  end if;
  if v_settings.remote_max_distance_km is not null then
    if v_distance is null then raise exception 'location_required' using errcode = 'P0422'; end if;
    if v_distance > v_settings.remote_max_distance_km * 1000 then raise exception 'too_far' using errcode = 'P0422'; end if;
  end if;

  select * into v_existing from public.tickets
  where customer_user_id = p_customer and branch_id = v_s.branch_id and status in ('waiting', 'called', 'serving')
  order by created_at desc limit 1;
  if found and (select count(*) from public.tickets where customer_user_id = p_customer and branch_id = v_s.branch_id
                and status in ('waiting', 'called', 'serving')) >= v_settings.max_active_tickets_per_customer then
    raise exception 'active_ticket_exists' using errcode = 'P0422', detail = v_existing.public_token;
  end if;

  v_row := public.insert_ticket(p_service, 'remote', p_priority_reason, p_customer, null);
  if v_distance is not null then
    update public.tickets set remote_travel_seconds = public.remote_travel_seconds(v_distance, v_settings.remote_travel_kmh)
    where id = v_row.id;
  end if;
  return jsonb_build_object('ticket_id', v_row.id, 'public_token', v_row.public_token, 'display_code', v_row.display_code);
end;
$$;

/** Vue client du ticket (M7) + coordonnées de l'agence (itinéraire) et état du ticket à distance. */
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
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address, 'city', b.city,
      'latitude', b.latitude, 'longitude', b.longitude),
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
    'created_at', t.created_at,
    'alerts', jsonb_build_object(
      'whatsapp', exists (select 1 from public.notification_contacts n where n.ticket_id = t.id and n.channel = 'whatsapp' and n.opted_out_at is null),
      'push', exists (select 1 from public.notification_contacts n where n.ticket_id = t.id and n.channel = 'push' and n.opted_out_at is null)
    ),
    'remote', case when t.is_remote then jsonb_build_object(
      'presence_confirmed_at', t.presence_confirmed_at,
      'on_my_way_at', t.on_my_way_at,
      'travel_seconds', t.remote_travel_seconds,
      'leave_margin_seconds', bs.remote_leave_margin_minutes * 60,
      'delay_count', t.delay_count,
      'max_delays', bs.remote_max_delays,
      'confirm_threshold', bs.remote_confirm_threshold,
      'penalty_places', bs.remote_penalty_places,
      'cancelled_for_absence', t.status = 'cancelled' and exists (
        select 1 from public.ticket_events e where e.ticket_id = t.id and e.type = 'cancelled' and e.payload ->> 'reason' = 'remote_no_presence')
    ) end
  )
  from public.tickets t
  join public.services s on s.id = t.service_id
  join public.branches b on b.id = t.branch_id
  join public.organizations o on o.id = t.organization_id
  join public.branch_settings bs on bs.branch_id = t.branch_id
  left join public.counters c on c.id = t.counter_id
  where t.id = p_ticket;
$$;

/** Ticket à distance d'un client, verrouillé, par le jeton de son lien. */
create or replace function public.lock_remote_ticket(p_token text)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9]{22}$' then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.check_rate_limit('remote_ticket:' || p_token, 30, interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  select * into v_row from public.tickets where public_token = p_token for update;
  if not found or not v_row.is_remote then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_row.status not in ('waiting', 'called') then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  return v_row;
end;
$$;

/**
 * Confirmation de présence : le client scanne le QR code de l'agence (ou saisit son code court) avec le téléphone
 * qui a pris le ticket. Idempotent. Erreur `invalid_entry` si le code n'est pas celui de l'agence.
 */
create or replace function public.confirm_presence(p_token text, p_entry_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  v_row := public.lock_remote_ticket(p_token);
  if not exists (
    select 1 from public.qr_codes q
    where q.branch_id = v_row.branch_id and q.active
      and (q.token = p_entry_code or q.short_code = upper(trim(coalesce(p_entry_code, ''))))
  ) then
    raise exception 'invalid_entry' using errcode = 'P0422';
  end if;
  if v_row.presence_confirmed_at is null then
    update public.tickets set presence_confirmed_at = now() where id = v_row.id returning * into v_row;
    perform public.log_ticket_event(v_row, 'presence_confirmed', jsonb_build_object('by', 'scan'));
  end if;
  return public.ticket_view(v_row.id);
end;
$$;

/** « Je suis en route » : indication pour l'accueil, une seule fois. */
create or replace function public.signal_on_my_way(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  v_row := public.lock_remote_ticket(p_token);
  if v_row.on_my_way_at is null and v_row.presence_confirmed_at is null then
    update public.tickets set on_my_way_at = now() where id = v_row.id returning * into v_row;
    perform public.log_ticket_event(v_row, 'on_my_way');
  end if;
  return public.ticket_view(v_row.id);
end;
$$;

/** Trajet saisi par le client (« Mon trajet : 30 min »), 1 à 240 minutes. */
create or replace function public.set_remote_travel(p_token text, p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  if p_minutes not between 1 and 240 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  v_row := public.lock_remote_ticket(p_token);
  update public.tickets set remote_travel_seconds = p_minutes * 60 where id = v_row.id;
  return public.ticket_view(v_row.id);
end;
$$;

/** Présence confirmée par l'accueil (patient arrivé sans pouvoir scanner). */
create or replace function public.staff_confirm_presence(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
begin
  v_row := public.lock_staff_ticket(p_ticket, array['waiting', 'called']::public.ticket_status[]);
  if not v_row.is_remote then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  if v_row.presence_confirmed_at is null then
    update public.tickets set presence_confirmed_at = now() where id = v_row.id returning * into v_row;
    perform public.log_ticket_event(v_row, 'presence_confirmed', jsonb_build_object('by', 'staff'));
    perform public.audit(v_row.organization_id, 'ticket.presence_confirm', 'ticket', v_row.id, '{}'::jsonb);
  end if;
  return public.staff_ticket_json(v_row);
end;
$$;

-- ─── Recul puis annulation sans confirmation de présence ─────────────────────

/** Recul de N places derrière les tickets de même priorité (même calcul que `move_back_ticket`, sans contrôle de droits). */
create or replace function public.shift_ticket_back(p_row public.tickets, p_places integer)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets := p_row;
  v_keys bigint[];
  v_target bigint;
  v_next bigint;
begin
  select array_agg(k order by k) into v_keys from (
    select o.sort_key as k
    from public.tickets o
    where o.service_id = p_row.service_id and o.status = 'waiting' and o.id <> p_row.id
      and o.priority_level = p_row.priority_level
      and (o.sort_key, o.number) > (p_row.sort_key, p_row.number)
    order by o.sort_key, o.number
    limit p_places + 1
  ) after_me;
  v_target := v_keys[least(p_places, coalesce(array_length(v_keys, 1), 0))];
  v_next := case when array_length(v_keys, 1) > p_places then v_keys[p_places + 1] end;
  if v_target is not null then
    update public.tickets
    set sort_key = case when v_next is null then v_target + 1 else v_target + greatest(1, (v_next - v_target) / 2) end
    where id = p_row.id returning * into v_row;
  end if;
  return v_row;
end;
$$;

/**
 * Ticket à distance non confirmé arrivé en tête alors qu'un autre patient attend : il recule de
 * `remote_penalty_places` places ; au `remote_max_delays`-ième retard, il est annulé. Chaque étape prévient le client.
 */
create or replace function public.penalize_remote_ticket(p_row public.tickets)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bs public.branch_settings;
  v_row public.tickets;
begin
  select * into v_bs from public.branch_settings where branch_id = p_row.branch_id;
  update public.tickets set delay_count = delay_count + 1 where id = p_row.id returning * into v_row;
  if v_row.delay_count >= v_bs.remote_max_delays then
    update public.tickets set status = 'cancelled', finished_at = now() where id = v_row.id returning * into v_row;
    perform public.log_ticket_event(v_row, 'cancelled', jsonb_build_object('reason', 'remote_no_presence', 'delay', v_row.delay_count));
    perform public.enqueue_ticket_notification(v_row.id, 'remote_cancelled', 'remote_cancelled:' || v_row.id);
  else
    v_row := public.shift_ticket_back(v_row, v_bs.remote_penalty_places);
    perform public.log_ticket_event(v_row, 'moved_back',
      jsonb_build_object('places', v_bs.remote_penalty_places, 'reason', 'remote_no_presence', 'delay', v_row.delay_count));
  end if;
end;
$$;

/**
 * Prochain ticket d'un poste (M5b) avec la règle du ticket à distance : un ticket à distance non confirmé n'est
 * jamais appelé. S'il est le prochain alors qu'un autre patient attend, il est pénalisé (recul ou annulation) ;
 * s'il est seul, il garde sa place sans pénalité (personne n'est passé devant).
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
  -- Chaque ticket écarté (pris par un autre poste, ou à distance non confirmé) l'est une fois : la boucle se termine.
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
          or (pc.status <> 'open' and public.practitioner_late_until(pc.default_practitioner_id) is null)
        )
      order by rn
      limit 50
    ) x;
    v_pick := public.fair_pick(v_candidates, v_bs.appointment_mode, v_bs.appointment_walkin_ratio,
      v_bs.appointment_early_minutes, public.walkins_since_appointment(p_counter, v_day), now())::uuid;
    if v_pick is null then return null; end if;
    select * into v_next from public.tickets where id = v_pick and status = 'waiting' for update skip locked;
    if found and v_next.is_remote and v_next.presence_confirmed_at is null then
      if jsonb_array_length(v_candidates) > 1 then
        perform public.penalize_remote_ticket(v_next);
      end if;
      v_skip := v_skip || v_pick;
      continue;
    end if;
    if found then return v_next; end if;
    v_skip := v_skip || v_pick;
  end loop;
end;
$$;

-- ─── Messages du ticket à distance ───────────────────────────────────────────

/** « Bientôt votre tour » (M7), sauf pour un ticket à distance non confirmé : il reçoit « confirmez votre présence ». */
create or replace function public.enqueue_almost_your_turn(p_service uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket record;
begin
  for v_ticket in
    select distinct t.id
    from public.tickets t
    join public.notification_contacts c on c.ticket_id = t.id and c.opted_out_at is null
    join public.branch_settings bs on bs.branch_id = t.branch_id
    where t.service_id = p_service and t.status = 'waiting'
      and not (t.is_remote and t.presence_confirmed_at is null)
      and public.ticket_position(t.id) - 1 <= bs.almost_turn_threshold
  loop
    perform public.enqueue_ticket_notification(v_ticket.id, 'almost_your_turn', 'almost:' || v_ticket.id);
  end loop;
end;
$$;

/**
 * Tickets à distance suivis (contact actif) et non confirmés d'un service, ou de toutes les agences (`p_service` nul) :
 * « il est temps de partir » quand l'attente ne couvre plus le trajet et la marge ; « confirmez votre présence » à
 * `remote_confirm_threshold` places (une fois par recul).
 */
create or replace function public.enqueue_remote_notices(p_service uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket record;
  v_count integer := 0;
begin
  for v_ticket in
    select t.id, t.delay_count, t.remote_travel_seconds, t.on_my_way_at,
           bs.remote_leave_margin_minutes, bs.remote_confirm_threshold
    from public.tickets t
    join public.branch_settings bs on bs.branch_id = t.branch_id
    where t.is_remote and t.status = 'waiting' and t.presence_confirmed_at is null
      and (p_service is null or t.service_id = p_service)
      and exists (select 1 from public.notification_contacts c where c.ticket_id = t.id and c.opted_out_at is null)
  loop
    if v_ticket.on_my_way_at is null and v_ticket.remote_travel_seconds is not null
       and public.ticket_wait_seconds(v_ticket.id) - v_ticket.remote_travel_seconds - v_ticket.remote_leave_margin_minutes * 60 <= 0 then
      v_count := v_count + public.enqueue_ticket_notification(v_ticket.id, 'time_to_leave', 'leave:' || v_ticket.id);
    end if;
    if public.ticket_position(v_ticket.id) - 1 <= v_ticket.remote_confirm_threshold then
      v_count := v_count + public.enqueue_ticket_notification(v_ticket.id, 'presence_reminder',
        'presence:' || v_ticket.id || ':' || v_ticket.delay_count);
    end if;
  end loop;
  return v_count;
end;
$$;

/** Événements de ticket → messages (M7) ; contrôle « bientôt votre tour » et messages du ticket à distance. */
create or replace function public.ticket_events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = new.ticket_id;
  if not found then return null; end if;
  if not exists (select 1 from public.notification_contacts c where c.branch_id = v_ticket.branch_id) then
    return null;
  end if;
  case new.type
    when 'called' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'your_turn', 'your_turn:' || v_ticket.id || ':0');
    when 'recalled' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'your_turn', 'your_turn:' || v_ticket.id || ':' || v_ticket.recall_count);
    when 'moved_back' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'ticket_moved_back', 'moved_back:' || new.id);
    when 'rerouted' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'practitioner_rerouted', 'rerouted:' || new.id);
    else
      null;
  end case;
  perform public.enqueue_almost_your_turn(v_ticket.service_id);
  perform public.enqueue_remote_notices(v_ticket.service_id);
  return null;
end;
$$;

/** Tâche (chaque minute) : l'attente baisse aussi sans mouvement de file (temps qui passe) → « il est temps de partir ». */
create or replace function public.sweep_remote_tickets()
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.enqueue_remote_notices(null);
$$;
select cron.schedule('nextin-sweep-remote-tickets', '* * * * *', $$select public.sweep_remote_tickets()$$);

-- ─── Demandes de rendez-vous ─────────────────────────────────────────────────

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  service_id uuid not null,
  -- Null : « peu importe le praticien ».
  practitioner_id uuid,
  -- Créneau précis choisi parmi les créneaux libres, ou jour + moment de la journée.
  preferred_starts_at timestamptz,
  preferred_day date,
  preferred_period text check (preferred_period in ('morning', 'afternoon', 'any')),
  -- Repère facultatif pour l'accueil (initiales) : jamais annoncé, affiché sur TV ni envoyé.
  customer_label text check (char_length(customer_label) between 1 and 40),
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  public_token text not null unique check (public_token ~ '^[A-Za-z0-9]{22}$'),
  customer_user_id uuid references auth.users (id) on delete set null,
  status public.appointment_request_status not null default 'unverified',
  -- Code de vérification du numéro : empreinte seulement (SHA-256 du code et de l'identifiant).
  code_hash text,
  code_expires_at timestamptz,
  code_attempts smallint not null default 0,
  codes_sent smallint not null default 0,
  verified_at timestamptz,
  appointment_id uuid,
  decline_reason text check (char_length(decline_reason) <= 200),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_starts_at is not null or preferred_day is not null),
  unique (organization_id, id),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete cascade,
  foreign key (organization_id, practitioner_id) references public.practitioners (organization_id, id) on delete cascade,
  foreign key (organization_id, appointment_id) references public.appointments (organization_id, id) on delete set null (appointment_id)
);
create index appointment_requests_branch_idx on public.appointment_requests (branch_id, status, created_at);
-- Une seule demande en attente par numéro et par agence.
create unique index appointment_requests_open_uidx on public.appointment_requests (branch_id, phone_e164)
  where status = 'pending';
create trigger appointment_requests_set_updated_at before update on public.appointment_requests
  for each row execute function public.set_updated_at();

-- Contacts et messages rattachés à une demande (code de vérification, refus).
alter table public.notification_contacts add column appointment_request_id uuid;
alter table public.notification_contacts drop constraint notification_contacts_subject_check;
alter table public.notification_contacts drop constraint notification_contacts_consent_source_check;
alter table public.notification_contacts
  add constraint notification_contacts_request_fkey
    foreign key (organization_id, appointment_request_id) references public.appointment_requests (organization_id, id) on delete cascade,
  add constraint notification_contacts_subject_check
    check (ticket_id is not null or appointment_id is not null or appointment_request_id is not null),
  add constraint notification_contacts_consent_source_check
    check (consent_source in ('customer_optin', 'reception_with_consent', 'patient_request'));
create unique index notification_contacts_request_uidx on public.notification_contacts (appointment_request_id)
  where appointment_request_id is not null and appointment_id is null and ticket_id is null;

alter table public.notification_jobs add column appointment_request_id uuid;
alter table public.notification_jobs drop constraint notification_jobs_subject_check;
alter table public.notification_jobs
  add constraint notification_jobs_request_fkey
    foreign key (organization_id, appointment_request_id) references public.appointment_requests (organization_id, id) on delete cascade,
  add constraint notification_jobs_subject_check
    check (ticket_id is not null or appointment_id is not null or appointment_request_id is not null);
create index notification_jobs_request_idx on public.notification_jobs (appointment_request_id) where appointment_request_id is not null;

/** Agence ouverte aux demandes de rendez-vous (option activée, organisation et agence actives). */
create or replace function public.assert_requests_open(p_branch uuid)
returns public.branch_settings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bs public.branch_settings;
begin
  select bs.* into v_bs
  from public.branch_settings bs
  join public.branches b on b.id = bs.branch_id and b.active
  join public.organizations o on o.id = b.organization_id and o.status = 'active'
  where bs.branch_id = p_branch;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not v_bs.appointment_requests_enabled then raise exception 'requests_disabled' using errcode = 'P0422'; end if;
  return v_bs;
end;
$$;

/**
 * Formulaire de demande (public) : services avec des praticiens qui ont des horaires, ces praticiens, et les
 * créneaux libres des `appointment_request_days` prochains jours (heures seulement, aucune donnée de patient).
 */
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

/** Numéro de la demande, masqué (« +237 6•• •• •• 12 »). */
create or replace function public.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_phone is null then null
              else substr(p_phone, 1, 5) || '•• •• •• ' || right(p_phone, 2) end;
$$;

/** Vue publique d'une demande (`/r/<jeton>`) : aucune donnée personnelle hors numéro masqué. */
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

/** Codes de vérification encore lisibles dans la file d'envoi d'une demande : effacés. */
create or replace function public.clear_request_codes(p_request uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_jobs set payload = payload - 'code'
  where appointment_request_id = p_request and event = 'request_code' and payload ? 'code';
$$;

/** Nouveau code à 6 chiffres (10 minutes), envoyé par WhatsApp (SMS en secours). 3 codes au plus par demande. */
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
  select c.organization_id, c.branch_id, v_r.id, c.id, 'request_code', 'whatsapp', 'request_code:' || v_r.id || ':' || (v_r.codes_sent + 1),
         jsonb_build_object('code', v_code)
  from public.notification_contacts c
  where c.appointment_request_id = v_r.id and c.appointment_id is null and c.ticket_id is null;
  perform public.kick_notification_dispatch();
end;
$$;

/**
 * Demande de rendez-vous d'un patient (serveur de l'application, service role : captcha et limitation par IP en amont).
 * Créneau précis libre (praticien choisi ou n'importe lequel du service), ou jour + moment dans les jours ouverts.
 * La demande n'est visible de l'accueil qu'après vérification du numéro par code. Erreurs : `requests_disabled`,
 * `slot_unavailable`, `phone_invalid`, `request_exists`, `rate_limited`.
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
  if exists (select 1 from public.appointment_requests where branch_id = p_branch and phone_e164 = p_phone_e164 and status = 'pending') then
    raise exception 'request_exists' using errcode = 'P0409';
  end if;
  -- Une demande non vérifiée du même numéro est remplacée.
  update public.appointment_requests set status = 'cancelled', code_hash = null
  where branch_id = p_branch and phone_e164 = p_phone_e164 and status = 'unverified';

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

/** Demande d'un patient par le jeton de son lien, verrouillée. */
create or replace function public.lock_request_by_token(p_token text)
returns public.appointment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9]{22}$' then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_r from public.appointment_requests where public_token = p_token for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  return v_r;
end;
$$;

/** Nouveau code (serveur de l'application, après captcha). */
create or replace function public.resend_request_code(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
begin
  v_r := public.lock_request_by_token(p_token);
  perform public.issue_request_code(v_r.id);
  return public.request_view(v_r.id);
end;
$$;

/**
 * Vérification du numéro : 5 essais par code, code valable 10 minutes. La demande passe « en attente » et l'accueil
 * est prévenu en direct. Erreurs : `code_invalid`, `code_expired` (nouveau code nécessaire), `request_exists`.
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
  if exists (select 1 from public.appointment_requests where branch_id = v_r.branch_id and phone_e164 = v_r.phone_e164
             and status = 'pending' and id <> v_r.id) then
    raise exception 'request_exists' using errcode = 'P0409';
  end if;
  update public.appointment_requests set status = 'pending', verified_at = now(), code_hash = null where id = v_r.id;
  perform public.clear_request_codes(v_r.id);
  perform public.broadcast('staff:branch:' || v_r.branch_id, 'requests', jsonb_build_object('id', v_r.id, 'status', 'pending'), true);
  return public.request_view(v_r.id);
end;
$$;

/** Lecture publique d'une demande par son lien. */
create or replace function public.get_appointment_request(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.request_view(r.id) from public.appointment_requests r
  where p_token ~ '^[A-Za-z0-9]{22}$' and r.public_token = p_token;
$$;

/** Le patient retire sa demande (non vérifiée ou en attente). */
create or replace function public.cancel_my_appointment_request(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
begin
  v_r := public.lock_request_by_token(p_token);
  if v_r.status not in ('unverified', 'pending') then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  update public.appointment_requests set status = 'cancelled', code_hash = null where id = v_r.id;
  update public.notification_jobs set status = 'cancelled', error = 'request_cancelled'
  where appointment_request_id = v_r.id and status = 'pending';
  perform public.clear_request_codes(v_r.id);
  if v_r.status = 'pending' then
    perform public.broadcast('staff:branch:' || v_r.branch_id, 'requests', jsonb_build_object('id', v_r.id, 'status', 'cancelled'), true);
  end if;
  return public.request_view(v_r.id);
end;
$$;

/** Vue d'une demande pour l'accueil (numéro en clair : le personnel peut rappeler le patient). */
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
    'practitioner_id', r.practitioner_id,
    'appointment_id', r.appointment_id,
    'handled_at', r.handled_at,
    'verified_at', r.verified_at
  )
  from public.appointment_requests r where r.id = p_request;
$$;

/** Demandes d'une agence (personnel) : en attente par défaut, ou traitées des 14 derniers jours. */
create or replace function public.list_appointment_requests(p_branch uuid, p_pending boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_branch_staff(p_branch);
  return coalesce((
    select jsonb_agg(public.request_staff_json(r.id) order by
      case when p_pending then coalesce(r.preferred_starts_at, r.preferred_day::timestamptz) end, r.created_at desc)
    from public.appointment_requests r
    where r.branch_id = p_branch
      and case when p_pending then r.status = 'pending'
               else r.status in ('accepted', 'modified', 'declined', 'expired', 'cancelled') and r.verified_at is not null
                    and r.updated_at > now() - interval '14 days' end
  ), '[]'::jsonb);
end;
$$;

/** Demande en attente d'une agence du personnel connecté, verrouillée. */
create or replace function public.lock_pending_request(p_request uuid)
returns public.appointment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
begin
  select * into v_r from public.appointment_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_r.branch_id);
  if v_r.status <> 'pending' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  return v_r;
end;
$$;

/**
 * Confirmation d'une demande par l'accueil, en un clic : crée le rendez-vous sur le créneau choisi (celui demandé,
 * ou un autre : la demande est alors « modifiée ») avec le numéro vérifié ; le patient reçoit la réponse sur WhatsApp,
 * puis les rappels habituels. Erreur `slot_unavailable` si le créneau vient d'être pris.
 */
create or replace function public.accept_appointment_request(p_request uuid, p_practitioner uuid, p_starts_at timestamptz)
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
      customer_label, phone_e164, locale, booked_by)
    values (v_r.organization_id, v_r.branch_id, p_practitioner, v_slot.service_id, v_slot.starts_at, v_slot.ends_at,
      v_r.customer_label, v_r.phone_e164, v_r.locale, (select auth.uid()))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0409';
  end;
  insert into public.notification_contacts (organization_id, branch_id, appointment_id, appointment_request_id, channel,
    phone_e164, locale, consent_source, consent_at, consent_by)
  values (v_r.organization_id, v_r.branch_id, v_id, v_r.id, 'whatsapp', v_r.phone_e164, v_r.locale, 'patient_request', now(),
    (select auth.uid()));
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

/** Refus d'une demande, avec un motif court envoyé au patient. */
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
  select c.organization_id, c.branch_id, v_r.id, c.id, 'request_declined', 'whatsapp', 'request_declined:' || v_r.id
  from public.notification_contacts c
  where c.appointment_request_id = v_r.id and c.appointment_id is null and c.ticket_id is null and c.opted_out_at is null
  on conflict (dedupe_key) do nothing;
  perform public.kick_notification_dispatch();
  perform public.audit(v_r.organization_id, 'appointment_request.decline', 'appointment_request', v_r.id, '{}'::jsonb);
  perform public.broadcast('staff:branch:' || v_r.branch_id, 'requests', jsonb_build_object('id', v_r.id, 'status', 'handled'), true);
  return public.request_staff_json(v_r.id);
end;
$$;

/** Tâche (5 min) : demandes dont le créneau ou le jour est passé → expirées ; non vérifiées depuis 1 jour → annulées. */
create or replace function public.sweep_appointment_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.appointment_requests r set status = 'expired', code_hash = null
  from public.branches b
  where b.id = r.branch_id and r.status = 'pending'
    and (r.preferred_starts_at < now() or r.preferred_day < (now() at time zone b.timezone)::date);
  get diagnostics v_count = row_count;
  update public.appointment_requests set status = 'cancelled', code_hash = null
  where status = 'unverified' and created_at < now() - interval '1 day';
  -- Codes échus (10 minutes) : effacés de la file d'envoi.
  update public.notification_jobs j set payload = j.payload - 'code'
  from public.appointment_requests r
  where r.id = j.appointment_request_id and j.event = 'request_code' and j.payload ? 'code'
    and (r.status <> 'unverified' or r.code_expires_at < now());
  return v_count;
end;
$$;
select cron.schedule('nextin-sweep-appointment-requests', '*/5 * * * *', $$select public.sweep_appointment_requests()$$);

-- ─── Expéditeur : messages des demandes ──────────────────────────────────────

/** Données d'une demande pour un message (établissement, service, praticien, jour souhaité, motif de refus). */
create or replace function public.request_notification_view(p_request uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'token', r.public_token,
    'service', s.name,
    'branch', b.name,
    'organization', o.name,
    'timezone', b.timezone,
    'preferred_starts_at', r.preferred_starts_at,
    'preferred_day', r.preferred_day,
    'decline_reason', r.decline_reason
  )
  from public.appointment_requests r
  join public.services s on s.id = r.service_id
  join public.branches b on b.id = r.branch_id
  join public.organizations o on o.id = r.organization_id
  where r.id = p_request;
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

create or replace function public.schedule_sms_fallback(p_job uuid, p_delay_seconds integer default 0, p_guard boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notification_jobs (organization_id, branch_id, ticket_id, appointment_id, appointment_request_id, contact_id,
    event, channel, dedupe_key, next_attempt_at, fallback_of, guard, payload)
  select j.organization_id, j.branch_id, j.ticket_id, j.appointment_id, j.appointment_request_id, j.contact_id, j.event, 'sms',
         'sms:' || j.id, now() + make_interval(secs => greatest(p_delay_seconds, 0)), j.id, p_guard,
         -- Code de vérification : le SMS de secours reprend le code du job WhatsApp (effacé après vérification).
         case when j.event = 'request_code' and j.payload ? 'code' then jsonb_build_object('code', j.payload -> 'code')
         else '{}'::jsonb end
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

-- ─── Purge : demandes de rendez-vous ─────────────────────────────────────────

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
  update public.appointments a set phone_e164 = null, customer_label = null
  from public.organizations o
  where o.id = a.organization_id and a.starts_at < now() - make_interval(days => o.data_retention_days)
    and (a.phone_e164 is not null or a.customer_label is not null);
  update public.appointment_requests r set phone_e164 = null, customer_label = null, customer_user_id = null, code_hash = null
  from public.organizations o
  where o.id = r.organization_id and r.created_at < now() - make_interval(days => o.data_retention_days)
    and (r.phone_e164 is not null or r.customer_label is not null or r.customer_user_id is not null);
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
  public.branch_summary(uuid, double precision), public.nearby_branches(double precision, double precision, double precision, text),
  public.branch_public(uuid), public.remote_travel_seconds(double precision, integer),
  public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid),
  public.lock_remote_ticket(text), public.confirm_presence(text, text), public.signal_on_my_way(text),
  public.set_remote_travel(text, integer), public.staff_confirm_presence(uuid), public.shift_ticket_back(public.tickets, integer),
  public.penalize_remote_ticket(public.tickets), public.enqueue_remote_notices(uuid), public.sweep_remote_tickets(),
  public.assert_requests_open(uuid), public.request_options(uuid), public.mask_phone(text), public.request_view(uuid),
  public.issue_request_code(uuid), public.clear_request_codes(uuid),
  public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid),
  public.lock_request_by_token(text), public.resend_request_code(text), public.verify_appointment_request(text, text),
  public.get_appointment_request(text), public.cancel_my_appointment_request(text), public.request_staff_json(uuid),
  public.list_appointment_requests(uuid, boolean), public.lock_pending_request(uuid),
  public.accept_appointment_request(uuid, uuid, timestamptz), public.decline_appointment_request(uuid, text),
  public.sweep_appointment_requests(), public.request_notification_view(uuid)
from public, anon, authenticated;

-- Surface publique (pages client, sans compte) : lecture et commandes protégées par le jeton secret du lien.
grant execute on function
  public.nearby_branches(double precision, double precision, double precision, text), public.branch_public(uuid),
  public.confirm_presence(text, text), public.signal_on_my_way(text), public.set_remote_travel(text, integer),
  public.request_options(uuid), public.verify_appointment_request(text, text), public.get_appointment_request(text),
  public.cancel_my_appointment_request(text)
to anon, authenticated;
-- Personnel (droits vérifiés dans chaque fonction).
grant execute on function
  public.staff_confirm_presence(uuid), public.list_appointment_requests(uuid, boolean),
  public.accept_appointment_request(uuid, uuid, timestamptz), public.decline_appointment_request(uuid, text)
to authenticated;
-- Serveur de l'application (captcha et limitation par IP vérifiés avant l'appel).
grant execute on function
  public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid),
  public.create_appointment_request(uuid, uuid, uuid, timestamptz, date, text, text, text, text, uuid),
  public.resend_request_code(text)
to service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.appointment_requests enable row level security;
revoke all on public.appointment_requests from anon;
revoke insert, update, delete, truncate on public.appointment_requests from authenticated;
-- Lecture par le personnel de l'agence (demandes vérifiées seulement) ; écritures uniquement par RPC.
create policy appointment_requests_select on public.appointment_requests for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) and not public.is_anonymous() and status <> 'unverified');
