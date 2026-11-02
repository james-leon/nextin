-- Revue responsive P3 : l'accès prioritaire n'est plus demandé par le client.
-- Il est accordé uniquement par le personnel : `set_ticket_priority` (journalisé, motif), création à l'accueil
-- (`reception_create_ticket`) ou arrivée d'un rendez-vous. Les RPC de prise de ticket côté client refusent donc
-- tout motif de priorité (`priority_staff_only`) ; leur corps d'origine est conservé sous le nom `*_core`.

alter function public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid) rename to take_ticket_core;
alter function public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid)
  rename to take_remote_ticket_core;

revoke execute on function
  public.take_ticket_core(uuid, public.ticket_source, text, public.priority_reason, uuid),
  public.take_remote_ticket_core(uuid, double precision, double precision, public.priority_reason, uuid)
from public, anon, authenticated, service_role;

/** Prise de ticket sur place (serveur de l'application uniquement) : jamais de priorité demandée par le client. */
create function public.take_ticket(
  p_service uuid,
  p_source public.ticket_source,
  p_entry_code text,
  p_priority_reason public.priority_reason,
  p_customer uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_priority_reason is not null then
    raise exception 'priority_staff_only' using errcode = 'P0422';
  end if;
  return public.take_ticket_core(p_service, p_source, p_entry_code, null, p_customer);
end;
$$;

/** Ticket à distance (serveur de l'application uniquement) : même règle. */
create function public.take_remote_ticket(
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
begin
  if p_priority_reason is not null then
    raise exception 'priority_staff_only' using errcode = 'P0422';
  end if;
  return public.take_remote_ticket_core(p_service, p_lat, p_lng, null, p_customer);
end;
$$;

revoke execute on function
  public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid),
  public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid)
from public, anon, authenticated;
grant execute on function
  public.take_ticket(uuid, public.ticket_source, text, public.priority_reason, uuid),
  public.take_remote_ticket(uuid, double precision, double precision, public.priority_reason, uuid)
to service_role;
