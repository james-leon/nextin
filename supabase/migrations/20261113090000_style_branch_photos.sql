-- Style A (« À proximité ») : photo de l'établissement, téléversée par le directeur ou le responsable d'agence.
-- Bucket public `branch-photos` : `<organisation>/<agence>/cover.webp` (16:9) et `thumb.webp` (carré), recadrés et
-- compressés dans le navigateur ; 1 Mo au plus par fichier, images seulement. Aucune donnée personnelle.

alter table public.branches add column photo_updated_at timestamptz;

/** Écriture d'une photo d'agence : administrateur de l'établissement ou responsable de cette agence. */
create function public.can_write_branch_photo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_org uuid;
  v_branch uuid;
begin
  if public.is_anonymous() or array_length(v_parts, 1) <> 3 or v_parts[3] not in ('cover.webp', 'thumb.webp') then
    return false;
  end if;
  begin
    v_org := v_parts[1]::uuid;
    v_branch := v_parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return exists (select 1 from public.branches where id = v_branch and organization_id = v_org)
    and public.can_access_branch(v_org, v_branch, array['org_admin', 'branch_manager']::public.member_role[]);
end;
$$;

/** Photo enregistrée (ou retirée) : la version change pour que les appareils rechargent l'image. */
create function public.set_branch_photo(p_branch uuid, p_present boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.branches;
begin
  select * into v_b from public.branches where id = p_branch;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if public.is_anonymous() or not public.can_access_branch(v_b.organization_id, v_b.id, array['org_admin', 'branch_manager']::public.member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.branches set photo_updated_at = case when p_present then now() else null end where id = p_branch
  returning * into v_b;
  perform public.audit(v_b.organization_id, 'branch.photo', 'branch', v_b.id, jsonb_build_object('present', p_present));
  return v_b.photo_updated_at;
end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('branch-photos', 'branch-photos', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
    execute $p$create policy branch_photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'branch-photos' and public.can_write_branch_photo(name))$p$;
    execute $p$create policy branch_photos_update on storage.objects for update to authenticated
      using (bucket_id = 'branch-photos' and public.can_write_branch_photo(name))$p$;
    execute $p$create policy branch_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'branch-photos' and public.can_write_branch_photo(name))$p$;
    -- Remplacement d'une photo (upsert) : le stockage relit l'objet existant.
    execute $p$create policy branch_photos_select on storage.objects for select to authenticated
      using (bucket_id = 'branch-photos' and public.can_write_branch_photo(name))$p$;
  end if;
end;
$$;

create or replace function public.branch_summary(p_branch uuid, p_distance_m double precision)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with board as (select public.branch_board(p_branch) as v)
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'address', b.address,
    'city', b.city,
    'latitude', b.latitude,
    'longitude', b.longitude,
    'distance_m', case when p_distance_m is null then null else round(p_distance_m) end,
    'organization', jsonb_build_object('name', o.name, 'type', o.type),
    -- Photo de l'établissement (style A) : chemins publics du bucket `branch-photos`, version pour le cache.
    'photo', case when b.photo_updated_at is null then null else jsonb_build_object(
      'cover', b.organization_id || '/' || b.id || '/cover.webp',
      'thumb', b.organization_id || '/' || b.id || '/thumb.webp',
      'version', floor(extract(epoch from b.photo_updated_at))::bigint) end,
    'is_open', public.branch_is_open(b.id),
    'remote_enabled', bs.remote_tickets_enabled and exists (
      select 1 from public.services s where s.branch_id = b.id and s.active and s.allow_remote),
    'requests_enabled', bs.appointment_requests_enabled and exists (
      select 1 from public.practitioner_schedules ps join public.practitioners p on p.id = ps.practitioner_id and p.active
      where ps.branch_id = b.id),
    'waiting', (select coalesce(sum(jsonb_array_length(s -> 'waiting')), 0)::integer from board, jsonb_array_elements(board.v -> 'services') s),
    -- Attente la plus courte parmi les services ouverts (indication de la liste).
    'min_wait_seconds', (select min((s ->> 'wait_seconds')::integer) from board, jsonb_array_elements(board.v -> 'services') s
                         where (s ->> 'open')::boolean),
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s ->> 'id', 'prefix', s ->> 'prefix', 'name', s ->> 'name', 'name_en', s ->> 'name_en', 'color', s ->> 'color',
        'open', (s ->> 'open')::boolean, 'waiting', jsonb_array_length(s -> 'waiting'), 'wait_seconds', (s ->> 'wait_seconds')::integer
      )), '[]'::jsonb) from board, jsonb_array_elements(board.v -> 'services') s)
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id
  join public.branch_settings bs on bs.branch_id = b.id
  where b.id = p_branch;
$$;

revoke execute on function public.can_write_branch_photo(text), public.set_branch_photo(uuid, boolean) from public, anon, authenticated;
grant execute on function public.can_write_branch_photo(text), public.set_branch_photo(uuid, boolean) to authenticated;
