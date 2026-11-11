-- ═════════════════════════════════════════════════════════════════════════════
-- C3 — « Demander de l'aide » depuis la page du ticket : pastille à l'accueil avec « Traité ».
-- Table à part (la table des tickets n'est pas modifiée : aucune diffusion vers l'écran TV ni vers le tableau public) ;
-- l'accueil est prévenu par un événement privé `help` sur son canal (`staff:branch:<agence>`), sans nom ni identifiant
-- client. Une demande par ticket toutes les 5 minutes au plus. Ajout seulement : compatible avec le code en ligne.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.ticket_help_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id uuid not null,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);
create index ticket_help_requests_ticket_idx on public.ticket_help_requests (ticket_id, requested_at desc);
create index ticket_help_requests_open_idx on public.ticket_help_requests (branch_id) where handled_at is null;

alter table public.ticket_help_requests enable row level security;
-- Personnel de l'agence (lecture) ; écritures uniquement par les fonctions ci-dessous.
create policy ticket_help_requests_select on public.ticket_help_requests for select to authenticated
  using (not public.is_anonymous() and public.can_access_branch(organization_id, branch_id));
revoke insert, update, delete on public.ticket_help_requests from anon, authenticated;

/** Patient (lien du ticket) : demande d'aide pour un ticket en cours ; 5 minutes au moins entre deux demandes. */
create or replace function public.request_ticket_help(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tickets;
  v_last timestamptz;
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_t from public.tickets where public_token = p_token for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_t.status not in ('waiting', 'called', 'serving') then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  select max(requested_at) into v_last from public.ticket_help_requests where ticket_id = v_t.id;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    raise exception 'help_too_soon' using errcode = 'P0429',
      detail = ceil(extract(epoch from (v_last + interval '5 minutes' - now())))::text;
  end if;
  insert into public.ticket_help_requests (organization_id, branch_id, ticket_id)
  values (v_t.organization_id, v_t.branch_id, v_t.id)
  returning id into v_id;
  perform public.broadcast('staff:branch:' || v_t.branch_id, 'help', jsonb_build_object('request_id', v_id), true);
  return jsonb_build_object('requested_at', now(), 'next_at', now() + interval '5 minutes');
end;
$$;

/** Accueil : demande d'aide traitée (personnel de l'agence). */
create or replace function public.handle_ticket_help(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.ticket_help_requests;
begin
  select * into v_r from public.ticket_help_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.assert_branch_staff(v_r.branch_id);
  if v_r.handled_at is null then
    update public.ticket_help_requests set handled_at = now(), handled_by = (select auth.uid()) where id = p_request;
    perform public.broadcast('staff:branch:' || v_r.branch_id, 'help', jsonb_build_object('request_id', p_request), true);
  end if;
end;
$$;

revoke execute on function public.request_ticket_help(text), public.handle_ticket_help(uuid) from public;
-- Page publique du ticket (lien) : comme `cancel_my_ticket`.
grant execute on function public.request_ticket_help(text) to anon, authenticated;
grant execute on function public.handle_ticket_help(uuid) to authenticated;
