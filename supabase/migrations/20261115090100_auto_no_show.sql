-- Absent automatique après l'appel (docs/modules/ABSENCE-AUTO.md).
-- Un ticket appelé et non admis dans `no_show_grace_seconds` est replacé de `no_show_move_back_places` places
-- (premier appel manqué) puis annulé comme absent (deuxième) ; le client est prévenu et le poste appelle le suivant.
-- Rien avant l'appel ; le ticket à distance garde ses propres règles (M9). Aucun travail ajouté à l'accueil.

-- ─── Réglages d'agence ───────────────────────────────────────────────────────

alter table public.branch_settings
  add column auto_no_show_enabled boolean not null default true,
  -- Délai entre l'appel (ou le dernier rappel) et l'absence automatique.
  add column no_show_grace_seconds smallint not null default 180 check (no_show_grace_seconds between 30 and 1800),
  -- Recul au premier appel manqué.
  add column no_show_move_back_places smallint not null default 3 check (no_show_move_back_places between 1 and 20);

-- ─── Tickets ─────────────────────────────────────────────────────────────────

alter table public.tickets
  add column missed_calls smallint not null default 0 check (missed_calls between 0 and 2);

-- Recherche des appels en cours par la tâche (quelques lignes à la fois).
create index tickets_called_at_idx on public.tickets (called_at) where status = 'called';

alter table public.ticket_events drop constraint ticket_events_type_check;
alter table public.ticket_events add constraint ticket_events_type_check check (type in (
  'created', 'called', 'recalled', 'admitted', 'served', 'no_show', 'cancelled', 'transferred',
  'moved_back', 'priority_changed', 'expired', 'rated', 'rerouted', 'presence_confirmed', 'on_my_way',
  'missed_call'
));

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
    -- Appels manqués (absent automatique) : 1 = replacé dans la file, 2 = annulé.
    'missed_calls', t.missed_calls,
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

-- ─── Appel manqué ────────────────────────────────────────────────────────────

/**
 * Traite un ticket appelé dont le délai est écoulé (sans contrôle de droits : appelé par la tâche seulement).
 * 1er appel manqué → retour en attente, recul de N places, événement `missed_call` (message au client).
 * 2e appel manqué → absent définitif (`no_show`, payload `auto`) avec message.
 * Puis, si le poste est ouvert, libre et pas verrouillé par l'agent, il appelle le suivant.
 * Renvoie `moved_back`, `no_show` ou null (rien à faire).
 */
create or replace function public.handle_missed_call(p_ticket uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
  v_log public.tickets;
  v_bs public.branch_settings;
  v_counter uuid;
  v_counter_row public.counters;
  v_next public.tickets;
  v_result text;
begin
  select * into v_row from public.tickets where id = p_ticket for update skip locked;
  -- Ticket admis, terminé, en cours de traitement par l'agent ou ticket à distance : rien.
  if not found or v_row.status <> 'called' or v_row.is_remote then return null; end if;
  select * into v_bs from public.branch_settings where branch_id = v_row.branch_id;
  if not coalesce(v_bs.auto_no_show_enabled, false)
     or greatest(v_row.called_at, coalesce(v_row.recalled_at, v_row.called_at))
        > now() - make_interval(secs => v_bs.no_show_grace_seconds) then
    return null;
  end if;
  v_counter := v_row.counter_id;

  if v_row.missed_calls >= 1 then
    update public.tickets set status = 'no_show', finished_at = now(), missed_calls = 2
    where id = v_row.id returning * into v_row;
    perform public.log_ticket_event(v_row, 'no_show', jsonb_build_object('auto', true, 'missed_calls', 2));
    v_result := 'no_show';
  else
    update public.tickets set status = 'waiting', counter_id = null, recalled_at = null, missed_calls = 1
    where id = v_row.id returning * into v_row;
    v_row := public.shift_ticket_back(v_row, v_bs.no_show_move_back_places);
    -- L'événement garde le poste qui a appelé (statistiques), même si le ticket n'y est plus rattaché.
    v_log := v_row;
    v_log.counter_id := v_counter;
    perform public.log_ticket_event(v_log, 'missed_call',
      jsonb_build_object('auto', true, 'missed_calls', 1, 'places', v_bs.no_show_move_back_places));
    v_result := 'moved_back';
  end if;

  -- Le poste appelle le suivant : seulement s'il est ouvert, libre, et que l'agent n'est pas en train d'agir
  -- (verrou pris par lui → on n'attend pas, il appellera lui-même).
  if v_counter is not null then
    select * into v_counter_row from public.counters where id = v_counter for update skip locked;
    if found and v_counter_row.status = 'open' and v_counter_row.active
       and not exists (select 1 from public.tickets o where o.counter_id = v_counter and o.status in ('called', 'serving')) then
      v_next := public.pick_next_ticket(v_counter);
      -- Le ticket replacé n'est pas rappelé aussitôt s'il est seul dans la file : l'agent décide.
      if v_next.id is not null and v_next.id <> v_row.id then
        perform public.call_ticket_internal(v_counter, v_next);
      end if;
    end if;
  end if;
  return v_result;
end;
$$;

/** Tâche (toutes les 30 s) : appels du jour non admis dans le délai de leur agence. */
create or replace function public.sweep_missed_calls()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select t.id
    from public.tickets t
    join public.branch_settings bs on bs.branch_id = t.branch_id
    where t.status = 'called'
      and not t.is_remote
      and bs.auto_no_show_enabled
      and t.called_at <= now() - make_interval(secs => bs.no_show_grace_seconds)
      and greatest(t.called_at, coalesce(t.recalled_at, t.called_at)) <= now() - make_interval(secs => bs.no_show_grace_seconds)
      and t.service_day = public.branch_service_day(t.branch_id)
    order by t.called_at
    limit 500
  loop
    -- Une erreur sur un ticket n'empêche pas de traiter les autres.
    begin
      if public.handle_missed_call(v_id) is not null then v_count := v_count + 1; end if;
    exception when others then
      raise warning 'sweep_missed_calls %: %', v_id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;
select cron.schedule('nextin-sweep-missed-calls', '30 seconds', $$select public.sweep_missed_calls()$$);

-- ─── Messages ────────────────────────────────────────────────────────────────

/**
 * Événements de ticket → messages (M7). « C'est votre tour » est renvoyé au nouvel appel qui suit un appel manqué
 * (clé de déduplication distincte) ; appel manqué → « vous êtes replacé » ; absent automatique → « ticket annulé ».
 */
create or replace function public.ticket_events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
  v_round text;
begin
  select * into v_ticket from public.tickets where id = new.ticket_id;
  if not found then return null; end if;
  if not exists (select 1 from public.notification_contacts c where c.branch_id = v_ticket.branch_id) then
    return null;
  end if;
  v_round := case when v_ticket.missed_calls > 0 then ':m' || v_ticket.missed_calls else '' end;
  case new.type
    when 'called' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'your_turn', 'your_turn:' || v_ticket.id || ':0' || v_round);
    when 'recalled' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'your_turn', 'your_turn:' || v_ticket.id || ':' || v_ticket.recall_count || v_round);
    when 'moved_back' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'ticket_moved_back', 'moved_back:' || new.id);
    when 'rerouted' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'practitioner_rerouted', 'rerouted:' || new.id);
    when 'missed_call' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'missed_call', 'missed_call:' || v_ticket.id);
    when 'no_show' then
      if coalesce((new.payload ->> 'auto')::boolean, false) then
        perform public.enqueue_ticket_notification(v_ticket.id, 'missed_call_cancelled', 'missed_call_cancelled:' || v_ticket.id);
      end if;
    else
      null;
  end case;
  perform public.enqueue_almost_your_turn(v_ticket.service_id);
  perform public.enqueue_remote_notices(v_ticket.service_id);
  return null;
end;
$$;

-- ─── Droits ──────────────────────────────────────────────────────────────────

revoke execute on function public.handle_missed_call(uuid), public.sweep_missed_calls() from public, anon, authenticated;
