-- M7 — Notifications : WhatsApp (Cloud API), web push en complément, SMS en secours (docs/PLAN.md §3.5, §5.5).
-- Les messages sont mis en file par des déclencheurs SQL (`notification_jobs`), puis envoyés par l'expéditeur
-- (`POST /api/notifications/dispatch`), réveillé par pg_net à chaque mise en file et par pg_cron chaque minute.
-- Jamais de nom de client : un message ne contient que le numéro de ticket, l'établissement, le poste et l'attente.

create extension if not exists pg_net;

create type public.notif_event as enum (
  'ticket_confirmed', 'almost_your_turn', 'your_turn', 'ticket_moved_back', 'practitioner_rerouted', 'practitioner_late'
);
create type public.notif_channel as enum ('whatsapp', 'push', 'sms');
create type public.job_status as enum ('pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled');

-- ─── Contacts : opt-in WhatsApp du client et abonnements web push ───────────

alter table public.notification_contacts drop constraint notification_contacts_channel_check;
alter table public.notification_contacts drop constraint notification_contacts_phone_e164_check;
alter table public.notification_contacts
  add column wa_id text check (wa_id ~ '^[1-9][0-9]{7,14}$'),
  add column push_subscription jsonb,
  -- Fenêtre de 24 h ouverte par le dernier message du client : messages libres ; hors fenêtre, modèles approuvés.
  add column window_expires_at timestamptz,
  add constraint notification_contacts_channel_check check (channel in ('whatsapp', 'push')),
  -- E.164 : +237 à l'accueil (vérifié par la RPC), tout pays pour un client qui écrit depuis WhatsApp.
  add constraint notification_contacts_phone_e164_check check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint notification_contacts_target_check check (
    (channel = 'whatsapp' and phone_e164 is not null)
    or (channel = 'push' and push_subscription ? 'endpoint' and phone_e164 is null)
  );
create unique index notification_contacts_whatsapp_uidx on public.notification_contacts (ticket_id, phone_e164) where channel = 'whatsapp';
create unique index notification_contacts_push_uidx on public.notification_contacts (ticket_id, (push_subscription ->> 'endpoint'))
  where channel = 'push';
create index notification_contacts_wa_id_idx on public.notification_contacts (wa_id) where wa_id is not null;

-- STOP global : respecté pour tout ticket futur. Numéro haché (SHA-256), conservé malgré la purge (§10.4).
create table public.whatsapp_opt_outs (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  opted_out_at timestamptz not null default now()
);

-- ─── File d'envoi ────────────────────────────────────────────────────────────

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  ticket_id uuid not null,
  contact_id uuid references public.notification_contacts (id) on delete set null,
  event public.notif_event not null,
  channel public.notif_channel not null,
  status public.job_status not null default 'pending',
  attempt smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  dedupe_key text not null unique,
  provider_message_id text,
  template_name text,
  -- Données propres à l'événement (ex. heure de retour du praticien) puis texte envoyé ; jamais de numéro ni de nom.
  payload jsonb not null default '{}'::jsonb,
  error text,
  -- SMS de secours : job WhatsApp d'origine ; `guard` = délai de garde (envoyé seulement si l'original n'est pas remis).
  fallback_of uuid references public.notification_jobs (id) on delete set null,
  guard boolean not null default false,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade,
  foreign key (organization_id, ticket_id) references public.tickets (organization_id, id) on delete cascade
);
create index notification_jobs_due_idx on public.notification_jobs (next_attempt_at) where status in ('pending', 'sending');
create index notification_jobs_provider_idx on public.notification_jobs (provider_message_id) where provider_message_id is not null;
create index notification_jobs_ticket_idx on public.notification_jobs (ticket_id);
create trigger notification_jobs_set_updated_at before update on public.notification_jobs
  for each row execute function public.set_updated_at();

-- Journal brut des webhooks et idempotence (un événement fournisseur n'est traité qu'une fois).
create table public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('whatsapp')),
  event_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index provider_webhook_events_received_idx on public.provider_webhook_events (received_at);

-- ─── Réveil de l'expéditeur (pg_net) ─────────────────────────────────────────

/**
 * Adresse et secret de l'expéditeur, rangés dans Supabase Vault par `pnpm notify:configure`
 * (URL construite depuis APP_URL, jamais écrite en dur). Réservé au service role.
 */
create or replace function public.configure_notification_dispatch(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_url !~ '^https?://' or length(coalesce(p_secret, '')) < 32 then
    raise exception 'invalid_dispatch_config' using errcode = 'P0422';
  end if;
  select id into v_id from vault.secrets where name = 'nextin_dispatch_url';
  if v_id is null then perform vault.create_secret(p_url, 'nextin_dispatch_url');
  else perform vault.update_secret(v_id, p_url); end if;
  v_id := null;
  select id into v_id from vault.secrets where name = 'nextin_dispatch_secret';
  if v_id is null then perform vault.create_secret(p_secret, 'nextin_dispatch_secret');
  else perform vault.update_secret(v_id, p_secret); end if;
end;
$$;

/** Réveille l'expéditeur (une fois par transaction) ; sans configuration, la tâche pg_cron ou le mode dev s'en charge. */
create or replace function public.kick_notification_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if coalesce(current_setting('nextin.dispatch_kicked', true), '') = '1' then return; end if;
  perform set_config('nextin.dispatch_kicked', '1', true);
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'nextin_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'nextin_dispatch_secret';
  if v_url is null or v_secret is null then return; end if;
  -- Requête asynchrone, envoyée après validation de la transaction.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  -- Jamais d'échec d'une commande de file à cause du réveil : la tâche pg_cron reprendra les envois.
  null;
end;
$$;

/** Tâche minute : reprend les envois dus (relances, délais de garde SMS, réveils perdus). */
create or replace function public.notification_dispatch_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.notification_jobs
    where (status = 'pending' and next_attempt_at <= now()) or (status = 'sending' and updated_at < now() - interval '2 minutes')
  ) then
    perform public.kick_notification_dispatch();
  end if;
end;
$$;

-- ─── Mise en file ────────────────────────────────────────────────────────────

/** Un job par contact actif du ticket (clé de déduplication suffixée par le contact). Renvoie le nombre de jobs créés. */
create or replace function public.enqueue_ticket_notification(
  p_ticket uuid,
  p_event public.notif_event,
  p_dedupe text,
  p_payload jsonb default '{}'::jsonb,
  p_status public.job_status default 'pending'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification_jobs (organization_id, branch_id, ticket_id, contact_id, event, channel, status, dedupe_key, payload, error)
  select c.organization_id, c.branch_id, c.ticket_id, c.id, p_event, c.channel::text::public.notif_channel, p_status,
         p_dedupe || ':' || c.id, p_payload, case when p_status = 'skipped' then 'covered_by_confirmation' end
  from public.notification_contacts c
  where c.ticket_id = p_ticket and c.opted_out_at is null
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  if v_count > 0 and p_status = 'pending' then perform public.kick_notification_dispatch(); end if;
  return v_count;
end;
$$;

/** « Bientôt votre tour » : tickets suivis d'un service dont il reste au plus `almost_turn_threshold` personnes devant. */
create or replace function public.enqueue_almost_your_turn(p_service uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket record;
begin
  for v_ticket in
    select distinct t.id
    from public.tickets t
    join public.notification_contacts c on c.ticket_id = t.id and c.opted_out_at is null
    join public.branch_settings bs on bs.branch_id = t.branch_id
    where t.service_id = p_service and t.status = 'waiting'
      and public.ticket_position(t.id) - 1 <= bs.almost_turn_threshold
  loop
    perform public.enqueue_ticket_notification(v_ticket.id, 'almost_your_turn', 'almost:' || v_ticket.id);
  end loop;
end;
$$;

/** Événements de ticket → messages (appel, rappel, recul, réorientation), puis contrôle « bientôt votre tour ». */
create or replace function public.ticket_events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = new.ticket_id;
  if not found then return null; end if;
  if not exists (select 1 from public.notification_contacts c where c.branch_id = v_ticket.branch_id) then
    return null;
  end if;
  case new.type
    when 'called' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'your_turn', 'your_turn:' || v_ticket.id || ':0');
    when 'recalled' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'your_turn', 'your_turn:' || v_ticket.id || ':' || v_ticket.recall_count);
    when 'moved_back' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'ticket_moved_back', 'moved_back:' || new.id);
    when 'rerouted' then
      perform public.enqueue_ticket_notification(v_ticket.id, 'practitioner_rerouted', 'rerouted:' || new.id);
    else
      null;
  end case;
  perform public.enqueue_almost_your_turn(v_ticket.service_id);
  return null;
end;
$$;

create trigger ticket_events_notify after insert on public.ticket_events
  for each row execute function public.ticket_events_notify();

/** Retard d'un praticien : ses patients en attente sont prévenus de l'heure de retour. */
create or replace function public.practitioner_absences_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket record;
begin
  if new.kind <> 'late' then return null; end if;
  for v_ticket in
    select t.id from public.tickets t
    join public.counters c on c.id = t.preferred_counter_id
    where c.default_practitioner_id = new.practitioner_id and t.status = 'waiting'
  loop
    perform public.enqueue_ticket_notification(v_ticket.id, 'practitioner_late', 'late:' || new.id || ':' || v_ticket.id,
      jsonb_build_object('until', new.until));
  end loop;
  return null;
end;
$$;

create trigger practitioner_absences_notify after insert on public.practitioner_absences
  for each row execute function public.practitioner_absences_notify();

/**
 * Nouveau contact : confirmation (ticket en attente) ; si le ticket est déjà proche, « bientôt votre tour »
 * est couvert par la confirmation (job marqué `skipped`). La page « Mon ticket » est rediffusée (alertes activées).
 */
create or replace function public.notification_contacts_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = new.ticket_id;
  if tg_op = 'INSERT' and v_ticket.status = 'waiting' and new.opted_out_at is null then
    insert into public.notification_jobs (organization_id, branch_id, ticket_id, contact_id, event, channel, dedupe_key)
    values (new.organization_id, new.branch_id, new.ticket_id, new.id, 'ticket_confirmed', new.channel::text::public.notif_channel,
            'confirmed:' || new.id)
    on conflict (dedupe_key) do nothing;
    if public.ticket_position(v_ticket.id) - 1 <= (select almost_turn_threshold from public.branch_settings where branch_id = v_ticket.branch_id) then
      insert into public.notification_jobs (organization_id, branch_id, ticket_id, contact_id, event, channel, status, dedupe_key, error)
      values (new.organization_id, new.branch_id, new.ticket_id, new.id, 'almost_your_turn', new.channel::text::public.notif_channel,
              'skipped', 'almost:' || new.ticket_id || ':' || new.id, 'covered_by_confirmation')
      on conflict (dedupe_key) do nothing;
    end if;
    perform public.kick_notification_dispatch();
  end if;
  if v_ticket.public_token is not null then
    perform public.broadcast('ticket:' || v_ticket.public_token, 'ticket', public.ticket_view(v_ticket.id), false);
  end if;
  return null;
end;
$$;

create trigger notification_contacts_changed after insert or update of opted_out_at, wa_id on public.notification_contacts
  for each row execute function public.notification_contacts_changed();

-- ─── Vue client : alertes activées ───────────────────────────────────────────

create or replace function public.ticket_view(p_ticket uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'display_code', t.display_code,
    'status', t.status,
    'source', t.source,
    'priority_reason', t.priority_reason,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'name_en', s.name_en, 'prefix', s.prefix, 'color', s.color),
    'branch', jsonb_build_object('id', b.id, 'name', b.name),
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
    'position', case when t.status = 'waiting' then public.ticket_position(t.id) end,
    'wait_seconds', case when t.status = 'waiting' then public.ticket_wait_seconds(t.id) end,
    'practitioner_late_until', case when t.status = 'waiting' then public.ticket_practitioner_late_until(t.id) end,
    'counter', case when c.id is not null then jsonb_build_object('kind', c.kind, 'number', c.number, 'label', c.label) end,
    'called_at', t.called_at,
    'serving_started_at', t.serving_started_at,
    'finished_at', t.finished_at,
    'rating', t.rating,
    'rating_enabled', bs.rating_enabled,
    'created_at', t.created_at,
    -- Canaux d'alerte actifs (booléens seulement : aucun numéro).
    'alerts', jsonb_build_object(
      'whatsapp', exists (select 1 from public.notification_contacts n where n.ticket_id = t.id and n.channel = 'whatsapp' and n.opted_out_at is null),
      'push', exists (select 1 from public.notification_contacts n where n.ticket_id = t.id and n.channel = 'push' and n.opted_out_at is null)
    )
  )
  from public.tickets t
  join public.services s on s.id = t.service_id
  join public.branches b on b.id = t.branch_id
  join public.organizations o on o.id = t.organization_id
  join public.branch_settings bs on bs.branch_id = t.branch_id
  left join public.counters c on c.id = t.counter_id
  where t.id = p_ticket;
$$;

-- ─── Expéditeur (service role) ───────────────────────────────────────────────

/**
 * Réserve jusqu'à `p_limit` jobs dus (`sending`, tentative + 1) et renvoie tout le nécessaire à l'envoi :
 * contact, vue du ticket, jeton du lien, STOP global, statut du job d'origine pour un délai de garde.
 * Un job resté `sending` plus de 2 minutes (expéditeur interrompu) est repris.
 */
create or replace function public.claim_notification_jobs(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with picked as (
    select j.id from public.notification_jobs j
    where (j.status = 'pending' and j.next_attempt_at <= now())
       or (j.status = 'sending' and j.updated_at < now() - interval '2 minutes')
    order by j.next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ),
  claimed as (
    update public.notification_jobs j set status = 'sending', attempt = j.attempt + 1
    from picked where j.id = picked.id
    returning j.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'event', j.event,
    'channel', j.channel,
    'attempt', j.attempt,
    'payload', j.payload,
    'guard', j.guard,
    'fallback_status', (select f.status from public.notification_jobs f where f.id = j.fallback_of),
    'contact', case when c.id is not null then jsonb_build_object(
      'id', c.id,
      'phone_e164', c.phone_e164,
      'locale', c.locale,
      'push_subscription', c.push_subscription,
      'window_expires_at', c.window_expires_at,
      'opted_out', c.opted_out_at is not null
        or (c.phone_e164 is not null and exists (
          select 1 from public.whatsapp_opt_outs o where o.phone_hash = public.sha256_hex(c.phone_e164)))
    ) end,
    'token', t.public_token,
    'ticket', public.ticket_view(t.id)
  )), '[]'::jsonb) into v_result
  from claimed j
  join public.tickets t on t.id = j.ticket_id
  left join public.notification_contacts c on c.id = j.contact_id;
  return v_result;
end;
$$;

/**
 * Résultat d'un envoi. `p_retry_in_seconds` : nouvel essai plus tard (job repassé `pending`).
 * `p_payload` est fusionné (texte envoyé, modèle) pour le suivi ; jamais de numéro.
 */
create or replace function public.complete_notification_job(
  p_job uuid,
  p_status public.job_status,
  p_provider_message_id text default null,
  p_error text default null,
  p_retry_in_seconds integer default null,
  p_template_name text default null,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_jobs set
    status = case when p_retry_in_seconds is not null then 'pending'::public.job_status else p_status end,
    next_attempt_at = case when p_retry_in_seconds is not null then now() + make_interval(secs => p_retry_in_seconds) else next_attempt_at end,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    template_name = coalesce(p_template_name, template_name),
    error = left(p_error, 500),
    payload = payload || coalesce(p_payload, '{}'::jsonb),
    sent_at = case when p_status in ('sent', 'delivered', 'read') and p_retry_in_seconds is null then coalesce(sent_at, now()) else sent_at end
  where id = p_job;
end;
$$;

/**
 * SMS de secours d'un job WhatsApp (contact avec numéro uniquement) : immédiat après un échec,
 * ou délai de garde (`p_guard`) : envoyé seulement si le message d'origine n'a pas été remis entre-temps.
 */
create or replace function public.schedule_sms_fallback(p_job uuid, p_delay_seconds integer default 0, p_guard boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notification_jobs (organization_id, branch_id, ticket_id, contact_id, event, channel, dedupe_key,
    next_attempt_at, fallback_of, guard)
  select j.organization_id, j.branch_id, j.ticket_id, j.contact_id, j.event, 'sms', 'sms:' || j.id,
         now() + make_interval(secs => greatest(p_delay_seconds, 0)), j.id, p_guard
  from public.notification_jobs j
  join public.notification_contacts c on c.id = j.contact_id and c.phone_e164 is not null
  where j.id = p_job and j.channel = 'whatsapp'
  on conflict (dedupe_key) do update set
    -- Échec confirmé avant la fin du délai de garde : le SMS part tout de suite.
    next_attempt_at = least(public.notification_jobs.next_attempt_at, excluded.next_attempt_at),
    guard = public.notification_jobs.guard and excluded.guard
  where public.notification_jobs.status = 'pending'
  returning id into v_id;
  if v_id is not null and p_delay_seconds <= 0 then perform public.kick_notification_dispatch(); end if;
  return v_id;
end;
$$;

-- ─── Webhook WhatsApp (service role) ─────────────────────────────────────────

/** Idempotence : vrai si l'événement n'a jamais été reçu (journal brut conservé jusqu'à la purge). */
create or replace function public.record_webhook_event(p_provider text, p_event_id text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.provider_webhook_events (provider, event_id, payload, processed_at)
  values (p_provider, p_event_id, p_payload, now())
  on conflict (provider, event_id) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

/**
 * Opt-in initié par le client : message prérempli « NEXTIN C-047 7K3Q » (numéro du ticket + 4 derniers caractères
 * du jeton du lien). Lie le numéro WhatsApp au ticket et ouvre la fenêtre de 24 h ; un STOP antérieur est levé
 * par ce nouvel accord explicite. Renvoie `linked`, `already`, `not_found` ou `rate_limited`.
 */
create or replace function public.whatsapp_opt_in(p_wa_id text, p_code text, p_suffix text, p_locale text default 'fr')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
  v_phone text := '+' || p_wa_id;
  v_contact uuid;
begin
  if p_wa_id !~ '^[1-9][0-9]{7,14}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  if not public.check_rate_limit('whatsapp_opt_in:' || p_wa_id, 10, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select t.* into v_ticket from public.tickets t
  where t.display_code = upper(p_code) and t.public_token is not null and right(t.public_token, 4) = p_suffix
    and t.status in ('waiting', 'called', 'serving') and t.created_at > now() - interval '1 day'
  order by t.created_at desc
  limit 1;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  delete from public.whatsapp_opt_outs where phone_hash = public.sha256_hex(v_phone);
  update public.notification_contacts set wa_id = p_wa_id, window_expires_at = now() + interval '24 hours', opted_out_at = null
  where ticket_id = v_ticket.id and channel = 'whatsapp' and phone_e164 = v_phone
  returning id into v_contact;
  if v_contact is not null then
    return jsonb_build_object('status', 'already', 'ticket_id', v_ticket.id, 'display_code', v_ticket.display_code);
  end if;
  insert into public.notification_contacts (organization_id, branch_id, ticket_id, channel, phone_e164, wa_id, locale,
    consent_source, consent_at, window_expires_at)
  values (v_ticket.organization_id, v_ticket.branch_id, v_ticket.id, 'whatsapp', v_phone, p_wa_id,
    case when p_locale = 'en' then 'en' else 'fr' end, 'customer_optin', now(), now() + interval '24 hours');
  return jsonb_build_object('status', 'linked', 'ticket_id', v_ticket.id, 'display_code', v_ticket.display_code);
end;
$$;

/** Tout message entrant rouvre la fenêtre de 24 h pour les contacts actifs de ce numéro. */
create or replace function public.whatsapp_touch(p_wa_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_contacts set wa_id = p_wa_id, window_expires_at = now() + interval '24 hours'
  where phone_e164 = '+' || p_wa_id and channel = 'whatsapp' and opted_out_at is null;
$$;

/** STOP : désinscription globale (numéro haché) ; les messages en attente sont annulés. START la lève. */
create or replace function public.whatsapp_set_opt_out(p_wa_id text, p_opted_out boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := '+' || p_wa_id;
begin
  if p_wa_id !~ '^[1-9][0-9]{7,14}$' then raise exception 'phone_invalid' using errcode = 'P0422'; end if;
  if p_opted_out then
    insert into public.whatsapp_opt_outs (phone_hash) values (public.sha256_hex(v_phone))
    on conflict (phone_hash) do update set opted_out_at = now();
    update public.notification_contacts set opted_out_at = now()
    where phone_e164 = v_phone and channel = 'whatsapp' and opted_out_at is null;
    update public.notification_jobs j set status = 'cancelled', error = 'opted_out'
    from public.notification_contacts c
    where c.id = j.contact_id and c.phone_e164 = v_phone and j.status = 'pending';
  else
    delete from public.whatsapp_opt_outs where phone_hash = public.sha256_hex(v_phone);
    update public.notification_contacts c set opted_out_at = null, window_expires_at = now() + interval '24 hours'
    from public.tickets t
    where t.id = c.ticket_id and c.phone_e164 = v_phone and c.channel = 'whatsapp' and t.status in ('waiting', 'called', 'serving');
  end if;
end;
$$;

/**
 * Statut d'un message (`sent`, `delivered`, `read`, `failed`) : jamais de retour en arrière ;
 * un échec déclenche le SMS de secours immédiat. Renvoie l'identifiant du job concerné.
 */
create or replace function public.whatsapp_message_status(p_message_id text, p_status text, p_error text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.notification_jobs;
  v_rank constant jsonb := '{"sending": 0, "sent": 1, "delivered": 2, "read": 3, "failed": 4}';
begin
  select * into v_job from public.notification_jobs where provider_message_id = p_message_id and channel = 'whatsapp' for update;
  if not found or p_status not in ('sent', 'delivered', 'read', 'failed') then return null; end if;
  if (v_rank ->> p_status)::int <= coalesce((v_rank ->> v_job.status::text)::int, 0) and p_status <> 'failed' then
    return v_job.id;
  end if;
  update public.notification_jobs set
    status = p_status::public.job_status,
    error = case when p_status = 'failed' then left(p_error, 500) else error end,
    delivered_at = case when p_status in ('delivered', 'read') then coalesce(delivered_at, now()) else delivered_at end
  where id = v_job.id;
  if p_status = 'failed' then perform public.schedule_sms_fallback(v_job.id, 0, false); end if;
  return v_job.id;
end;
$$;

/** Abonnement web push depuis la page « Mon ticket » (route serveur : jeton du lien + Turnstile non requis, limité). */
create or replace function public.register_push_contact(p_token text, p_subscription jsonb, p_locale text default 'fr')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where public_token = p_token and status in ('waiting', 'called', 'serving');
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.check_rate_limit('push_subscribe:' || v_ticket.id, 5, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  if not (p_subscription ? 'endpoint' and p_subscription -> 'keys' ? 'p256dh' and p_subscription -> 'keys' ? 'auth')
     or (p_subscription ->> 'endpoint') !~ '^https://' then
    raise exception 'invalid_subscription' using errcode = 'P0422';
  end if;
  insert into public.notification_contacts (organization_id, branch_id, ticket_id, channel, push_subscription, locale, consent_source, consent_at)
  values (v_ticket.organization_id, v_ticket.branch_id, v_ticket.id, 'push',
    jsonb_build_object('endpoint', p_subscription ->> 'endpoint', 'keys', p_subscription -> 'keys'),
    case when p_locale = 'en' then 'en' else 'fr' end, 'customer_optin', now())
  on conflict (ticket_id, (push_subscription ->> 'endpoint')) where channel = 'push' do nothing;
  return jsonb_build_object('status', 'subscribed');
end;
$$;

/** Abonnement push expiré (410 du service de push) : le contact est désactivé. */
create or replace function public.disable_push_contact(p_contact uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_contacts set opted_out_at = now() where id = p_contact and channel = 'push';
$$;

-- ─── Purge des données personnelles : textes envoyés et webhooks ─────────────

create or replace function public.purge_personal_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notification_contacts c
  using public.tickets t, public.organizations o
  where t.id = c.ticket_id and o.id = t.organization_id
    and t.created_at < now() - make_interval(days => o.data_retention_days);
  -- Le texte envoyé contient le lien du ticket : seuls restent l'événement, le canal, le statut et les horodatages.
  update public.notification_jobs j set payload = '{}'::jsonb
  from public.tickets t, public.organizations o
  where t.id = j.ticket_id and o.id = t.organization_id and j.payload <> '{}'::jsonb
    and t.created_at < now() - make_interval(days => o.data_retention_days);
  -- Webhooks : numéros WhatsApp en clair ; plus aucune utilité une fois traités.
  delete from public.provider_webhook_events
  where received_at < now() - make_interval(days => (select coalesce(min(data_retention_days), 30) from public.organizations));
  update public.tickets t
  set public_token = null, customer_user_id = null, rating_comment = null
  from public.organizations o
  where o.id = t.organization_id
    and t.created_at < now() - make_interval(days => o.data_retention_days)
    and (t.public_token is not null or t.customer_user_id is not null or t.rating_comment is not null);
  get diagnostics v_count = row_count;
  delete from public.client_ops where created_at < now() - interval '7 days';
  return v_count;
end;
$$;

select cron.schedule('nextin-notification-dispatch', '* * * * *', $$select public.notification_dispatch_tick()$$);

-- ─── Droits ──────────────────────────────────────────────────────────────────

revoke execute on function
  public.configure_notification_dispatch(text, text), public.kick_notification_dispatch(), public.notification_dispatch_tick(),
  public.enqueue_ticket_notification(uuid, public.notif_event, text, jsonb, public.job_status), public.enqueue_almost_your_turn(uuid),
  public.ticket_events_notify(), public.practitioner_absences_notify(), public.notification_contacts_changed(),
  public.ticket_view(uuid), public.claim_notification_jobs(integer),
  public.complete_notification_job(uuid, public.job_status, text, text, integer, text, jsonb),
  public.schedule_sms_fallback(uuid, integer, boolean), public.record_webhook_event(text, text, jsonb),
  public.whatsapp_opt_in(text, text, text, text), public.whatsapp_touch(text), public.whatsapp_set_opt_out(text, boolean),
  public.whatsapp_message_status(text, text, text), public.register_push_contact(text, jsonb, text),
  public.disable_push_contact(uuid), public.purge_personal_data()
from public, anon, authenticated;

grant execute on function
  public.configure_notification_dispatch(text, text), public.claim_notification_jobs(integer),
  public.complete_notification_job(uuid, public.job_status, text, text, integer, text, jsonb),
  public.schedule_sms_fallback(uuid, integer, boolean), public.record_webhook_event(text, text, jsonb),
  public.whatsapp_opt_in(text, text, text, text), public.whatsapp_touch(text), public.whatsapp_set_opt_out(text, boolean),
  public.whatsapp_message_status(text, text, text), public.register_push_contact(text, jsonb, text),
  public.disable_push_contact(uuid)
to service_role;

-- ─── RLS : file d'envoi, webhooks et STOP réservés au service role ──────────

alter table public.whatsapp_opt_outs enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.provider_webhook_events enable row level security;
revoke all on public.whatsapp_opt_outs, public.notification_jobs, public.provider_webhook_events from anon, authenticated;
