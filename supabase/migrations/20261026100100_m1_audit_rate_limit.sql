-- ═════════════════════════════════════════════════════════════════════════════
-- M1 — Journal d'audit (append-only) et rate limiting.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null,
  entity_id uuid,
  diff jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_user_id, created_at desc);

create or replace function public.guard_audit_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seule mise à jour tolérée : la mise à NULL de organization_id par la suppression d'une organisation.
  if tg_op = 'UPDATE' and new.organization_id is null
     and (to_jsonb(new) - 'organization_id') = (to_jsonb(old) - 'organization_id') then
    return new;
  end if;
  if not public.is_privileged_context() then
    raise exception 'audit_log is append-only' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.guard_audit_append_only();

/** Écrit une entrée d'audit. Interne : appelée par les triggers et RPC SECURITY DEFINER. */
create or replace function public.audit(
  p_org uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_diff jsonb default '{}'::jsonb,
  p_ip_hash text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (organization_id, actor_user_id, action, entity_type, entity_id, diff, ip_hash)
  values (p_org, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_diff, '{}'::jsonb), p_ip_hash);
$$;

-- Différence minimale entre deux lignes (colonnes modifiées uniquement, sans updated_at).
create or replace function public.jsonb_row_diff(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(n.key, jsonb_build_object('from', p_old -> n.key, 'to', n.value)),
    '{}'::jsonb
  )
  from jsonb_each(p_new) n
  where n.key not in ('updated_at', 'created_at')
    and (p_old -> n.key) is distinct from n.value;
$$;

create or replace function public.audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit(new.organization_id, 'member.add', 'membership', new.id,
      jsonb_build_object('user_id', new.user_id, 'role', new.role, 'branch_id', new.branch_id));
  elsif tg_op = 'UPDATE' then
    if (old.role, old.branch_id, old.active) is distinct from (new.role, new.branch_id, new.active) then
      perform public.audit(new.organization_id, 'member.update', 'membership', new.id,
        public.jsonb_row_diff(to_jsonb(old), to_jsonb(new)));
    end if;
  else
    if exists (select 1 from public.organizations where id = old.organization_id) then
      perform public.audit(old.organization_id, 'member.remove', 'membership', old.id,
        jsonb_build_object('user_id', old.user_id, 'role', old.role, 'branch_id', old.branch_id));
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_memberships();

create or replace function public.audit_organizations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diff jsonb;
begin
  v_diff := public.jsonb_row_diff(to_jsonb(old), to_jsonb(new));
  if v_diff = '{}'::jsonb then
    return new;
  end if;
  if old.status is distinct from new.status then
    perform public.audit(new.id, 'org.status_change', 'organization', new.id, v_diff);
  else
    perform public.audit(new.id, 'org.update', 'organization', new.id, v_diff);
  end if;
  return new;
end;
$$;

create trigger organizations_audit after update on public.organizations
  for each row execute function public.audit_organizations();

-- ─── Rate limiting (fenêtres fixes) ──────────────────────────────────────────

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

/**
 * Incrémente le compteur de la fenêtre courante et renvoie vrai si la limite n'est pas dépassée.
 * Ex. check_rate_limit('take_ticket:ip:<hash>', 5, '10 minutes').
 */
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seconds double precision := extract(epoch from p_window);
  v_start timestamptz;
  v_count integer;
begin
  if v_seconds <= 0 or p_max < 1 then
    raise exception 'invalid rate limit parameters';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_max;
end;
$$;

create or replace function public.purge_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
