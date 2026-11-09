-- M10b : réception des événements publicitaires par l'application (service role), depuis un ticket ou un écran TV.
-- L'agence et l'écran sont déduits du jeton : un client ne peut compter que pour l'agence de son ticket.

/** Lot d'une page client : ticket actif ou terminé du jour (statistiques envoyées au retour du réseau). */
create or replace function public.record_ticket_ad_events(p_ticket_token text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets;
begin
  select * into v_t from public.tickets
  where p_ticket_token ~ '^[A-Za-z0-9]{22}$' and public_token = p_ticket_token and created_at > now() - interval '2 days';
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.check_rate_limit('ad_events:ticket:' || v_t.id, 60, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  return public.record_ad_events(v_t.branch_id, null, p_events);
end;
$$;

/** Lot d'un écran TV appairé (jeton d'appareil, seule l'empreinte est en base). */
create or replace function public.record_display_ad_events(p_device_token text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.displays;
begin
  select * into v_d from public.displays where device_token_hash = public.sha256_hex(p_device_token) and status = 'active';
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not public.check_rate_limit('ad_events:display:' || v_d.id, 240, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  return public.record_ad_events(v_d.branch_id, v_d.id, p_events);
end;
$$;

revoke execute on function public.record_ticket_ad_events(text, jsonb), public.record_display_ad_events(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_ticket_ad_events(text, jsonb), public.record_display_ad_events(text, jsonb) to service_role;
