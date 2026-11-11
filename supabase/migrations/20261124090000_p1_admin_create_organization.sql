-- ═════════════════════════════════════════════════════════════════════════════
-- P1 — Création d'un établissement depuis la console Wintek, pour un client : formule, durée d'essai,
-- première agence, services d'un modèle, invitation du responsable (administrateur) par e-mail.
-- Ajout seulement : nouvelle fonction, aucune table ni colonne modifiée (compatible avec le code en ligne).
-- ═════════════════════════════════════════════════════════════════════════════

/**
 * Le super admin n'est jamais membre de l'établissement créé : le responsable le devient en acceptant
 * l'invitation (lien envoyé par l'application, jeton renvoyé une seule fois, seule son empreinte est stockée).
 * Abonnement en essai sur la formule choisie, adresse du responsable réservée (pas de second essai par
 * l'inscription en libre-service). Motif obligatoire, journalisé.
 *
 * p_fields : name, type, locale, slug, plan_id, trial_days, owner_email, owner_phone (facultatif), branch_name,
 * branch_city (facultatif), services [{ name, name_en, prefix, seconds, color }], reason.
 */
create or replace function public.admin_create_organization(p_fields jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_name text := trim(coalesce(p_fields ->> 'name', ''));
  v_type public.org_type;
  v_locale text := case when p_fields ->> 'locale' = 'en' then 'en' else 'fr' end;
  v_slug text := lower(trim(coalesce(p_fields ->> 'slug', '')));
  v_plan public.plans;
  v_trial_days integer;
  v_email text := lower(trim(coalesce(p_fields ->> 'owner_email', '')));
  v_phone text := nullif(trim(coalesce(p_fields ->> 'owner_phone', '')), '');
  v_branch_name text := trim(coalesce(p_fields ->> 'branch_name', ''));
  v_city text := nullif(trim(coalesce(p_fields ->> 'branch_city', '')), '');
  v_reason text := trim(coalesce(p_fields ->> 'reason', ''));
  v_services jsonb := coalesce(p_fields -> 'services', '[]'::jsonb);
  v_service jsonb;
  v_prefixes text[] := '{}';
  v_prefix text;
  v_seconds integer;
  v_org uuid;
  v_branch uuid;
  v_sub uuid;
  v_token text;
  v_invitation uuid;
  v_sort integer := 0;
begin
  perform public.assert_platform_admin();

  -- ─── Validation (mêmes règles que le formulaire, schéma adminCreateOrganization) ─────
  if char_length(v_reason) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  begin
    v_type := (p_fields ->> 'type')::public.org_type;
  exception when invalid_text_representation then
    raise exception 'invalid_type' using errcode = '22023';
  end;
  if v_type is null then raise exception 'invalid_type' using errcode = '22023'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 48 then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  select * into v_plan from public.plans where id = (p_fields ->> 'plan_id')::uuid and active;
  if not found then raise exception 'invalid_plan' using errcode = '22023'; end if;
  v_trial_days := (p_fields ->> 'trial_days')::integer;
  if v_trial_days is null or v_trial_days not between 1 and 365 then raise exception 'invalid_trial_days' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+237[26][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if char_length(v_branch_name) not between 2 and 80 then raise exception 'invalid_branch' using errcode = '22023'; end if;
  if jsonb_typeof(v_services) <> 'array' or jsonb_array_length(v_services) > 12 then
    raise exception 'invalid_services' using errcode = '22023';
  end if;
  for v_service in select value from jsonb_array_elements(v_services) loop
    v_prefix := upper(trim(coalesce(v_service ->> 'prefix', '')));
    v_seconds := (v_service ->> 'seconds')::integer;
    if v_prefix !~ '^[A-Z]{1,2}$' or v_prefix = any (v_prefixes)
       or char_length(trim(coalesce(v_service ->> 'name', ''))) not between 2 and 80
       or char_length(coalesce(v_service ->> 'name_en', '')) > 80
       or v_seconds is null or v_seconds not between 60 and 7200
       or coalesce(v_service ->> 'color', '') !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'invalid_services' using errcode = '22023';
    end if;
    v_prefixes := v_prefixes || v_prefix;
  end loop;

  -- Adresse unique : jamais deux établissements au même identifiant d'URL (suffixe aléatoire si pris).
  if exists (select 1 from public.organizations where slug = v_slug) then
    v_slug := left(v_slug, 43) || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4);
  end if;

  -- ─── Établissement, abonnement (avant les services : limites de la formule appliquées) ─────
  insert into public.organizations (name, slug, type, default_locale, created_by, phone_e164, validated_at, validated_by)
  values (v_name, v_slug, v_type, v_locale, v_admin, v_phone, now(), v_admin)
  returning id into v_org;

  insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at, billing_phone_e164, billing_email, locale)
  values (v_org, v_plan.id, 'trialing', now() + make_interval(days => v_trial_days), v_phone, v_email, v_locale)
  returning id into v_sub;
  insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
  values (v_sub, v_org, 'trial_started', v_admin,
    jsonb_build_object('trial_days', v_trial_days, 'created_by', 'platform_admin', 'reason', v_reason));
  -- Un seul essai par adresse : l'inscription en libre-service avec la même adresse n'en ouvrira pas un second.
  insert into public.trial_email_claims (email_hash, organization_id)
  values (public.email_fingerprint(v_email), v_org) on conflict (email_hash) do nothing;

  -- ─── Première agence et services du modèle ─────
  v_branch := public.create_branch(v_org, v_branch_name, null, v_city);
  for v_service in select value from jsonb_array_elements(v_services) loop
    v_sort := v_sort + 1;
    insert into public.services (organization_id, branch_id, name, name_en, prefix, color, default_service_seconds, sort_order)
    values (v_org, v_branch, trim(v_service ->> 'name'), nullif(trim(coalesce(v_service ->> 'name_en', '')), ''),
      upper(trim(v_service ->> 'prefix')), v_service ->> 'color', (v_service ->> 'seconds')::integer, v_sort);
  end loop;

  -- ─── Invitation du responsable (administrateur de l'établissement), 7 jours ─────
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.invitations (organization_id, email, role, token_hash, invited_by)
  values (v_org, v_email, 'org_admin', encode(extensions.digest(v_token, 'sha256'), 'hex'), v_admin)
  returning id into v_invitation;

  perform public.audit(v_org, 'org.create_by_platform', 'organization', v_org,
    jsonb_build_object('plan', v_plan.code, 'trial_days', v_trial_days, 'type', v_type,
      'services', jsonb_array_length(v_services), 'reason', v_reason));
  perform public.audit(v_org, 'member.invite', 'invitation', v_invitation, jsonb_build_object('role', 'org_admin', 'branch_id', null));

  return jsonb_build_object('organization_id', v_org, 'branch_id', v_branch, 'subscription_id', v_sub,
    'invitation_id', v_invitation, 'token', v_token, 'slug', v_slug);
end;
$$;

revoke execute on function public.admin_create_organization(jsonb) from public, anon;
grant execute on function public.admin_create_organization(jsonb) to authenticated;
