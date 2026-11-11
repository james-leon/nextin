-- Page « Mon ticket » : état d'ouverture connu du client (agence fermée, aucun poste ouvert pour le service),
-- pour ne jamais annoncer « D'un instant à l'autre » quand personne ne peut appeler. Ajoute à `ticket_view` :
-- `branch.is_open`, `branch.timezone`, `branch.hours` (horaires publics, comme `branch_public`) et
-- `service.open` (au moins un poste ouvert sert le service, même règle que `branch_board`) + `service.counter_kind`
-- (type de poste du service, pour « Aucun cabinet ouvert » / « Aucun guichet ouvert »). Aucune donnée personnelle.

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
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color,
      'open', exists (
        select 1 from public.counter_services cs join public.counters c2 on c2.id = cs.counter_id
        where cs.service_id = s.id and c2.status = 'open' and c2.active
      ),
      'counter_kind', (
        select c2.kind from public.counter_services cs join public.counters c2 on c2.id = cs.counter_id
        where cs.service_id = s.id and c2.active
        group by c2.kind order by count(*) desc, c2.kind limit 1
      )),
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address, 'city', b.city,
      'latitude', b.latitude, 'longitude', b.longitude,
      'is_open', public.branch_is_open(b.id),
      'timezone', b.timezone,
      'hours', coalesce((
        select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at)
          order by h.weekday, h.opens_at)
        from public.opening_hours h where h.branch_id = b.id
      ), '[]'::jsonb)),
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
