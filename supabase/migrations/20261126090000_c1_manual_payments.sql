-- ═════════════════════════════════════════════════════════════════════════════
-- C1 — Paiement manuel dans la console Wintek (espèces, virement, chèque, Mobile Money hors ligne).
-- Effet identique à un paiement en ligne : la logique qui suit un paiement réussi est extraite de `confirm_payment`
-- dans `settle_invoice`, appelée par les deux chemins. Annulation avec motif : la facture redevient ouverte et
-- l'abonnement retrouve son état d'avant (instantané), si aucun paiement plus récent ne l'a suivi.
-- Compatibilité avec le code en ligne : table et fonctions nouvelles ; `confirm_payment` et `invoice_document`
-- gardent leur signature et leur résultat (une clé de plus) ; contrainte des événements élargie.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  -- Établissement (abonnement, extension) ou annonceur (campagne) de la facture, pour le filtrage.
  organization_id uuid references public.organizations (id) on delete cascade,
  advertiser_id uuid references public.advertisers (id) on delete cascade,
  method text not null check (method in ('cash', 'transfer', 'cheque', 'mobile_money_offline')),
  amount_xaf integer not null check (amount_xaf > 0),
  paid_on date not null,
  reference text check (char_length(reference) <= 80),
  note text check (char_length(note) <= 300),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- État d'avant (rétabli à l'annulation) : abonnement, statut de la campagne.
  subscription_before jsonb,
  campaign_status_before text,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  check ((cancelled_at is null) = (cancel_reason is null))
);
create index manual_payments_invoice_idx on public.manual_payments (invoice_id);
create index manual_payments_org_idx on public.manual_payments (organization_id);
-- Un seul paiement manuel en vigueur par facture.
create unique index manual_payments_active_idx on public.manual_payments (invoice_id) where cancelled_at is null;

alter table public.manual_payments enable row level security;
-- Console Wintek seulement ; écritures uniquement par les fonctions ci-dessous.
create policy manual_payments_select on public.manual_payments for select to authenticated using (public.is_platform_admin());
revoke insert, update, delete on public.manual_payments from anon, authenticated;

alter table public.subscription_events drop constraint subscription_events_type_check;
alter table public.subscription_events add constraint subscription_events_type_check check (type in ('trial_started', 'no_trial',
  'invoice_issued', 'paid', 'renewed', 'grace_started', 'read_only', 'suspended', 'reactivated', 'days_granted', 'discount_applied',
  'plan_changed', 'plan_change_scheduled', 'deleted', 'moderation', 'limits_set', 'payment_cancelled'));

/**
 * Effet d'un paiement réussi sur sa facture : facture payée, puis campagne activée, extension de quota ajoutée ou
 * abonnement activé / prolongé (message de confirmation compris). Appelée par `confirm_payment` (agrégateur) et par
 * `admin_record_manual_payment` (console). `p_channel` : canal Mobile Money de l'agrégateur, null pour un paiement
 * manuel ; `p_provider` : agrégateur, ou `manual:<mode>`.
 */
create or replace function public.settle_invoice(
  p_invoice uuid, p_channel public.payment_channel, p_provider text, p_payment uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
  v_s public.subscriptions;
  v_was public.subscription_status;
begin
  select * into v_i from public.invoices where id = p_invoice for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_i.status = 'paid' then
    perform public.audit(v_i.organization_id, 'payment.duplicate', 'payment', p_payment, jsonb_build_object('invoice', v_i.number));
    return jsonb_build_object('status', 'succeeded', 'duplicate', true);
  end if;
  update public.invoices set status = 'paid', paid_at = now(), paid_channel = p_channel where id = v_i.id returning * into v_i;
  if v_i.campaign_id is not null then
    update public.ad_campaigns set status = 'active', paid_at = now() where id = v_i.campaign_id and status = 'awaiting_payment';
    perform public.audit(null, 'campaign.paid', 'ad_campaign', v_i.campaign_id,
      jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', p_provider));
    return jsonb_build_object('status', 'succeeded', 'invoice', v_i.number);
  end if;
  -- Extension de quota : ajoutée au mois en cours, l'abonnement ne change pas.
  if v_i.kind = 'extension' then
    perform public.apply_quota_extension(v_i.id);
    perform public.audit(v_i.organization_id, 'quota.extension_paid', 'invoice', v_i.id,
      jsonb_build_object('number', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', p_provider));
    return jsonb_build_object('status', 'succeeded', 'invoice', v_i.number);
  end if;
  select * into v_s from public.subscriptions where id = v_i.subscription_id for update;
  if found then
    v_was := v_s.status;
    update public.subscriptions set
      status = 'active', plan_id = v_i.plan_id, billing_period = v_i.billing_period,
      next_plan_id = case when next_plan_id = v_i.plan_id then null else next_plan_id end,
      current_period_start = v_i.period_start,
      current_period_end = greatest(v_i.period_end, coalesce(case when v_i.kind = 'renewal' then current_period_end end, v_i.period_end)),
      trial_ends_at = case when status = 'trialing' then trial_ends_at end,
      grace_ends_at = null, read_only_since = null, suspended_since = null, deletion_due_at = null,
      pending_status = null, pending_status_after = null
    where id = v_s.id returning * into v_s;
    update public.organizations set status = 'active', suspended_reason = null
    where id = v_s.organization_id and status = 'suspended' and suspended_reason = 'subscription';
    insert into public.subscription_events (subscription_id, organization_id, type, payload) values
      (v_s.id, v_s.organization_id, 'paid', jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'channel', p_channel,
        'provider', p_provider, 'billing_period', v_i.billing_period));
    if v_was <> 'active' then
      insert into public.subscription_events (subscription_id, organization_id, type, payload)
      values (v_s.id, v_s.organization_id, 'reactivated', jsonb_build_object('from', v_was));
    end if;
    perform public.enqueue_account_message(v_s.organization_id, 'payment_confirmed', 'paid:' || v_i.id,
      jsonb_build_object('invoice', v_i.number, 'amount_xaf', v_i.total_xaf, 'invoice_id', v_i.id, 'organization', v_i.buyer_snapshot ->> 'name',
        'period_end', (v_s.current_period_end at time zone 'Africa/Douala')::date),
      v_s.billing_phone_e164, v_s.billing_email, v_s.locale);
  end if;
  perform public.audit(v_i.organization_id, 'payment.succeeded', 'invoice', v_i.id,
    jsonb_build_object('number', v_i.number, 'amount_xaf', v_i.total_xaf, 'provider', p_provider));
  return jsonb_build_object('status', 'succeeded', 'invoice', v_i.number);
end;
$$;

/** Résultat d'un paiement de l'agrégateur : même signature et même résultat qu'avant ; l'effet est dans `settle_invoice`. */
create or replace function public.confirm_payment(
  p_external_id text, p_status public.payment_status, p_provider_ref text default null, p_raw jsonb default null,
  p_failure text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payments;
begin
  select * into v_p from public.payments where external_id = p_external_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_p.status <> 'pending' then
    return jsonb_build_object('status', v_p.status, 'already', true);
  end if;
  if p_status = 'pending' then
    update public.payments set last_checked_at = now(), provider_ref = coalesce(p_provider_ref, provider_ref) where id = v_p.id;
    return jsonb_build_object('status', 'pending');
  end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref), raw = coalesce(p_raw, raw),
    failure_reason = left(p_failure, 200), confirmed_at = case when p_status = 'succeeded' then now() end, last_checked_at = now()
  where id = v_p.id returning * into v_p;
  if p_status <> 'succeeded' then
    return jsonb_build_object('status', p_status);
  end if;
  return public.settle_invoice(v_p.invoice_id, v_p.channel, v_p.provider::text, v_p.id);
end;
$$;

/**
 * Console : paiement reçu hors ligne pour une facture ouverte (montant égal au total, date de réception, référence,
 * note). Même effet qu'un paiement en ligne. Journalisé.
 */
create or replace function public.admin_record_manual_payment(p_invoice uuid, p_fields jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
  v_method text := p_fields ->> 'method';
  v_amount integer;
  v_paid_on date;
  v_reference text := nullif(trim(coalesce(p_fields ->> 'reference', '')), '');
  v_note text := nullif(trim(coalesce(p_fields ->> 'note', '')), '');
  v_today date := (now() at time zone 'Africa/Douala')::date;
  v_before jsonb;
  v_campaign text;
  v_id uuid;
  v_result jsonb;
begin
  perform public.assert_platform_admin();
  select * into v_i from public.invoices where id = p_invoice for update;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if v_i.status <> 'open' then raise exception 'invoice_not_open' using errcode = 'P0409'; end if;
  if v_method is null or v_method not in ('cash', 'transfer', 'cheque', 'mobile_money_offline') then
    raise exception 'invalid_method' using errcode = '22023';
  end if;
  begin
    v_amount := (p_fields ->> 'amount_xaf')::integer;
    v_paid_on := (p_fields ->> 'paid_on')::date;
  exception when others then
    raise exception 'invalid_fields' using errcode = '22023';
  end;
  if v_amount is distinct from v_i.total_xaf then raise exception 'amount_mismatch' using errcode = '22023'; end if;
  if v_paid_on is null or v_paid_on > v_today or v_paid_on < v_today - 365 then raise exception 'invalid_date' using errcode = '22023'; end if;
  if char_length(v_reference) > 80 or char_length(v_note) > 300 then raise exception 'invalid_fields' using errcode = '22023'; end if;
  -- Virement, chèque, Mobile Money : référence exigée (numéro de virement, de chèque ou de transaction).
  if v_method <> 'cash' and v_reference is null then raise exception 'reference_required' using errcode = '22023'; end if;

  select to_jsonb(s) into v_before from public.subscriptions s where s.id = v_i.subscription_id;
  select status::text into v_campaign from public.ad_campaigns where id = v_i.campaign_id;
  insert into public.manual_payments (invoice_id, organization_id, advertiser_id, method, amount_xaf, paid_on, reference, note,
    recorded_by, subscription_before, campaign_status_before)
  values (v_i.id, v_i.organization_id, v_i.advertiser_id, v_method, v_amount, v_paid_on, v_reference, v_note,
    (select auth.uid()), case when v_i.kind in ('renewal', 'upgrade') then v_before end, v_campaign)
  returning id into v_id;

  v_result := public.settle_invoice(v_i.id, null, 'manual:' || v_method, v_id);
  -- Date de paiement : celle de la réception (facture et reçu), à midi à Douala.
  if v_paid_on < v_today then
    update public.invoices set paid_at = (v_paid_on + time '12:00') at time zone 'Africa/Douala' where id = v_i.id;
  end if;
  perform public.audit(v_i.organization_id, 'payment.manual_recorded', 'invoice', v_i.id,
    jsonb_build_object('number', v_i.number, 'amount_xaf', v_amount, 'method', v_method, 'paid_on', v_paid_on,
      'reference', v_reference, 'manual_payment', v_id));
  return v_result || jsonb_build_object('manual_payment', v_id);
end;
$$;

/**
 * Console : annulation d'un paiement manuel (erreur de saisie, chèque refusé…), motif obligatoire, code de double
 * authentification récent si elle est exigée. La facture redevient ouverte ; l'abonnement retrouve son état d'avant
 * le paiement (refusé si une autre facture a été payée depuis) ; extension retirée ; campagne remise en attente.
 */
create or replace function public.admin_cancel_manual_payment(p_manual uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.manual_payments;
  v_i public.invoices;
  v_b jsonb;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  perform public.assert_platform_admin();
  perform public.assert_mfa(null, true);
  if char_length(v_reason) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into v_m from public.manual_payments where id = p_manual for update;
  if not found or v_m.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into v_i from public.invoices where id = v_m.invoice_id for update;
  if v_i.status <> 'paid' then raise exception 'invalid_state' using errcode = 'P0409'; end if;

  if v_m.subscription_before is not null then
    -- Une facture payée depuis a pu prolonger l'abonnement : on ne rétablit pas un état périmé.
    if exists (select 1 from public.invoices o where o.subscription_id = v_i.subscription_id and o.id <> v_i.id
               and o.status = 'paid' and o.paid_at > v_i.paid_at) then
      raise exception 'cancel_not_latest' using errcode = 'P0409';
    end if;
    v_b := v_m.subscription_before;
    update public.subscriptions set
      status = (v_b ->> 'status')::public.subscription_status,
      plan_id = (v_b ->> 'plan_id')::uuid,
      billing_period = (v_b ->> 'billing_period')::public.billing_period,
      next_plan_id = (v_b ->> 'next_plan_id')::uuid,
      current_period_start = (v_b ->> 'current_period_start')::timestamptz,
      current_period_end = (v_b ->> 'current_period_end')::timestamptz,
      trial_ends_at = (v_b ->> 'trial_ends_at')::timestamptz,
      grace_ends_at = (v_b ->> 'grace_ends_at')::timestamptz,
      read_only_since = (v_b ->> 'read_only_since')::timestamptz,
      suspended_since = (v_b ->> 'suspended_since')::timestamptz,
      deletion_due_at = (v_b ->> 'deletion_due_at')::timestamptz,
      pending_status = (v_b ->> 'pending_status')::public.subscription_status,
      pending_status_after = (v_b ->> 'pending_status_after')::timestamptz
    where id = v_i.subscription_id;
    if v_b ->> 'status' = 'suspended' then
      update public.organizations set status = 'suspended', suspended_reason = 'subscription'
      where id = v_i.organization_id and status = 'active';
    end if;
    insert into public.subscription_events (subscription_id, organization_id, type, actor_user_id, payload)
    values (v_i.subscription_id, v_i.organization_id, 'payment_cancelled', (select auth.uid()),
      jsonb_build_object('invoice', v_i.number, 'reason', v_reason, 'status', v_b ->> 'status'));
  end if;
  if v_i.kind = 'extension' then
    delete from public.quota_extensions where invoice_id = v_i.id;
  end if;
  if v_i.campaign_id is not null and v_m.campaign_status_before = 'awaiting_payment' then
    update public.ad_campaigns set status = 'awaiting_payment', paid_at = null where id = v_i.campaign_id and status = 'active';
  end if;
  update public.invoices set status = 'open', paid_at = null, paid_channel = null where id = v_i.id;
  update public.manual_payments set cancelled_at = now(), cancelled_by = (select auth.uid()), cancel_reason = v_reason where id = v_m.id;
  perform public.audit(v_i.organization_id, 'payment.manual_cancelled', 'invoice', v_i.id,
    jsonb_build_object('number', v_i.number, 'amount_xaf', v_m.amount_xaf, 'method', v_m.method, 'reason', v_reason,
      'manual_payment', v_m.id));
end;
$$;

/** Facture (PDF) : mode du paiement manuel en vigueur, s'il y en a un (« Payée le … par virement »). */
create or replace function public.invoice_document(p_invoice uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
begin
  select * into v_i from public.invoices where id = p_invoice;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if not public.is_platform_admin() then
    -- M10b : facture d'une campagne, pour les membres de l'annonceur.
    if v_i.advertiser_id is not null then
      if not public.is_advertiser_member(v_i.advertiser_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
    else
      if v_i.organization_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
      perform public.assert_org_admin(v_i.organization_id);
    end if;
  end if;
  return to_jsonb(v_i) || jsonb_build_object(
    'plan', (select jsonb_build_object('name', name, 'name_en', name_en) from public.plans where id = v_i.plan_id),
    'manual_method', (select method from public.manual_payments where invoice_id = v_i.id and cancelled_at is null));
end;
$$;

revoke execute on function public.settle_invoice(uuid, public.payment_channel, text, uuid) from public, anon, authenticated;
revoke execute on function public.admin_record_manual_payment(uuid, jsonb), public.admin_cancel_manual_payment(uuid, text) from public, anon;
grant execute on function public.admin_record_manual_payment(uuid, jsonb), public.admin_cancel_manual_payment(uuid, text) to authenticated;
