-- B5 — Double authentification (TOTP, Supabase MFA).
-- Obligatoire pour le super admin et les administrateurs d'établissement quand `platform_settings.mfa_required` est
-- activé (console Wintek) ; facultative pour les autres rôles, rendue obligatoire pour tout le personnel d'un
-- établissement par `organizations.mfa_required_all`. Contrôle côté base (`assert_mfa`) : session `aal2` exigée dans
-- les fonctions sensibles (console, abonnement et paiements, membres et rôles, export) ; code saisi depuis moins de
-- 5 minutes (`amr`) avant une suppression, un changement de rôle et un export. Réinitialisation du facteur par le
-- super admin, avec motif, journalisée.
--
-- Compatibilité avec le code en ligne : les deux réglages sont désactivés par défaut ; tant qu'ils le restent et que
-- personne n'a enregistré de facteur, aucune fonction ne change de comportement.

alter table public.platform_settings add column mfa_required boolean not null default false;
alter table public.organizations add column mfa_required_all boolean not null default false;

/** Niveau d'authentification de la session (`aal1` sans double authentification, `aal2` après le code). */
create or replace function public.session_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif((select auth.jwt()) ->> 'aal', ''), 'aal1');
$$;

/** Le compte a-t-il un facteur TOTP vérifié ? */
create or replace function public.has_mfa_factor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (
    select 1 from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified' and f.factor_type = 'totp');
$$;

/** Code TOTP saisi dans cette session depuis moins de `p_seconds` secondes (revendication `amr` du jeton). */
create or replace function public.mfa_verified_since(p_seconds integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) e
    where e ->> 'method' = 'totp' and (e ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_seconds);
$$;

/**
 * La double authentification est-elle exigée de l'utilisateur pour cet établissement (null : console Wintek) ?
 * Super admin et administrateurs d'établissement si le réglage de la plateforme est activé ; tout le personnel si
 * l'établissement l'exige ; tout compte qui a enregistré un facteur.
 */
create or replace function public.mfa_required_for(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (coalesce((select mfa_required from public.platform_settings), false)
      and (public.is_platform_admin()
           or (p_org is not null and public.has_org_role(p_org, array['org_admin']::public.member_role[]))))
    or (p_org is not null and coalesce((select mfa_required_all from public.organizations where id = p_org), false))
    or public.has_mfa_factor((select auth.uid()));
$$;

/**
 * Contrôle des fonctions sensibles : session `aal2` si la double authentification est exigée, et code saisi depuis
 * moins de 5 minutes si `p_recent` (suppression, changement de rôle, export). Seules les sessions des utilisateurs
 * sont contrôlées (le serveur, les tâches et les migrations ne le sont pas).
 */
create or replace function public.assert_mfa(p_org uuid, p_recent boolean default false)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'authenticated' or (select auth.uid()) is null then return; end if;
  if not public.mfa_required_for(p_org) then return; end if;
  if public.session_aal() <> 'aal2' then raise exception 'mfa_required' using errcode = 'P0401'; end if;
  if p_recent and not public.mfa_verified_since(300) then raise exception 'mfa_recent_required' using errcode = 'P0401'; end if;
end;
$$;

-- ─── Console Wintek et administration de l'établissement (abonnement, paiements) ──

create or replace function public.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_anonymous() or not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform public.assert_mfa(null);
end;
$$;

create or replace function public.assert_org_admin(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_anonymous() or not (public.has_org_role(p_org, array['org_admin']::public.member_role[]) or public.is_platform_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.assert_mfa(p_org);
end;
$$;

-- ─── Membres, rôles et invitations ───────────────────────────────────────────

create or replace function public.guard_membership_mfa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_mfa(old.organization_id, true);
    return old;
  end if;
  if new.role is distinct from old.role then
    perform public.assert_mfa(new.organization_id, true);
  elsif new.active is distinct from old.active or new.branch_id is distinct from old.branch_id then
    perform public.assert_mfa(new.organization_id);
  end if;
  return new;
end;
$$;
create trigger memberships_mfa before update or delete on public.memberships
  for each row execute function public.guard_membership_mfa();

create or replace function public.guard_invitation_mfa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_mfa(old.organization_id);
    return old;
  end if;
  perform public.assert_mfa(new.organization_id);
  return new;
end;
$$;
create trigger invitations_mfa before insert or delete on public.invitations
  for each row execute function public.guard_invitation_mfa();

-- Réglage « double authentification pour tout le personnel » : modifiable seulement avec une session aal2.
create or replace function public.guard_org_mfa_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mfa_required_all is distinct from old.mfa_required_all then
    if coalesce((select auth.role()), '') = 'authenticated' and public.session_aal() <> 'aal2' then
      raise exception 'mfa_required' using errcode = 'P0401';
    end if;
    perform public.audit(new.id, 'security.mfa_required_all', 'organization', new.id, jsonb_build_object('enabled', new.mfa_required_all));
  end if;
  return new;
end;
$$;
create trigger organizations_mfa_setting before update of mfa_required_all on public.organizations
  for each row execute function public.guard_org_mfa_setting();

-- ─── Export des statistiques : code saisi depuis moins de 5 minutes ─────────
create or replace function public.stats_export(p_org uuid, p_branch uuid, p_from date, p_to date, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_stats_access(p_org, p_branch);
  perform public.assert_mfa(p_org, true);
  -- M10a : export compris dans la formule (Entreprise ; établissements pilotes).
  perform public.assert_feature(p_org, 'export');
  if p_to < p_from or p_to - p_from > 400 or p_kind not in ('services', 'counters') then
    raise exception 'invalid_state' using errcode = 'P0409';
  end if;
  if p_kind = 'services' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', r.day, 'branch', b.name, 'service', s.name, 'prefix', s.prefix,
        'issued', r.issued, 'served', r.served, 'no_show', r.no_show, 'cancelled', r.cancelled, 'transferred', r.transferred,
        'remote', r.remote, 'appointment', r.appointment,
        'wait_avg_seconds', case when r.wait_count > 0 then round(r.wait_seconds_sum::numeric / r.wait_count) end,
        'max_wait_seconds', r.max_wait_seconds,
        'service_avg_seconds', case when r.service_count > 0 then round(r.service_seconds_sum::numeric / r.service_count) end,
        'rating_avg', case when r.rating_count > 0 then round(r.rating_sum::numeric / r.rating_count, 2) end,
        'rating_count', r.rating_count
      ) order by r.day, b.name, s.sort_order)
      from public.stats_branch_rows(p_org, p_branch, p_from, p_to) r
      join public.branches b on b.id = r.branch_id
      join public.services s on s.id = r.service_id
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', r.day, 'branch', b.name, 'kind', c.kind, 'number', c.number, 'label', c.label,
      'practitioner', case when r.practitioner_id is not null then public.practitioner_label(r.practitioner_id) end,
      'called', r.called, 'served', r.served, 'no_show', r.no_show,
      'service_avg_seconds', case when r.service_count > 0 then round(r.service_seconds_sum::numeric / r.service_count) end,
      'rating_avg', case when r.rating_count > 0 then round(r.rating_sum::numeric / r.rating_count, 2) end,
      'open_seconds', r.open_seconds, 'pause_seconds', r.pause_seconds
    ) order by r.day, b.name, c.kind, c.number)
    from public.stats_counter_rows(p_org, p_branch, p_from, p_to) r
    join public.branches b on b.id = r.branch_id
    join public.counters c on c.id = r.counter_id
  ), '[]'::jsonb);
end;
$$;

-- ─── Console : réglage de la plateforme et réinitialisation d'un facteur ────

/** Réglages de la console, avec l'obligation de double authentification (activable seulement en session aal2). */
create or replace function public.admin_update_settings(p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  -- Jamais d'obligation activée par une session sans code : le super admin ne peut pas se bloquer lui-même.
  if (p_fields ->> 'mfa_required')::boolean is true and public.session_aal() <> 'aal2' then
    raise exception 'mfa_required' using errcode = 'P0401';
  end if;
  update public.platform_settings set
    company_legal_name = coalesce(p_fields ->> 'company_legal_name', company_legal_name),
    company_rc = coalesce(p_fields ->> 'company_rc', company_rc),
    company_niu = coalesce(p_fields ->> 'company_niu', company_niu),
    company_address = coalesce(p_fields ->> 'company_address', company_address),
    company_phone = coalesce(p_fields ->> 'company_phone', company_phone),
    company_email = coalesce(p_fields ->> 'company_email', company_email),
    invoice_footer = coalesce(p_fields ->> 'invoice_footer', invoice_footer),
    trial_days = coalesce((p_fields ->> 'trial_days')::smallint, trial_days),
    grace_days = coalesce((p_fields ->> 'grace_days')::smallint, grace_days),
    read_only_days = coalesce((p_fields ->> 'read_only_days')::smallint, read_only_days),
    retention_after_suspension_days = coalesce((p_fields ->> 'retention_after_suspension_days')::smallint, retention_after_suspension_days),
    default_closing_time = coalesce((p_fields ->> 'default_closing_time')::time, default_closing_time),
    vat_rate = coalesce((p_fields ->> 'vat_rate')::numeric, vat_rate),
    invoice_lead_days = coalesce((p_fields ->> 'invoice_lead_days')::smallint, invoice_lead_days),
    quota_alert_percent = coalesce((p_fields ->> 'quota_alert_percent')::smallint, quota_alert_percent),
    request_channels = case when jsonb_typeof(p_fields -> 'request_channels') = 'array'
      then array(select v from jsonb_array_elements_text(p_fields -> 'request_channels') with ordinality e(v, n) order by n)
      else request_channels end,
    signup_code_channel = coalesce(p_fields ->> 'signup_code_channel', signup_code_channel),
    mfa_required = coalesce((p_fields ->> 'mfa_required')::boolean, mfa_required),
    updated_by = (select auth.uid())
  where id;
  perform public.audit(null, 'platform.settings', 'platform_settings', null, p_fields);
end;
$$;

/**
 * Réinitialisation de la double authentification d'un compte (téléphone perdu) par le super admin : facteurs
 * supprimés, l'utilisateur en enregistre un nouveau à sa prochaine connexion. Motif obligatoire, journalisé.
 */
create or replace function public.admin_reset_mfa(p_email text, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_count integer;
begin
  perform public.assert_platform_admin();
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0422'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) and not coalesce(is_anonymous, false);
  if v_user is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  delete from auth.mfa_factors where user_id = v_user;
  get diagnostics v_count = row_count;
  perform public.audit(null, 'security.mfa_reset', 'user', v_user,
    jsonb_build_object('reason', trim(p_reason), 'factors', v_count));
  return v_count;
end;
$$;

/** Double authentification exigée de l'utilisateur connecté : dans au moins un établissement, ou console. */
create or replace function public.my_mfa_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required', public.mfa_required_for(null) or exists (
      select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.active and public.mfa_required_for(m.organization_id)),
    'enrolled', public.has_mfa_factor((select auth.uid())),
    'aal', public.session_aal());
$$;

revoke execute on function public.session_aal(), public.has_mfa_factor(uuid), public.mfa_verified_since(integer),
  public.mfa_required_for(uuid), public.assert_mfa(uuid, boolean), public.guard_membership_mfa(),
  public.guard_invitation_mfa(), public.guard_org_mfa_setting(), public.admin_reset_mfa(text, text), public.my_mfa_status()
from public, anon;
grant execute on function public.admin_reset_mfa(text, text), public.my_mfa_status() to authenticated;
