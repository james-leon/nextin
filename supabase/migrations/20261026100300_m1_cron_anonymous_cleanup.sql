-- ═════════════════════════════════════════════════════════════════════════════
-- M1 — Tâches planifiées : purge des sessions anonymes inactives et du rate limiting.
-- (M3 étendra purge_inactive_anonymous_users pour épargner les clients ayant un ticket actif.)
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

/**
 * Supprime les comptes anonymes (clients sans compte) sans connexion depuis p_inactive_for.
 * Renvoie le nombre de comptes supprimés.
 */
create or replace function public.purge_inactive_anonymous_users(p_inactive_for interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with doomed as (
    select u.id
    from auth.users u
    where u.is_anonymous is true
      and coalesce(u.last_sign_in_at, u.created_at) < now() - p_inactive_for
    limit 10000
  )
  delete from auth.users u using doomed where u.id = doomed.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_inactive_anonymous_users(interval) from public, anon, authenticated;
revoke execute on function public.purge_rate_limits() from public, anon, authenticated;

select cron.schedule('nextin-purge-anonymous-users', '15 2 * * *', $$select public.purge_inactive_anonymous_users()$$);
select cron.schedule('nextin-purge-rate-limits', '7 * * * *', $$select public.purge_rate_limits()$$);
