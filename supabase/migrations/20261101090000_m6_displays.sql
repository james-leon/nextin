-- ═════════════════════════════════════════════════════════════════════════════
-- M6 — Écrans TV : appairage par code à 6 chiffres (sans compte), jeton d'appareil
-- (seule son empreinte est stockée), révocation, services affichés, réglages des annonces vocales.
-- ═════════════════════════════════════════════════════════════════════════════

create type public.display_status as enum ('pending', 'active', 'revoked');

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- En attente d'appairage, l'écran n'appartient encore à aucun établissement (organisation et agence nulles).
create table public.displays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  branch_id uuid,
  name text check (char_length(name) between 1 and 60),
  status public.display_status not null default 'pending',
  pairing_code text check (pairing_code ~ '^[0-9]{6}$'),
  pairing_expires_at timestamptz,
  -- Secret remis à l'écran pendant l'attente (lui seul peut récupérer son jeton une fois appairé).
  poll_secret_hash text,
  device_token_hash text unique,
  show_ads boolean not null default false,
  last_seen_at timestamptz,
  app_version text check (char_length(app_version) <= 40),
  paired_by uuid references auth.users (id) on delete set null,
  paired_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  check (status = 'pending' or (organization_id is not null and branch_id is not null and name is not null))
);
create unique index displays_pairing_code_idx on public.displays (pairing_code) where status = 'pending';
create index displays_branch_idx on public.displays (branch_id) where status = 'active';
create trigger displays_set_updated_at before update on public.displays
  for each row execute function public.set_updated_at();

create table public.display_services (
  display_id uuid not null,
  service_id uuid not null,
  organization_id uuid not null,
  primary key (display_id, service_id),
  foreign key (organization_id, display_id) references public.displays (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete cascade
);

create table public.announcement_settings (
  branch_id uuid primary key,
  organization_id uuid not null,
  languages text[] not null default array['fr']::text[]
    check (cardinality(languages) between 1 and 2 and languages <@ array['fr', 'en']::text[]),
  volume smallint not null default 80 check (volume between 0 and 100),
  repeat_count smallint not null default 1 check (repeat_count between 1 and 3),
  chime_enabled boolean not null default true,
  -- Plages de silence : [{"from": "12:00", "to": "14:00"}], heure locale de l'agence.
  quiet_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(quiet_hours) = 'array'),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);
create trigger announcement_settings_set_updated_at before update on public.announcement_settings
  for each row execute function public.set_updated_at();

-- ─── Utilitaires ─────────────────────────────────────────────────────────────

create or replace function public.sha256_hex(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_text, 'sha256'), 'hex');
$$;

-- ─── Écran : appairage et session (route handlers, service role) ─────────────

/** Nouvel écran en attente : code à 6 chiffres valable 10 minutes et secret d'attente. */
create or replace function public.tv_create_pairing(p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_secret text := public.random_string(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
  v_row public.displays;
begin
  if p_ip_hash is not null and not public.check_rate_limit('tv_pair:ip:' || p_ip_hash, 20, interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  -- Les codes expirés libèrent leur place.
  delete from public.displays where status = 'pending' and pairing_expires_at < now() - interval '1 hour';
  for i in 1 .. 20 loop
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    begin
      insert into public.displays (pairing_code, pairing_expires_at, poll_secret_hash)
      values (v_code, now() + interval '10 minutes', public.sha256_hex(v_secret))
      returning * into v_row;
      exit;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;
  if v_row.id is null then raise exception 'rate_limited' using errcode = 'P0429'; end if;
  return jsonb_build_object('display_id', v_row.id, 'code', v_code, 'poll_secret', v_secret, 'expires_at', v_row.pairing_expires_at);
end;
$$;

/**
 * Interrogation par l'écran en attente. Une fois appairé, le jeton d'appareil est créé et remis
 * une seule fois (seule son empreinte est stockée).
 */
create or replace function public.tv_poll_pairing(p_display uuid, p_poll_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.displays;
  v_token text;
begin
  select * into v_row from public.displays where id = p_display for update;
  if not found or v_row.poll_secret_hash is null or v_row.poll_secret_hash <> public.sha256_hex(p_poll_secret) then
    return jsonb_build_object('status', 'unknown');
  end if;
  if v_row.status = 'pending' then
    return jsonb_build_object('status', case when v_row.pairing_expires_at < now() then 'expired' else 'pending' end);
  end if;
  if v_row.status = 'active' and v_row.device_token_hash is null then
    v_token := public.random_string(48, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    update public.displays set device_token_hash = public.sha256_hex(v_token), poll_secret_hash = null, last_seen_at = now()
    where id = p_display;
    return jsonb_build_object('status', 'active', 'device_token', v_token);
  end if;
  return jsonb_build_object('status', 'unknown');
end;
$$;

/** Configuration d'un écran appairé ; null si le jeton est inconnu ou révoqué (retour à l'appairage). */
create or replace function public.tv_session(p_device_token text, p_app_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.displays;
begin
  update public.displays
  set last_seen_at = now(), app_version = coalesce(left(p_app_version, 40), app_version)
  where device_token_hash = public.sha256_hex(p_device_token) and status = 'active'
  returning * into v_row;
  if not found then return null; end if;
  return (
    select jsonb_build_object(
      'display_id', v_row.id,
      'name', v_row.name,
      'show_ads', v_row.show_ads,
      'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
      'branch', jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone),
      'service_ids', coalesce((select jsonb_agg(ds.service_id) from public.display_services ds where ds.display_id = v_row.id), '[]'::jsonb),
      'entry', (select jsonb_build_object('token', q.token, 'short_code', q.short_code) from public.qr_codes q
                where q.branch_id = b.id and q.active and q.service_id is null order by q.created_at desc limit 1),
      'announcements', coalesce(
        (select jsonb_build_object('languages', a.languages, 'volume', a.volume, 'repeat_count', a.repeat_count,
                                   'chime_enabled', a.chime_enabled, 'quiet_hours', a.quiet_hours)
         from public.announcement_settings a where a.branch_id = b.id),
        jsonb_build_object('languages', jsonb_build_array(o.default_locale), 'volume', 80, 'repeat_count', 1,
                           'chime_enabled', true, 'quiet_hours', '[]'::jsonb)),
      'board', public.branch_board(b.id)
    )
    from public.branches b join public.organizations o on o.id = b.organization_id
    where b.id = v_row.branch_id and b.active and o.status = 'active'
  );
end;
$$;

-- ─── Personnel : appairer, modifier, révoquer (menu Écrans) ──────────────────

create or replace function public.pair_display(
  p_code text,
  p_branch uuid,
  p_name text,
  p_service_ids uuid[] default null,
  p_show_ads boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_display public.displays;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null or public.is_anonymous() or not public.can_manage_branch(v_org, p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Contre la recherche de codes au hasard.
  if not public.check_rate_limit('pair_display:' || (select auth.uid()), 10, interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  select * into v_display from public.displays
  where pairing_code = p_code and status = 'pending' and pairing_expires_at > now()
  for update;
  if not found then raise exception 'pairing_code_invalid' using errcode = 'P0404'; end if;

  update public.displays
  set organization_id = v_org, branch_id = p_branch, name = trim(p_name), status = 'active',
      pairing_code = null, pairing_expires_at = null, show_ads = coalesce(p_show_ads, false),
      paired_by = (select auth.uid()), paired_at = now()
  where id = v_display.id;
  insert into public.display_services (display_id, service_id, organization_id)
  select v_display.id, s.id, v_org from public.services s
  where s.branch_id = p_branch and (p_service_ids is null or s.id = any (p_service_ids));
  perform public.audit(v_org, 'display.pair', 'display', v_display.id, jsonb_build_object('name', p_name));
  return v_display.id;
end;
$$;

create or replace function public.update_display(p_display uuid, p_name text, p_service_ids uuid[], p_show_ads boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.displays;
begin
  select * into v_d from public.displays where id = p_display and status = 'active' for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if public.is_anonymous() or not public.can_manage_branch(v_d.organization_id, v_d.branch_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.displays set name = trim(p_name), show_ads = coalesce(p_show_ads, false) where id = p_display;
  delete from public.display_services where display_id = p_display;
  insert into public.display_services (display_id, service_id, organization_id)
  select p_display, s.id, v_d.organization_id from public.services s
  where s.branch_id = v_d.branch_id and s.id = any (coalesce(p_service_ids, array[]::uuid[]));
  perform public.audit(v_d.organization_id, 'display.update', 'display', p_display, jsonb_build_object('name', p_name));
end;
$$;

/** Révocation : le jeton cesse immédiatement de fonctionner ; l'écran revient à l'appairage. */
create or replace function public.revoke_display(p_display uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.displays;
begin
  select * into v_d from public.displays where id = p_display and status = 'active' for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if public.is_anonymous() or not public.can_manage_branch(v_d.organization_id, v_d.branch_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.displays set status = 'revoked', device_token_hash = null, poll_secret_hash = null, revoked_at = now()
  where id = p_display;
  perform public.audit(v_d.organization_id, 'display.revoke', 'display', p_display, '{}'::jsonb);
end;
$$;

-- ─── Droits ──────────────────────────────────────────────────────────────────

revoke execute on function
  public.sha256_hex(text), public.tv_create_pairing(text), public.tv_poll_pairing(uuid, text), public.tv_session(text, text)
from public, anon, authenticated;
grant execute on function public.tv_create_pairing(text), public.tv_poll_pairing(uuid, text), public.tv_session(text, text) to service_role;
grant execute on function
  public.pair_display(text, uuid, text, uuid[], boolean), public.update_display(uuid, text, uuid[], boolean), public.revoke_display(uuid)
to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.displays enable row level security;
alter table public.display_services enable row level security;
alter table public.announcement_settings enable row level security;

revoke all on public.displays, public.display_services, public.announcement_settings from anon;
revoke insert, update, delete, truncate on public.displays, public.display_services from authenticated;
-- Les empreintes de jetons ne sont jamais lisibles, même par le personnel.
revoke select on public.displays from authenticated;
grant select (id, organization_id, branch_id, name, status, show_ads, last_seen_at, app_version, paired_at, revoked_at, created_at)
  on public.displays to authenticated;

create policy displays_select on public.displays for select to authenticated
  using (organization_id is not null and (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin()));
create policy display_services_select on public.display_services for select to authenticated
  using (exists (select 1 from public.displays d where d.id = display_id
                 and (public.can_access_branch(d.organization_id, d.branch_id) or public.is_platform_admin())));

create policy announcement_settings_select on public.announcement_settings for select to authenticated
  using (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin());
create policy announcement_settings_insert on public.announcement_settings for insert to authenticated
  with check (not public.is_anonymous() and public.can_manage_branch(organization_id, branch_id));
create policy announcement_settings_update on public.announcement_settings for update to authenticated
  using (not public.is_anonymous() and public.can_manage_branch(organization_id, branch_id))
  with check (not public.is_anonymous() and public.can_manage_branch(organization_id, branch_id));
