-- Backlog (après M10b) : choix des agences des formules plafonnées (ou tirage équitable), liste des agences ciblées
-- visible avant le paiement, comptes « caissier » d'un annonceur (validation des bons seulement).

-- ═════════════════════════════════════════════════════════════════════════════
-- Agences choisies par l'annonceur
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.ad_campaigns add column chosen_branches uuid[] not null default '{}';
comment on column public.ad_campaigns.chosen_branches is
  'Agences choisies par l''annonceur (formules plafonnées), au plus le plafond de la formule ; vide : tirage équitable.';

/** Agences correspondant au ciblage d'une campagne (actives, établissement actif, secteur non refusé). */
create or replace function public.campaign_eligible_branches(p_campaign uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.ad_campaigns c
  join public.branches b on true
  join public.organizations o on o.id = b.organization_id
  left join public.organization_ad_preferences p on p.organization_id = o.id
  where c.id = p_campaign and b.active and o.status = 'active'
    and (case when c.organization_id is not null then o.id = c.organization_id
         else (cardinality(c.target_cities) = 0 or lower(b.city) = any (array(select lower(x) from unnest(c.target_cities) x)))
          and (cardinality(c.target_org_types) = 0 or o.type = any (c.target_org_types))
          and not (c.sector = any (coalesce(p.blocked_sectors, '{}'))) end);
$$;

/**
 * Ciblage d'une campagne (à la validation, puis à chaque changement) : agences choisies par l'annonceur parmi celles
 * qui correspondent au ciblage ; sans choix, tirage équitable (aléatoire) dans la limite du plafond de la formule.
 */
create or replace function public.target_campaign_branches(p_campaign uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
  v_max integer;
  v_n integer;
begin
  select * into v_c from public.ad_campaigns where id = p_campaign;
  select max_branches into v_max from public.ad_packages where code = v_c.package_code;
  delete from public.ad_campaign_branches where campaign_id = p_campaign;
  insert into public.ad_campaign_branches (campaign_id, branch_id)
  select p_campaign, e.id
  from public.campaign_eligible_branches(p_campaign) e(id)
  where cardinality(v_c.chosen_branches) = 0 or e.id = any (v_c.chosen_branches)
  order by random()
  limit v_max;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

/**
 * Agences proposées au choix (formule plafonnée) : celles du ciblage, visibles dans « À proximité » (information
 * publique), avec le choix en cours. Membres de l'annonceur.
 */
create or replace function public.campaign_branch_options(p_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns;
begin
  select * into v_c from public.ad_campaigns where id = p_campaign;
  if not found or v_c.advertiser_id is null or not public.is_advertiser_member(v_c.advertiser_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city, 'organization', o.name, 'type', o.type,
      'chosen', b.id = any (v_c.chosen_branches)) order by b.city nulls last, o.name, b.name)
    from public.campaign_eligible_branches(p_campaign) e(id)
    join public.branches b on b.id = e.id
    join public.organizations o on o.id = b.organization_id
    join public.branch_settings s on s.branch_id = b.id and s.public_listing_enabled
  ), '[]'::jsonb);
end;
$$;

/** Choix des agences (campagne modifiable, au plus le plafond de la formule, parmi les agences proposées). */
create or replace function public.set_campaign_branches(p_campaign uuid, p_branches uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.ad_campaigns := public.lock_campaign_for_edit(p_campaign);
  v_max integer;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_branches, '{}')) x);
begin
  if v_c.advertiser_id is null then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  select max_branches into v_max from public.ad_packages where code = v_c.package_code;
  if v_max is null or cardinality(v_ids) > v_max then raise exception 'too_many_branches' using errcode = 'P0422'; end if;
  if exists (
    select 1 from unnest(v_ids) x
    where x not in (select (o ->> 'id')::uuid from jsonb_array_elements(public.campaign_branch_options(p_campaign)) o)
  ) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  update public.ad_campaigns set chosen_branches = v_ids where id = v_c.id;
  return cardinality(v_ids);
end;
$$;

/**
 * Agences où la campagne est (ou sera) diffusée, affichées avant le paiement : agences publiques nommées, les autres
 * seulement comptées. Membres de l'annonceur, établissement (annonce Maison), super admin.
 */
create or replace function public.campaign_branch_list(p_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_view_campaign(p_campaign) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object('name', b.name, 'city', b.city, 'organization', o.name) order by b.city nulls last, o.name, b.name)
      from public.ad_campaign_branches cb
      join public.branches b on b.id = cb.branch_id
      join public.organizations o on o.id = b.organization_id
      join public.branch_settings s on s.branch_id = b.id and s.public_listing_enabled
      where cb.campaign_id = p_campaign), '[]'::jsonb),
    'others', (select count(*) from public.ad_campaign_branches cb
               join public.branch_settings s on s.branch_id = cb.branch_id and not s.public_listing_enabled
               where cb.campaign_id = p_campaign));
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Caissiers : validation des bons, sans accès aux campagnes ni aux factures
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.advertiser_members drop constraint advertiser_members_role_check;
alter table public.advertiser_members add constraint advertiser_members_role_check check (role in ('owner', 'editor', 'cashier'));

/** Membre de l'annonceur ; sans rôle précisé : propriétaires et éditeurs (les caissiers ne voient que les bons). */
create or replace function public.is_advertiser_member(p_advertiser uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_anonymous() and exists (
    select 1 from public.advertiser_members m
    where m.advertiser_id = p_advertiser and m.user_id = (select auth.uid())
      and (case when p_roles is null then m.role <> 'cashier' else m.role = any (p_roles) end)
  );
$$;

drop policy advertisers_select on public.advertisers;
create policy advertisers_select on public.advertisers for select to authenticated
  using (public.is_advertiser_member(id, array['owner', 'editor', 'cashier']) or public.is_platform_admin());

-- Chaque membre lit sa propre adhésion (rôle affiché dans l'espace annonceur) ; propriétaires et éditeurs, toutes.
drop policy advertiser_members_select on public.advertiser_members;
create policy advertiser_members_select on public.advertiser_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_advertiser_member(advertiser_id) or public.is_platform_admin());

/** Ajout d'un caissier par le propriétaire : compte NextIn existant (adresse e-mail), rôle limité aux bons. */
create or replace function public.add_advertiser_cashier(p_advertiser uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_advertiser_member(p_advertiser, array['owner']) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) and not coalesce(is_anonymous, false);
  if v_user is null then raise exception 'user_not_found' using errcode = 'P0404'; end if;
  insert into public.advertiser_members (advertiser_id, user_id, role) values (p_advertiser, v_user, 'cashier')
  on conflict (advertiser_id, user_id) do nothing;
  perform public.audit(null, 'advertiser.cashier_add', 'advertiser', p_advertiser, jsonb_build_object('user_id', v_user));
  return v_user;
end;
$$;

/** Retrait d'un caissier (propriétaire). */
create or replace function public.remove_advertiser_cashier(p_advertiser uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_advertiser_member(p_advertiser, array['owner']) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.advertiser_members where advertiser_id = p_advertiser and user_id = p_user and role = 'cashier';
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.audit(null, 'advertiser.cashier_remove', 'advertiser', p_advertiser, jsonb_build_object('user_id', p_user));
end;
$$;

/** Caissiers d'un annonceur (propriétaire) : adresse e-mail pour les reconnaître. */
create or replace function public.advertiser_cashiers(p_advertiser uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_advertiser_member(p_advertiser, array['owner']) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'since', m.created_at) order by m.created_at)
    from public.advertiser_members m join auth.users u on u.id = m.user_id
    where m.advertiser_id = p_advertiser and m.role = 'cashier'), '[]'::jsonb);
end;
$$;

/**
 * Validation d'un bon en caisse : propriétaires, éditeurs et caissiers de l'annonceur, ou personnel de l'établissement
 * pour une annonce Maison. `p_confirm = false` : consultation avant validation.
 */
create or replace function public.redeem_coupon(p_code text, p_confirm boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.ad_coupons;
  v_c public.ad_campaigns;
begin
  select * into v_k from public.ad_coupons
  where (char_length(p_code) = 22 and qr_token = p_code) or (char_length(p_code) = 8 and code = upper(p_code))
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_c from public.ad_campaigns where id = v_k.campaign_id;
  if not ((v_c.advertiser_id is not null and public.is_advertiser_member(v_c.advertiser_id, array['owner', 'editor', 'cashier']))
          or (v_c.organization_id is not null and not public.is_anonymous()
              and public.has_org_role(v_c.organization_id, array['org_admin', 'branch_manager', 'receptionist']::public.member_role[]))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_confirm then
    if v_k.redeemed_at is not null then raise exception 'coupon_redeemed' using errcode = 'P0409'; end if;
    if v_k.expires_at < now() then raise exception 'coupon_expired' using errcode = 'P0410'; end if;
    update public.ad_coupons set redeemed_at = now(), redeemed_by = (select auth.uid()) where id = v_k.id returning * into v_k;
  end if;
  return jsonb_build_object('code', v_k.code, 'reward', v_k.reward_text, 'reward_en', v_k.reward_text_en, 'expires_at', v_k.expires_at,
    'redeemed_at', v_k.redeemed_at, 'campaign', v_c.name, 'expired', v_k.expires_at < now());
end;
$$;

revoke execute on function public.campaign_eligible_branches(uuid) from public, anon, authenticated;
grant execute on function public.campaign_branch_options(uuid), public.set_campaign_branches(uuid, uuid[]), public.campaign_branch_list(uuid),
  public.add_advertiser_cashier(uuid, text), public.remove_advertiser_cashier(uuid, uuid), public.advertiser_cashiers(uuid)
to authenticated;
