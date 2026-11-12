-- Resynchronisation de 20261118090000 (disponibilité de la prise en ligne).
-- La base distante a reçu une version provisoire de cette migration (« online_intake_status » : fonctions
-- `org_is_public` et `online_intake_open`, clé `online_available`) ; la CLI ne réapplique jamais un numéro déjà
-- enregistré. Sans `online_open`, les pages client se croyaient toujours ouvertes.
-- Cette migration redéfinit chaque objet à partir de sa définition la plus récente (aucune migration postérieure ne
-- les redéfinit) : fonctions de 20261118090000_online_availability.sql, déclencheur d'écriture de
-- 20261114090000_pricing_v2.sql, droits d'exécution. Deux règles changent, sur toute base :
-- 1. Quota de tickets du mois bloquant : les demandes de rendez-vous en ligne sont fermées aussi (`requests_open`,
--    `request_options.online_open`), et refusées par la base (`monthly_quota_reached`).
-- 2. Établissement suspendu pour impayé (`suspended`, motif `subscription`) : pages publiques toujours visibles, prise
--    en ligne fermée ; suspendu par la modération ou en attente de validation : introuvable (`org_is_public`).

-- ─── Établissement visible sur les pages publiques ───────────────────────────

-- La version provisoire avait sa propre `org_is_public` : remplacée si sa signature diffère (nom des paramètres ou
-- type de retour), ce que `create or replace` ne sait pas faire.
do $$
begin
  if exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.org_is_public(public.org_status, text)')
      and (prorettype <> 'boolean'::regtype or proargnames is distinct from array['p_status', 'p_reason'])
  ) then
    drop function public.org_is_public(public.org_status, text);
  end if;
end;
$$;

/**
 * Établissement visible sur les pages publiques (QR code, agence, demande de rendez-vous) : actif, ou suspendu pour
 * impayé (la page s'ouvre, la prise en ligne est fermée). Suspendu par la modération ou en attente : introuvable.
 */
create or replace function public.org_is_public(p_status public.org_status, p_reason text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status = 'active' or (p_status = 'suspended' and p_reason = 'subscription');
$$;

-- ─── Disponibilité de la prise en ligne (20261118090000) ─────────────────────

/** Prise de ticket en ligne ouverte pour l'établissement (`p_remote` : ticket à distance, fonction de la formule). */
create or replace function public.online_tickets_open(p_org uuid, p_remote boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((e ->> 'can_issue')::boolean, false)
     and not coalesce((public.quota_status(p_org) -> 'tickets' ->> 'blocked')::boolean, false)
     and (not p_remote or coalesce((e -> 'features' ->> 'remote_tickets')::boolean, false))
  from (select public.org_entitlements(p_org) as e) x;
$$;

/**
 * Demandes de rendez-vous en ligne ouvertes pour l'établissement : abonnement actif, fonction de la formule, quota de
 * tickets du mois non bloquant (même règle que `enforce_subscription_on_write` pour `appointment_requests`).
 */
create or replace function public.online_requests_open(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((e ->> 'can_issue')::boolean, false)
     and coalesce((e -> 'features' ->> 'appointments')::boolean, false)
     and not coalesce((public.quota_status(p_org) -> 'tickets' ->> 'blocked')::boolean, false)
  from (select public.org_entitlements(p_org) as e) x;
$$;

revoke execute on function public.online_tickets_open(uuid, boolean), public.online_requests_open(uuid) from public, anon, authenticated;

/** Entrée d'un client (QR code ou code court) : agence, services, files, et prise en ligne possible ou non. */
create or replace function public.resolve_entry(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'entry_code', q.token,
    'source', case when q.token = p_code then 'qr' else 'short_code' end,
    'service_id', q.service_id,
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale, 'type', o.type),
    'branch', jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city, 'is_open', public.branch_is_open(b.id)),
    'priorities_enabled', bs.priorities_enabled,
    'priority_service_ids', coalesce((
      select jsonb_agg(s.id) from public.services s where s.branch_id = b.id and s.active and s.allow_priority
    ), '[]'::jsonb),
    -- Prise de ticket en ligne possible (sans la raison si elle ne l'est pas).
    'online_open', public.online_tickets_open(o.id),
    'board', public.branch_board(b.id)
  )
  from public.qr_codes q
  join public.branches b on b.id = q.branch_id and b.active
  join public.organizations o on o.id = q.organization_id and public.org_is_public(o.status, o.suspended_reason)
  join public.branch_settings bs on bs.branch_id = b.id
  where q.active and (q.token = p_code or q.short_code = upper(trim(p_code)))
  limit 1;
$$;

/** Page publique d'une agence, avec la disponibilité de la prise en ligne. */
create or replace function public.branch_public(p_branch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.branch_summary(b.id, null) || jsonb_build_object(
    'phone_e164', b.phone_e164,
    'timezone', b.timezone,
    'organization', jsonb_build_object('name', o.name, 'type', o.type, 'default_locale', o.default_locale),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at)
        order by h.weekday, h.opens_at)
      from public.opening_hours h where h.branch_id = b.id
    ), '[]'::jsonb),
    'priorities_enabled', bs.priorities_enabled,
    'priority_service_ids', coalesce((
      select jsonb_agg(s.id) from public.services s where s.branch_id = b.id and s.active and s.allow_priority
    ), '[]'::jsonb),
    'remote', jsonb_build_object(
      'enabled', bs.remote_tickets_enabled,
      'service_ids', coalesce((
        select jsonb_agg(s.id) from public.services s where s.branch_id = b.id and s.active and s.allow_remote
      ), '[]'::jsonb),
      'max_distance_km', bs.remote_max_distance_km,
      'confirm_threshold', bs.remote_confirm_threshold,
      'penalty_places', bs.remote_penalty_places,
      'max_delays', bs.remote_max_delays
    ),
    -- Ticket à distance et demande de rendez-vous possibles (sans la raison si elles ne le sont pas).
    'online_open', public.online_tickets_open(o.id, true),
    'requests_open', public.online_requests_open(o.id),
    'board', public.branch_board(b.id)
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id and public.org_is_public(o.status, o.suspended_reason)
  join public.branch_settings bs on bs.branch_id = b.id and bs.public_listing_enabled
  where b.id = p_branch and b.active;
$$;

/** Formulaire de demande de rendez-vous, avec la disponibilité des demandes en ligne. */
create or replace function public.request_options(p_branch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bs public.branch_settings;
  v_tz text;
  v_today date;
begin
  -- Comme `assert_requests_open`, mais visible aussi pour un établissement suspendu pour impayé (formulaire fermé) ;
  -- `assert_requests_open` garde la règle stricte pour les écritures.
  select bs.* into v_bs
  from public.branch_settings bs
  join public.branches b on b.id = bs.branch_id and b.active
  join public.organizations o on o.id = b.organization_id and public.org_is_public(o.status, o.suspended_reason)
  where bs.branch_id = p_branch;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not v_bs.appointment_requests_enabled then raise exception 'requests_disabled' using errcode = 'P0422'; end if;
  select timezone into v_tz from public.branches where id = p_branch;
  v_today := (now() at time zone v_tz)::date;
  return jsonb_build_object(
    'branch', public.branch_summary(p_branch, null) - 'services',
    'timezone', v_tz,
    'days', v_bs.appointment_request_days,
    'online_open', public.online_requests_open((select organization_id from public.branches where id = p_branch)),
    -- Canaux du code et des réponses, dans l'ordre de préférence (console Wintek).
    'channels', (select to_jsonb(request_channels) from public.platform_settings),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color,
        'practitioners', (
          select jsonb_agg(distinct jsonb_build_object('id', p.id, 'name', public.practitioner_label(p.id)))
          from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
          where ps.service_id = s.id
        )
      ) order by s.sort_order, s.prefix)
      from public.services s
      where s.branch_id = p_branch and s.active
        and exists (select 1 from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
                    where ps.service_id = s.id)
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', f.starts_at, 'practitioner_id', p.id, 'service_id', f.service_id)
        order by f.starts_at, p.id)
      from public.practitioners p
      cross join lateral public.practitioner_free_slots(p.id, v_today, v_bs.appointment_request_days) f
      where p.branch_id = p_branch and p.active
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Écriture refusée selon l'abonnement (20261114090000_pricing_v2, + quota pour les demandes) ───

/**
 * Émission de tickets et rendez-vous selon l'abonnement : rien en lecture seule ou suspendu ; ticket à distance et
 * rendez-vous si la formule les comprend ; tickets du mois : jamais de blocage le jour où la limite est atteinte (la
 * file continue jusqu'à la fermeture), refus (`monthly_quota_reached`) à partir du lendemain. Une réorientation ne
 * crée pas de nouvelle demande : jamais refusée. Même refus pour une demande de rendez-vous en ligne (le patient
 * passerait un ticket à son arrivée) ; un rendez-vous pris par l'accueil reste possible.
 */
create or replace function public.enforce_subscription_on_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e jsonb := public.org_entitlements(new.organization_id);
begin
  if not (v_e ->> 'can_issue')::boolean then
    raise exception 'subscription_read_only' using errcode = 'P0410';
  end if;
  -- Conditions imbriquées : plpgsql évaluerait `new.source` même sur une table qui n'a pas cette colonne.
  if tg_table_name = 'tickets' then
    if new.transferred_from_id is null then
      if coalesce((public.quota_status(new.organization_id) -> 'tickets' ->> 'blocked')::boolean, false) then
        raise exception 'monthly_quota_reached' using errcode = 'P0410', detail = 'tickets';
      end if;
      if new.source = 'remote' then
        perform public.assert_feature(new.organization_id, 'remote_tickets');
      end if;
    end if;
  elsif tg_table_name in ('appointments', 'appointment_requests') then
    perform public.assert_feature(new.organization_id, 'appointments');
    if tg_table_name = 'appointment_requests'
       and coalesce((public.quota_status(new.organization_id) -> 'tickets' ->> 'blocked')::boolean, false) then
      raise exception 'monthly_quota_reached' using errcode = 'P0410', detail = 'tickets';
    end if;
  end if;
  return new;
end;
$$;

-- Déclencheurs (définitions de 20261108090100_m10a_billing, inchangées) : recréés s'ils manquent.
drop trigger if exists tickets_subscription on public.tickets;
create trigger tickets_subscription before insert on public.tickets
  for each row execute function public.enforce_subscription_on_write();
drop trigger if exists appointments_subscription on public.appointments;
create trigger appointments_subscription before insert on public.appointments
  for each row execute function public.enforce_subscription_on_write();
drop trigger if exists appointment_requests_subscription on public.appointment_requests;
create trigger appointment_requests_subscription before insert on public.appointment_requests
  for each row execute function public.enforce_subscription_on_write();

-- ─── Droits d'exécution (état attendu, vérifié par security.test.sql) ────────

-- Calculs internes : base et service role seulement (jamais les pages client, qui ne voient que le booléen).
revoke execute on function public.online_tickets_open(uuid, boolean), public.online_requests_open(uuid),
  public.enforce_subscription_on_write() from public, anon, authenticated;
grant execute on function public.online_tickets_open(uuid, boolean), public.online_requests_open(uuid),
  public.enforce_subscription_on_write() to service_role;
revoke execute on function public.org_is_public(public.org_status, text) from public, anon, authenticated;
grant execute on function public.org_is_public(public.org_status, text) to service_role;
-- Pages publiques (sans compte) et sessions anonymes des clients.
revoke execute on function public.resolve_entry(text), public.branch_public(uuid), public.request_options(uuid) from public;
grant execute on function public.resolve_entry(text), public.branch_public(uuid), public.request_options(uuid)
  to anon, authenticated, service_role;

-- ─── Fonctions de la version provisoire ──────────────────────────────────────

-- `online_intake_open` et les autres variantes d'`org_is_public` (base distante seulement) : supprimées si plus rien
-- ne les appelle (fonctions, vues, policies) ; sinon gardées, avec un avertissement dans le journal de la migration.
do $$
declare
  v_fn record;
  v_users text;
begin
  for v_fn in
    select p.oid, p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('org_is_public', 'online_intake_open')
      and p.oid is distinct from to_regprocedure('public.org_is_public(public.org_status, text)')
  loop
    select string_agg(u, ', ') into v_users from (
      select p.oid::regprocedure::text as u
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema')
        and p.oid <> v_fn.oid
        and p.oid is distinct from to_regprocedure('public.org_is_public(public.org_status, text)')
        and p.proname <> 'online_intake_open'
        -- Redéfinies ci-dessus : elles appellent la nouvelle `org_is_public(status, motif)`, pas l'ancienne.
        and p.proname not in ('resolve_entry', 'branch_public', 'request_options')
        and p.prosrc ~ ('\m' || v_fn.proname || '\M')
      union all
      select c.oid::regclass::text
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('v', 'm') and n.nspname not in ('pg_catalog', 'information_schema')
        and pg_get_viewdef(c.oid) ~ ('\m' || v_fn.proname || '\M')
      union all
      select format('policy %s on %s', pol.polname, pol.polrelid::regclass)
      from pg_policy pol
      where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
        ~ ('\m' || v_fn.proname || '\M')
    ) x;
    if v_users is null then
      execute format('drop function %s', v_fn.sig);
    else
      raise warning '% gardée : encore utilisée par %', v_fn.sig, v_users;
    end if;
  end loop;
end;
$$;
