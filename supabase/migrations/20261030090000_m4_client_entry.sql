-- ═════════════════════════════════════════════════════════════════════════════
-- M4 — Parcours client : l'entrée (QR ou code court) indique aussi les services
-- qui acceptent l'accès prioritaire (interrupteur « Accès prioritaire » de l'écran 02).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.resolve_entry(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'entry_code', q.token,
    'source', case when q.token = p_code then 'qr' else 'short_code' end,
    'service_id', q.service_id,
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale, 'type', o.type),
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city, 'is_open', public.branch_is_open(b.id)),
    'priorities_enabled', bs.priorities_enabled,
    'priority_service_ids', coalesce((
      select jsonb_agg(s.id) from public.services s where s.branch_id = b.id and s.active and s.allow_priority
    ), '[]'::jsonb),
    'board', public.branch_board(b.id)
  )
  from public.qr_codes q
  join public.branches b on b.id = q.branch_id and b.active
  join public.organizations o on o.id = q.organization_id and o.status = 'active'
  join public.branch_settings bs on bs.branch_id = b.id
  where q.active and (q.token = p_code or q.short_code = upper(trim(p_code)))
  limit 1;
$$;
