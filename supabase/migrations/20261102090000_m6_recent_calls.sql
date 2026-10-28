-- M6 (correctif) — Derniers appels de l'écran TV.
-- `branch_board.calls` ne contenait que les tickets `called` / `serving` : dès qu'un ticket était terminé, il
-- disparaissait, et les tuiles « derniers appels » restaient vides avec un seul poste.
-- Désormais : appels du jour, y compris terminés (`served`, `no_show`, `transferred`), triés par dernier appel,
-- 12 au plus. Les appels terminés ne sont gardés que 30 minutes ; un appel en cours reste toujours affiché.
-- Confidentialité inchangée : numéro, service et poste uniquement.

create or replace function public.branch_board(p_branch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with day as (select public.branch_service_day(p_branch) as d),
  svc as (
    select s.*
    from public.services s
    where s.branch_id = p_branch and s.active
  ),
  services_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'prefix', s.prefix,
        'name', s.name,
        'name_en', s.name_en,
        'color', s.color,
        'open', exists (
          select 1 from public.counter_services cs join public.counters c on c.id = cs.counter_id
          where cs.service_id = s.id and c.status = 'open' and c.active
        ),
        'waiting', coalesce((
          select jsonb_agg(t.display_code order by t.priority_level desc, t.sort_key, t.number)
          from public.tickets t
          where t.service_id = s.id and t.status = 'waiting' and t.service_day = (select d from day)
        ), '[]'::jsonb),
        'counters', coalesce((
          select jsonb_agg(jsonb_build_object(
            'counter_id', l.counter_id,
            'duration_seconds', round(l.duration_seconds),
            'busy_remaining_seconds', round(l.busy_remaining_seconds)))
          from public.service_counter_loads(s.id) l
        ), '[]'::jsonb),
        'wait_seconds', coalesce((
          select public.estimate_wait_seconds(
            (select count(*)::integer from public.tickets t
             where t.service_id = s.id and t.status = 'waiting' and t.service_day = (select d from day)),
            array_agg(l.duration_seconds), array_agg(l.busy_remaining_seconds))
          from public.service_counter_loads(s.id) l
        ), 0)
      ) order by s.sort_order, s.prefix), '[]'::jsonb) as v
    from svc s
  ),
  calls_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', x.display_code,
      'service_id', x.service_id,
      'status', x.status,
      'counter_kind', x.kind,
      'counter_number', x.number,
      'counter_label', x.label,
      'called_at', x.last_called_at,
      'recall_count', x.recall_count
    ) order by x.last_called_at desc), '[]'::jsonb) as v
    from (
      select t.display_code, t.service_id, t.status, c.kind, c.number, c.label, t.recall_count,
             greatest(t.called_at, coalesce(t.recalled_at, t.called_at)) as last_called_at
      from public.tickets t
      join public.counters c on c.id = t.counter_id
      where t.branch_id = p_branch
        and t.service_day = (select d from day)
        and t.called_at is not null
        and (
          t.status in ('called', 'serving')
          or (t.status in ('served', 'no_show', 'transferred')
              and greatest(t.called_at, coalesce(t.recalled_at, t.called_at)) > now() - interval '30 minutes')
        )
      order by last_called_at desc
      limit 12
    ) x
  )
  select jsonb_build_object(
    'branch_id', p_branch,
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'services', (select v from services_json),
    'calls', (select v from calls_json)
  );
$$;
