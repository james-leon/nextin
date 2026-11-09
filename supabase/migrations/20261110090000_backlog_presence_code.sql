-- Backlog (après M10b) : confirmation de présence plus sûre pour les tickets à distance.
-- L'écran TV affiche un QR code dont le code de présence change chaque minute (dérivé d'un secret propre à
-- l'agence, jamais lisible par un compte). Option d'agence : seule la TV (ou l'accueil) confirme la présence ;
-- le QR imprimé reste valable pour prendre un ticket sur place.

alter table public.branch_settings
  add column remote_presence_tv_only boolean not null default false;

comment on column public.branch_settings.remote_presence_tv_only is
  'Présence d''un ticket à distance confirmée seulement par le code tournant de l''écran TV (ou par l''accueil), pas par le QR imprimé ni le code court.';

create table public.branch_presence_secrets (
  branch_id uuid primary key,
  organization_id uuid not null,
  secret text not null check (char_length(secret) = 32),
  created_at timestamptz not null default now(),
  foreign key (organization_id, branch_id) references public.branches (organization_id, id) on delete cascade
);
-- Aucune politique : lisible seulement par les fonctions SECURITY DEFINER ci-dessous.
alter table public.branch_presence_secrets enable row level security;
revoke all on public.branch_presence_secrets from public, anon, authenticated;

/** Code de présence d'une agence pour une minute donnée (interne) : 6 caractères, secret créé au premier usage. */
create or replace function public.presence_code(p_branch uuid, p_minute bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select secret into v_secret from public.branch_presence_secrets where branch_id = p_branch;
  if v_secret is null then
    insert into public.branch_presence_secrets (branch_id, organization_id, secret)
    select b.id, b.organization_id, public.random_string(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')
    from public.branches b where b.id = p_branch
    on conflict (branch_id) do nothing;
    select secret into v_secret from public.branch_presence_secrets where branch_id = p_branch;
  end if;
  if v_secret is null then return null; end if;
  return upper(left(public.sha256_hex(v_secret || ':' || p_minute::text), 6));
end;
$$;

/** Minute courante (époque Unix / 60). */
create or replace function public.presence_minute(p_at timestamptz default now())
returns bigint
language sql
stable
set search_path = ''
as $$ select floor(extract(epoch from p_at) / 60)::bigint; $$;

/**
 * Code de présence de l'écran TV (service role, jeton d'appareil) : code de la minute et fin de validité. Le code
 * de la minute précédente reste accepté, le temps que l'écran se rafraîchisse.
 */
create or replace function public.tv_presence_code(p_device_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_minute bigint := public.presence_minute();
begin
  select d.branch_id into v_branch from public.displays d
  where d.device_token_hash = public.sha256_hex(p_device_token) and d.status = 'active';
  if v_branch is null then return null; end if;
  return jsonb_build_object('code', public.presence_code(v_branch, v_minute),
    'valid_until', to_timestamp((v_minute + 2) * 60));
end;
$$;

/**
 * Confirmation de présence d'un ticket à distance : code tournant de l'écran TV (minute courante ou précédente),
 * ou QR imprimé / code court de l'agence si l'agence ne l'a pas réservée à l'écran.
 */
create or replace function public.confirm_presence(p_token text, p_entry_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tickets;
  v_code text := upper(trim(coalesce(p_entry_code, '')));
  v_minute bigint := public.presence_minute();
  v_by text;
begin
  v_row := public.lock_remote_ticket(p_token);
  if char_length(v_code) = 6 and v_code in (public.presence_code(v_row.branch_id, v_minute), public.presence_code(v_row.branch_id, v_minute - 1)) then
    v_by := 'tv';
  elsif exists (
    select 1 from public.qr_codes q
    where q.branch_id = v_row.branch_id and q.active and (q.token = p_entry_code or q.short_code = v_code)
  ) then
    if coalesce((select remote_presence_tv_only from public.branch_settings where branch_id = v_row.branch_id), false) then
      raise exception 'presence_tv_only' using errcode = 'P0422';
    end if;
    v_by := 'scan';
  else
    raise exception 'invalid_entry' using errcode = 'P0422';
  end if;
  if v_row.presence_confirmed_at is null then
    update public.tickets set presence_confirmed_at = now() where id = v_row.id returning * into v_row;
    perform public.log_ticket_event(v_row, 'presence_confirmed', jsonb_build_object('by', v_by));
  end if;
  return public.ticket_view(v_row.id);
end;
$$;

revoke execute on function public.presence_code(uuid, bigint), public.presence_minute(timestamptz), public.tv_presence_code(text)
  from public, anon, authenticated;
grant execute on function public.tv_presence_code(text) to service_role;
