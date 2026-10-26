-- ═════════════════════════════════════════════════════════════════════════════
-- M1 — RPC (création d'établissement, invitations) et politiques RLS du socle.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── RPC ─────────────────────────────────────────────────────────────────────

/** Crée un établissement (statut pending, à valider par Wintek) et en fait l'org_admin du créateur. */
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_type public.org_type,
  p_default_locale text default 'fr',
  p_data_retention_days integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
begin
  if v_user is null or public.is_anonymous() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.check_rate_limit('create_organization:uid:' || v_user, 5, interval '1 day') then
    raise exception 'Too many organizations created' using errcode = 'P0429';
  end if;

  insert into public.organizations (name, slug, type, default_locale, data_retention_days, created_by)
  values (trim(p_name), lower(trim(p_slug)), p_type, coalesce(p_default_locale, 'fr'), coalesce(p_data_retention_days, 30), v_user)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, invited_by)
  values (v_org, v_user, 'org_admin', v_user);

  perform public.audit(v_org, 'org.create', 'organization', v_org,
    jsonb_build_object('name', p_name, 'slug', p_slug, 'type', p_type));
  return v_org;
end;
$$;

/**
 * Crée une invitation et renvoie le jeton en clair (une seule fois ; seul son SHA-256 est stocké).
 * Le jeton est transmis par lien (e-mail / WhatsApp) : {APP_URL}/invite/{token}.
 */
create or replace function public.create_invitation(
  p_org uuid,
  p_role public.member_role,
  p_branch uuid default null,
  p_email text default null,
  p_phone_e164 text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id uuid;
begin
  if not public.can_manage_member(p_org, p_branch, p_role) then
    raise exception 'Not allowed to invite this role' using errcode = '42501';
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.invitations (organization_id, email, phone_e164, role, branch_id, token_hash, invited_by)
  values (p_org, nullif(lower(trim(p_email)), ''), p_phone_e164, p_role, p_branch,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), (select auth.uid()))
  returning id into v_id;
  perform public.audit(p_org, 'member.invite', 'invitation', v_id,
    jsonb_build_object('role', p_role, 'branch_id', p_branch));
  return v_token;
end;
$$;

/** Accepte une invitation pour l'utilisateur connecté (non anonyme). Renvoie l'organisation. */
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_inv public.invitations;
begin
  if v_user is null or public.is_anonymous() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Invitation invalid or expired' using errcode = 'P0002';
  end if;

  if v_inv.email is not null then
    select lower(email) into v_email from auth.users where id = v_user;
    if v_email is distinct from lower(v_inv.email::text) then
      raise exception 'Invitation was sent to another address' using errcode = '42501';
    end if;
  end if;

  insert into public.memberships (organization_id, user_id, role, branch_id, invited_by)
  values (v_inv.organization_id, v_user, v_inv.role, v_inv.branch_id, v_inv.invited_by)
  on conflict (organization_id, user_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set role = excluded.role, active = true;

  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_inv.organization_id;
end;
$$;

-- ─── Droits d'exécution ──────────────────────────────────────────────────────
-- Par défaut, PostgreSQL accorde EXECUTE à PUBLIC : on restreint explicitement.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_anonymous(),
  public.is_privileged_context(),
  public.is_platform_admin(),
  public.has_org_role(uuid, public.member_role[]),
  public.can_access_branch(uuid, uuid, public.member_role[]),
  public.shares_org_with(uuid),
  public.can_manage_member(uuid, uuid, public.member_role)
to anon, authenticated;

grant execute on function
  public.create_organization(text, text, public.org_type, text, integer),
  public.create_invitation(uuid, public.member_role, uuid, text, text),
  public.accept_invitation(text)
to authenticated;

-- Les fonctions créées par les migrations futures ne sont pas exécutables par défaut.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

-- Aucune donnée du socle n'est lisible par le rôle anon (clients non connectés).
revoke all on public.profiles, public.platform_admins, public.organizations, public.memberships,
  public.invitations, public.audit_log, public.rate_limits from anon;
-- Tables internes : accès par fonctions SECURITY DEFINER uniquement.
revoke all on public.platform_admins, public.rate_limits from authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke insert, delete, truncate on public.organizations from authenticated;
revoke insert, truncate on public.profiles from authenticated;
revoke truncate on public.memberships, public.invitations from authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id) or public.is_platform_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (public.has_org_role(id) or public.is_platform_admin());
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['org_admin']::public.member_role[]) or public.is_platform_admin())
  with check (public.has_org_role(id, array['org_admin']::public.member_role[]) or public.is_platform_admin());

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_org_role(organization_id) or public.is_platform_admin());
create policy memberships_insert on public.memberships for insert to authenticated
  with check (public.can_manage_member(organization_id, branch_id, role));
create policy memberships_update on public.memberships for update to authenticated
  using (public.can_manage_member(organization_id, branch_id, role))
  with check (public.can_manage_member(organization_id, branch_id, role) and user_id <> (select auth.uid()));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.can_manage_member(organization_id, branch_id, role));

-- invitations (création via create_invitation ; lecture et révocation par les gestionnaires)
revoke insert, update on public.invitations from authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using (public.can_manage_member(organization_id, branch_id, role));
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.can_manage_member(organization_id, branch_id, role) and accepted_at is null);

-- audit_log : lecture par l'org_admin de l'organisation et les super admins
create policy audit_log_select on public.audit_log for select to authenticated
  using (
    (organization_id is not null and public.has_org_role(organization_id, array['org_admin']::public.member_role[]))
    or public.is_platform_admin()
  );

-- platform_admins : chaque super admin voit la liste (gestion via service role uniquement)
grant select on public.platform_admins to authenticated;
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (public.is_platform_admin());
