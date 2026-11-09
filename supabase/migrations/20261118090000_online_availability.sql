-- Pages client (/q, /b, /b/…/rdv) : la prise de ticket ou de rendez-vous en ligne indisponible est connue dès
-- l'ouverture de la page (établissement en lecture seule ou suspendu, quota de tickets du mois bloquant, fonction
-- absente de la formule). Un seul booléen public, `online_open` : jamais la raison (abonnement, paiement, quota),
-- réservée au personnel. La base continue de refuser l'écriture (`enforce_subscription_on_write`).

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

/** Demandes de rendez-vous en ligne ouvertes pour l'établissement (abonnement actif, fonction de la formule). */
create or replace function public.online_requests_open(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((e ->> 'can_issue')::boolean, false) and coalesce((e -> 'features' ->> 'appointments')::boolean, false)
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
  join public.organizations o on o.id = q.organization_id and o.status = 'active'
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
  join public.organizations o on o.id = b.organization_id and o.status = 'active'
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
  v_bs := public.assert_requests_open(p_branch);
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
