-- Refonte v2, LOT 3 — Réglages personnels : appareils connectés (maquette v2 07, « Sécurité »).
-- Chaque membre du personnel voit ses propres sessions (navigateur, dernière activité) et peut en fermer une autre
-- que celle en cours. Ajouts seulement : deux fonctions, aucune table modifiée (compatible avec le code en ligne).
-- L'adresse IP n'est jamais renvoyée (donnée personnelle inutile à l'écran).

create or replace function public.my_sessions()
returns table (id uuid, user_agent text, created_at timestamptz, last_active_at timestamptz, is_current boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_agent,
    s.created_at,
    greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC'),
    s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and not public.is_anonymous()
    and (s.not_after is null or s.not_after > now())
  order by 4 desc nulls last
  limit 50;
$$;

comment on function public.my_sessions() is
  'Sessions ouvertes du compte connecté (personnel), sans adresse IP ; la session en cours est signalée.';

-- Fermeture d'une autre session du compte : jetons de rafraîchissement supprimés avec elle (cascade d'Auth),
-- l'appareil est déconnecté à sa prochaine requête vérifiée (auth.getUser). Journalisée sans organisation.
create or replace function public.revoke_my_session(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  v_deleted uuid;
begin
  if (select auth.uid()) is null or public.is_anonymous() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_session is null or p_session = v_current then
    raise exception 'session_current' using errcode = '22023';
  end if;
  delete from auth.sessions
   where id = p_session and user_id = (select auth.uid())
  returning id into v_deleted;
  if v_deleted is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.audit(null, 'auth.session_revoked', 'session', v_deleted);
  return true;
end;
$$;

comment on function public.revoke_my_session(uuid) is
  'Ferme une autre session du compte connecté (jamais celle en cours), journalisée.';

revoke all on function public.my_sessions() from public, anon;
revoke all on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
