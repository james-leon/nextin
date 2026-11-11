-- ═════════════════════════════════════════════════════════════════════════════
-- C2 — Page Aide du patient : coordonnées publiques de l'établissement du ticket (nom, agence, adresse, téléphone
-- de l'agence, horaires, ouvert maintenant). Aucune donnée du patient. Ajout seulement (nouvelle fonction).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.ticket_help(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', o.name,
    'branch', b.name,
    'address', b.address,
    'city', b.city,
    'phone_e164', b.phone_e164,
    'is_open', public.branch_is_open(b.id),
    'timezone', b.timezone,
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at)
        order by h.weekday, h.opens_at)
      from public.opening_hours h where h.branch_id = b.id), '[]'::jsonb))
  from public.tickets t
  join public.branches b on b.id = t.branch_id
  join public.organizations o on o.id = t.organization_id
  where p_token ~ '^[A-Za-z0-9_-]{16,64}$' and t.public_token = p_token;
$$;

revoke execute on function public.ticket_help(text) from public;
-- Page publique (lien du ticket) : comme `get_ticket`.
grant execute on function public.ticket_help(text) to anon, authenticated;
