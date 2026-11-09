-- ═════════════════════════════════════════════════════════════════════════════
-- M1 — Fondations : identité, tenants (organisations), personnel, invitations.
-- Migrations progressives : seules les tables nécessaires au M1 sont créées ici.
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ─── Utilitaires ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

/** Vrai si la requête courante provient d'une session anonyme Supabase (client sans compte). */
create or replace function public.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

/** Vrai pour les rôles techniques (migrations, service role) qui contournent les gardes applicatives. */
create or replace function public.is_privileged_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role';
$$;

-- ─── Énumérations ────────────────────────────────────────────────────────────

create type public.org_type as enum ('clinic', 'hospital', 'telecom', 'bank', 'utility', 'administration', 'other');
create type public.org_status as enum ('pending', 'active', 'suspended');
create type public.member_role as enum ('org_admin', 'branch_manager', 'receptionist', 'agent');

-- ─── Profils ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profil créé pour les comptes du personnel uniquement (jamais pour les sessions anonymes des clients).
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into public.profiles (id, full_name, locale)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_auth_user_profile();

-- Conversion d'une session anonyme en compte permanent.
create trigger on_auth_user_converted after update of is_anonymous on auth.users
  for each row when (old.is_anonymous is true and new.is_anonymous is false)
  execute function public.handle_auth_user_profile();

-- ─── Super admins Wintek ─────────────────────────────────────────────────────

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- ─── Organisations (établissements) ──────────────────────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (char_length(slug) between 3 and 48 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type public.org_type not null,
  status public.org_status not null default 'pending',
  logo_path text,
  country char(2) not null default 'CM',
  currency char(3) not null default 'XAF',
  default_locale text not null default 'fr' check (default_locale in ('fr', 'en')),
  data_retention_days integer not null default 30 check (data_retention_days between 7 and 365),
  created_by uuid references auth.users (id) on delete set null,
  validated_at timestamptz,
  validated_by uuid references auth.users (id) on delete set null,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_status_idx on public.organizations (status);

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- Seuls les super admins (ou le service role) changent le statut et la validation d'un établissement.
create or replace function public.guard_organization_platform_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.status, new.validated_at, new.validated_by, new.suspended_reason, new.created_by, new.slug)
     is distinct from
     (old.status, old.validated_at, old.validated_by, old.suspended_reason, old.created_by, old.slug)
     and not public.is_platform_admin()
     and not public.is_privileged_context() then
    raise exception 'Only platform admins can change status, validation or slug of an organization'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_platform_fields before update on public.organizations
  for each row execute function public.guard_organization_platform_fields();

-- ─── Personnel ───────────────────────────────────────────────────────────────

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  -- NULL = toutes les agences. La clé étrangère vers branches est ajoutée au M2.
  branch_id uuid,
  active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_org_admin_all_branches check (role <> 'org_admin' or branch_id is null),
  constraint memberships_branch_manager_scoped check (role <> 'branch_manager' or branch_id is not null)
);

create unique index memberships_unique_scope_idx
  on public.memberships (organization_id, user_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index memberships_user_idx on public.memberships (user_id) where active;
create index memberships_org_idx on public.memberships (organization_id);

create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

/** Membre actif de l'organisation avec l'un des rôles (NULL = n'importe quel rôle). */
create or replace function public.has_org_role(p_org uuid, p_roles public.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.active
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

/** Accès à une agence : membre de l'organisation affecté à toutes les agences ou à celle-ci. */
create or replace function public.can_access_branch(p_org uuid, p_branch uuid, p_roles public.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.active
      and (m.branch_id is null or m.branch_id = p_branch)
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

/** Deux utilisateurs partagent-ils une organisation ? (visibilité des profils entre collègues) */
create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id and theirs.active
    where mine.user_id = (select auth.uid()) and mine.active and theirs.user_id = p_user
  );
$$;

/**
 * Peut-on créer / modifier / retirer un membre de ce rôle sur cette portée ?
 * - org_admin : tout dans son organisation ;
 * - branch_manager : réceptionnistes et agents de sa propre agence uniquement ;
 * - super admin : tout.
 */
create or replace function public.can_manage_member(p_org uuid, p_branch uuid, p_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or public.has_org_role(p_org, array['org_admin']::public.member_role[])
    or (
      p_role in ('receptionist', 'agent')
      and p_branch is not null
      and exists (
        select 1 from public.memberships m
        where m.organization_id = p_org
          and m.user_id = (select auth.uid())
          and m.active
          and m.role = 'branch_manager'
          and m.branch_id = p_branch
      )
    );
$$;

-- Une organisation garde toujours au moins un org_admin actif.
create or replace function public.guard_last_org_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  if old.role = 'org_admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'org_admin' or not new.active) then
    -- Suppression en cascade de l'organisation entière : rien à protéger.
    if not exists (select 1 from public.organizations where id = old.organization_id) then
      return coalesce(new, old);
    end if;
    select count(*) into v_remaining
    from public.memberships
    where organization_id = old.organization_id and role = 'org_admin' and active and id <> old.id;
    if v_remaining = 0 then
      raise exception 'An organization must keep at least one active org_admin' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_guard_last_admin before update or delete on public.memberships
  for each row execute function public.guard_last_org_admin();

-- ─── Invitations ─────────────────────────────────────────────────────────────

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email extensions.citext,
  phone_e164 text check (phone_e164 ~ '^\+237[26][0-9]{8}$'),
  role public.member_role not null,
  branch_id uuid,
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invitations_contact check (email is not null or phone_e164 is not null),
  constraint invitations_org_admin_all_branches check (role <> 'org_admin' or branch_id is null),
  constraint invitations_branch_manager_scoped check (role <> 'branch_manager' or branch_id is not null)
);

create index invitations_org_idx on public.invitations (organization_id) where accepted_at is null;
