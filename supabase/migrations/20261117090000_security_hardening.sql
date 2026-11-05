-- Sécurité (docs/NEXTIN_SECURITY_AND_PRIVACY.md).
-- 1. Droit d'exécution par défaut : PostgreSQL accorde EXECUTE à PUBLIC sur toute nouvelle fonction. La révocation
--    du M1 était limitée au schéma public, ce qui ne retire pas ce droit global : 39 RPC du personnel restaient
--    exécutables par le rôle anonyme (elles refusaient l'appel, faute d'utilisateur, mais sans défense en profondeur).
--    Révocation globale pour l'avenir, et retrait de PUBLIC sur les fonctions existantes : le personnel et les
--    sessions anonymes des clients (rôle authenticated) gardent leurs droits, le rôle anon seulement ce que les pages
--    publiques appellent.
-- 2. Appels hors ordre journalisés (`ticket.call_out_of_order`) : un poste qui appelle un ticket précis alors que
--    d'autres passaient avant lui.

-- ─── 1. Droits d'exécution ───────────────────────────────────────────────────

alter default privileges for role postgres revoke execute on functions from public;

do $$
declare
  v_fn record;
  -- Pages publiques sans session (ticket, tableau de l'agence, QR code, note) et calculs purs.
  v_anon text[] := array['cancel_my_ticket', 'get_branch_board', 'get_ticket', 'rate_ticket', 'resolve_entry',
    'effective_duration_seconds', 'estimate_wait_seconds', 'ticket_display_code'];
begin
  for v_fn in
    select p.oid::regprocedure as sig, p.proname, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and array_to_string(p.proacl, ' ') ~ '(^| )=X'
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.sig);
    if not v_fn.is_trigger then
      execute format('grant execute on function %s to authenticated, service_role', v_fn.sig);
      if v_fn.proname = any (v_anon) then
        execute format('grant execute on function %s to anon', v_fn.sig);
      end if;
    end if;
  end loop;
end;
$$;

-- ─── 2. Appels hors ordre ────────────────────────────────────────────────────

/**
 * Appel d'un ticket précis (poste hors ligne qui avait choisi ce ticket dans sa copie de la file). S'il n'est plus
 * disponible, le prochain est appelé (`conflict: true`). S'il passait après d'autres tickets de ce poste, l'appel
 * est journalisé (`ticket.call_out_of_order`, sans nom de client).
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
  v_ahead integer;
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
    -- Appel hors ordre : d'autres tickets de ce poste passaient avant (priorité, arrivée). Le poste hors ligne peut
    -- légitimement appeler depuis une copie un peu ancienne de la file : l'appel est fait, mais journalisé.
    select count(*) into v_ahead
    from public.tickets o
    join public.counter_services cs on cs.service_id = o.service_id and cs.counter_id = p_counter
    where o.branch_id = v_branch and o.status = 'waiting' and o.id <> v_ticket.id
      and o.service_day = v_ticket.service_day
      and (o.preferred_counter_id is null or o.preferred_counter_id = p_counter)
      and not (o.is_remote and o.presence_confirmed_at is null)
      -- Même ordre que `pick_next_ticket` : patient attitré à ce poste, priorité, arrivée.
      and (coalesce(o.preferred_counter_id = p_counter, false), o.priority_level, -o.sort_key, -o.number)
        > (coalesce(v_ticket.preferred_counter_id = p_counter, false), v_ticket.priority_level, -v_ticket.sort_key, -v_ticket.number);
    if v_ahead > 0 then
      perform public.audit(v_ticket.organization_id, 'ticket.call_out_of_order', 'ticket', v_ticket.id,
        jsonb_build_object('counter_id', p_counter, 'ahead', v_ahead, 'offline_replay', p_client_op_id is not null));
    end if;
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
