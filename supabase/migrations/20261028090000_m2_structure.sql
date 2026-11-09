-- ═════════════════════════════════════════════════════════════════════════════
-- M2 — Structure d'un établissement : agences, réglages, horaires, spécialités,
-- praticiens, services, guichets/cabinets, QR codes.
-- Cohérence multi-tenant : clés étrangères composites (organization_id, branch_id),
-- un enregistrement ne peut jamais pointer vers l'agence d'un autre établissement.
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists postgis with schema extensions;

create type public.counter_kind as enum ('cabinet', 'guichet', 'caisse', 'laboratoire', 'accueil');
create type public.counter_status as enum ('closed', 'open', 'paused');

-- ─── Agences ─────────────────────────────────────────────────────────────────

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  address text check (char_length(address) <= 240),
  city text check (char_length(city) <= 80),
  location extensions.geography(Point, 4326),
  -- Coordonnées lisibles par l'application (PostgREST renvoie la géographie en binaire).
  latitude double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  longitude double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  timezone text not null default 'Africa/Douala',
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index branches_org_idx on public.branches (organization_id);
create index branches_location_idx on public.branches using gist (location);
create trigger branches_set_updated_at before update on public.branches
  for each row execute function public.set_updated_at();

-- Personnel et invitations rattachés à une agence du même établissement.
alter table public.memberships
  add constraint memberships_branch_fk foreign key (organization_id, branch_id)
  references public.branches (organization_id, id) on delete cascade;
alter table public.invitations
  add constraint invitations_branch_fk foreign key (organization_id, branch_id)
  references public.branches (organization_id, id) on delete cascade;

create table public.branch_settings (
  branch_id uuid primary key,
  organization_id uuid not null,
  remote_tickets_enabled boolean not null default false,
  remote_confirm_threshold smallint not null default 3 check (remote_confirm_threshold between 1 and 10),
  remote_penalty_places smallint not null default 3 check (remote_penalty_places between 1 and 20),
  remote_max_delays smallint not null default 2 check (remote_max_delays between 1 and 5),
  remote_max_distance_km numeric(5, 1) check (remote_max_distance_km between 0.5 and 200),
  priorities_enabled boolean not null default true,
  almost_turn_threshold smallint not null default 3 check (almost_turn_threshold between 1 and 10),
  max_active_tickets_per_customer smallint not null default 1 check (max_active_tickets_per_customer between 1 and 5),
  rating_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);
create trigger branch_settings_set_updated_at before update on public.branch_settings
  for each row execute function public.set_updated_at();

-- Horaires : une plage par jour ouvré (ISO : 1 = lundi … 7 = dimanche).
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at),
  unique (branch_id, weekday),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);

create table public.branch_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  date date not null,
  reason text check (char_length(reason) <= 120),
  unique (branch_id, date),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);

-- ─── Spécialités et praticiens ───────────────────────────────────────────────

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  name_en text check (char_length(name_en) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index specialties_unique_name_idx on public.specialties (organization_id, lower(name));

create table public.practitioners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  title text check (char_length(title) <= 20),
  display_name text not null check (char_length(display_name) between 2 and 120),
  specialty_id uuid,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, specialty_id) references public.specialties (organization_id, id) on delete set null (specialty_id)
);
create index practitioners_branch_specialty_idx on public.practitioners (branch_id, specialty_id) where active;
create trigger practitioners_set_updated_at before update on public.practitioners
  for each row execute function public.set_updated_at();

-- ─── Services ────────────────────────────────────────────────────────────────

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  specialty_id uuid,
  name text not null check (char_length(name) between 2 and 80),
  name_en text check (char_length(name_en) <= 80),
  prefix text not null check (prefix ~ '^[A-Z]{1,2}$'),
  color text not null default '#1A6BB5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  description text check (char_length(description) <= 280),
  -- Durée de service par défaut saisie par le directeur ; utilisée tant que l'historique est insuffisant (PLAN §3.4).
  default_service_seconds integer not null check (default_service_seconds between 60 and 7200),
  allow_priority boolean not null default true,
  allow_remote boolean not null default true,
  max_daily_tickets integer check (max_daily_tickets between 1 and 9999),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (branch_id, prefix),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, specialty_id) references public.specialties (organization_id, id) on delete set null (specialty_id)
);
create index services_branch_idx on public.services (branch_id, sort_order);
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ─── Guichets / cabinets ─────────────────────────────────────────────────────

create table public.counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  kind public.counter_kind not null,
  number smallint not null check (number between 1 and 999),
  label text check (char_length(label) <= 60),
  default_practitioner_id uuid,
  status public.counter_status not null default 'closed',
  current_agent_id uuid references auth.users (id) on delete set null,
  status_changed_at timestamptz not null default now(),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (branch_id, kind, number),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, default_practitioner_id) references public.practitioners (organization_id, id)
    on delete set null (default_practitioner_id)
);
create index counters_branch_idx on public.counters (branch_id, kind, number);
create trigger counters_set_updated_at before update on public.counters
  for each row execute function public.set_updated_at();

create table public.counter_services (
  organization_id uuid not null,
  counter_id uuid not null,
  service_id uuid not null,
  weight smallint not null default 1 check (weight between 1 and 10),
  primary key (counter_id, service_id),
  foreign key (organization_id, counter_id) references public.counters (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete cascade
);
create index counter_services_service_idx on public.counter_services (service_id);

-- Un guichet ne sert que des services de sa propre agence ; un praticien attitré est de la même agence.
create or replace function public.guard_same_branch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a uuid;
  v_b uuid;
begin
  if tg_table_name = 'counter_services' then
    select branch_id into v_a from public.counters where id = new.counter_id;
    select branch_id into v_b from public.services where id = new.service_id;
  elsif tg_table_name = 'counters' then
    if new.default_practitioner_id is null then return new; end if;
    v_a := new.branch_id;
    select branch_id into v_b from public.practitioners where id = new.default_practitioner_id;
  end if;
  if v_a is distinct from v_b then
    raise exception 'Counter, service and practitioner must belong to the same branch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger counter_services_same_branch before insert or update on public.counter_services
  for each row execute function public.guard_same_branch();
create trigger counters_practitioner_same_branch before insert or update of default_practitioner_id, branch_id on public.counters
  for each row execute function public.guard_same_branch();

-- ─── QR codes ────────────────────────────────────────────────────────────────

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  service_id uuid,
  token text not null unique check (token ~ '^[A-Za-z0-9]{22}$'),
  short_code text not null unique check (short_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete cascade
);
create unique index qr_codes_one_active_idx
  on public.qr_codes (branch_id, coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid)) where active;

/** Chaîne aléatoire dans un alphabet donné (octets cryptographiques). */
create or replace function public.random_string(p_length integer, p_alphabet text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_bytes bytea := extensions.gen_random_bytes(p_length);
  v_out text := '';
  v_n integer := length(p_alphabet);
begin
  for i in 0 .. p_length - 1 loop
    v_out := v_out || substr(p_alphabet, (get_byte(v_bytes, i) % v_n) + 1, 1);
  end loop;
  return v_out;
end;
$$;

/**
 * Émet un nouveau QR code (et code court de secours) pour une agence ou un service, et révoque l'ancien.
 * Interne : sans contrôle d'accès (appelée par create_branch, regenerate_qr_code et le service role).
 */
create or replace function public.issue_qr_code(p_branch uuid, p_service uuid default null)
returns public.qr_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_row public.qr_codes;
  v_short text;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then
    raise exception 'Unknown branch' using errcode = 'P0002';
  end if;

  update public.qr_codes set active = false, revoked_at = now()
  where branch_id = p_branch and service_id is not distinct from p_service and active;

  loop
    v_short := public.random_string(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    exit when not exists (select 1 from public.qr_codes where short_code = v_short);
  end loop;

  insert into public.qr_codes (organization_id, branch_id, service_id, token, short_code, created_by)
  values (v_org, p_branch, p_service,
          public.random_string(22, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
          v_short, (select auth.uid()))
  returning * into v_row;
  return v_row;
end;
$$;

-- ─── Autorisations ───────────────────────────────────────────────────────────

/** Gestion d'une agence : super admin, org_admin, ou responsable de cette agence. */
create or replace function public.can_manage_branch(p_org uuid, p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or public.has_org_role(p_org, array['org_admin']::public.member_role[])
    or public.can_access_branch(p_org, p_branch, array['branch_manager']::public.member_role[]);
$$;

-- ─── RPC ─────────────────────────────────────────────────────────────────────

/**
 * Crée une agence avec ses réglages, des horaires par défaut (lun.–ven. 7 h 30–17 h, sam. 8 h–12 h)
 * et son QR code. Réservé à l'org_admin.
 */
create or replace function public.create_branch(
  p_org uuid,
  p_name text,
  p_address text default null,
  p_city text default null,
  p_phone_e164 text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
begin
  if not (public.is_platform_admin() or public.has_org_role(p_org, array['org_admin']::public.member_role[])) then
    raise exception 'Not allowed to create a branch' using errcode = '42501';
  end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  insert into public.branches (organization_id, name, address, city, phone_e164, location, sort_order)
  values (
    p_org, trim(p_name), nullif(trim(p_address), ''), nullif(trim(p_city), ''), p_phone_e164,
    case when p_lat is null then null
         else extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end,
    (select coalesce(max(sort_order), 0) + 1 from public.branches where organization_id = p_org)
  )
  returning id into v_branch;

  insert into public.branch_settings (branch_id, organization_id) values (v_branch, p_org);
  insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
  select p_org, v_branch, d, time '07:30', time '17:00' from generate_series(1, 5) d
  union all select p_org, v_branch, 6, time '08:00', time '12:00';
  perform public.issue_qr_code(v_branch, null);

  perform public.audit(p_org, 'branch.create', 'branch', v_branch, jsonb_build_object('name', p_name));
  return v_branch;
end;
$$;

/** Met à jour la position GPS d'une agence (établissements à proximité, ciblage publicitaire). */
create or replace function public.set_branch_location(p_branch uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null or not public.can_manage_branch(v_org, p_branch) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;
  update public.branches
  set location = case when p_lat is null then null
                      else extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end
  where id = p_branch;
end;
$$;

/** Régénère le QR code d'une agence ou d'un service : l'ancien cesse de fonctionner immédiatement. */
create or replace function public.regenerate_qr_code(p_branch uuid, p_service uuid default null)
returns public.qr_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_row public.qr_codes;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null or not public.can_manage_branch(v_org, p_branch) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_service is not null and not exists (select 1 from public.services where id = p_service and branch_id = p_branch) then
    raise exception 'Service does not belong to this branch' using errcode = '23514';
  end if;
  v_row := public.issue_qr_code(p_branch, p_service);
  perform public.audit(v_org, 'qr.regenerate', 'qr_code', v_row.id,
    jsonb_build_object('branch_id', p_branch, 'service_id', p_service));
  return v_row;
end;
$$;

/**
 * Personnel d'un établissement avec nom et e-mail (l'e-mail n'est pas dans profiles).
 * Réservé aux gestionnaires ; un responsable d'agence ne voit que son agence.
 */
create or replace function public.list_org_members(p_org uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role public.member_role,
  branch_id uuid,
  active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, p.full_name, u.email::text, m.role, m.branch_id, m.active, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org
    and (
      public.is_platform_admin()
      or public.has_org_role(p_org, array['org_admin']::public.member_role[])
      or (m.branch_id is not null and public.can_access_branch(p_org, m.branch_id, array['branch_manager']::public.member_role[]))
    )
  order by m.role, p.full_name nulls last;
$$;

-- ─── Audit des changements de configuration ──────────────────────────────────

create or replace function public.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_id uuid := coalesce((v_row ->> 'id')::uuid, (v_row ->> 'branch_id')::uuid);
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    v_diff := public.jsonb_row_diff(to_jsonb(old), to_jsonb(new));
    if v_diff = '{}'::jsonb then return new; end if;
  elsif tg_op = 'INSERT' then
    v_diff := v_row - 'created_at' - 'updated_at';
  else
    if not exists (select 1 from public.organizations where id = (v_row ->> 'organization_id')::uuid) then
      return old;
    end if;
    v_diff := v_row - 'created_at' - 'updated_at';
  end if;
  perform public.audit((v_row ->> 'organization_id')::uuid,
    v_entity || '.' || lower(tg_op), v_entity, v_id, v_diff);
  return coalesce(new, old);
end;
$$;

create trigger branches_audit after update or delete on public.branches
  for each row execute function public.audit_config_change('branch');
create trigger branch_settings_audit after update on public.branch_settings
  for each row execute function public.audit_config_change('branch_settings');
create trigger services_audit after insert or update or delete on public.services
  for each row execute function public.audit_config_change('service');
create trigger counters_audit after insert or update or delete on public.counters
  for each row execute function public.audit_config_change('counter');
create trigger practitioners_audit after insert or update or delete on public.practitioners
  for each row execute function public.audit_config_change('practitioner');
create trigger specialties_audit after insert or update or delete on public.specialties
  for each row execute function public.audit_config_change('specialty');

-- ─── Droits d'exécution ──────────────────────────────────────────────────────

revoke execute on function public.random_string(integer, text), public.issue_qr_code(uuid, uuid),
  public.guard_same_branch(), public.audit_config_change() from public, anon, authenticated;
grant execute on function public.issue_qr_code(uuid, uuid) to service_role;
grant execute on function public.can_manage_branch(uuid, uuid) to authenticated;
grant execute on function
  public.create_branch(uuid, text, text, text, text, double precision, double precision),
  public.set_branch_location(uuid, double precision, double precision),
  public.regenerate_qr_code(uuid, uuid),
  public.list_org_members(uuid)
to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.branches enable row level security;
alter table public.branch_settings enable row level security;
alter table public.opening_hours enable row level security;
alter table public.branch_closures enable row level security;
alter table public.specialties enable row level security;
alter table public.practitioners enable row level security;
alter table public.services enable row level security;
alter table public.counters enable row level security;
alter table public.counter_services enable row level security;
alter table public.qr_codes enable row level security;

revoke all on public.branches, public.branch_settings, public.opening_hours, public.branch_closures,
  public.specialties, public.practitioners, public.services, public.counters, public.counter_services,
  public.qr_codes from anon;
-- Création d'agence et QR codes : uniquement via RPC.
revoke insert, delete, truncate on public.branches from authenticated;
revoke insert, update, delete, truncate on public.qr_codes from authenticated;
revoke insert, delete, truncate on public.branch_settings from authenticated;
revoke truncate on public.opening_hours, public.branch_closures, public.specialties, public.practitioners,
  public.services, public.counters, public.counter_services from authenticated;

-- Agences
create policy branches_select on public.branches for select to authenticated
  using (public.can_access_branch(organization_id, id) or public.is_platform_admin());
create policy branches_update on public.branches for update to authenticated
  using (public.can_manage_branch(organization_id, id))
  with check (public.can_manage_branch(organization_id, id));

-- Tables rattachées à une agence : lecture par le personnel de l'agence, écriture par ses gestionnaires.
do $$
declare
  t text;
begin
  foreach t in array array['branch_settings', 'opening_hours', 'branch_closures', 'practitioners', 'services', 'counters', 'qr_codes']
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (public.can_access_branch(organization_id, branch_id) or public.is_platform_admin())', t);
  end loop;
  foreach t in array array['branch_settings', 'opening_hours', 'branch_closures', 'practitioners', 'services', 'counters']
  loop
    execute format(
      'create policy %1$s_write on public.%1$s for all to authenticated
         using (public.can_manage_branch(organization_id, branch_id))
         with check (public.can_manage_branch(organization_id, branch_id))', t);
  end loop;
end;
$$;

-- Liaison guichet ↔ service : branche portée par le guichet.
create policy counter_services_select on public.counter_services for select to authenticated
  using (exists (
    select 1 from public.counters c
    where c.id = counter_id and (public.can_access_branch(c.organization_id, c.branch_id) or public.is_platform_admin())
  ));
create policy counter_services_write on public.counter_services for all to authenticated
  using (exists (
    select 1 from public.counters c where c.id = counter_id and public.can_manage_branch(c.organization_id, c.branch_id)
  ))
  with check (exists (
    select 1 from public.counters c where c.id = counter_id and public.can_manage_branch(c.organization_id, c.branch_id)
  ));

-- Spécialités : partagées par l'établissement, gérées par l'org_admin.
create policy specialties_select on public.specialties for select to authenticated
  using (public.has_org_role(organization_id) or public.is_platform_admin());
create policy specialties_write on public.specialties for all to authenticated
  using (public.has_org_role(organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin())
  with check (public.has_org_role(organization_id, array['org_admin']::public.member_role[]) or public.is_platform_admin());
