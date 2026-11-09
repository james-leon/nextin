-- Style A (tableau de bord) : attente moyenne par jour d'une période, pour tracer la période précédente en
-- pointillés à côté de la période choisie. Statistiques anonymes uniquement (mêmes cumuls que `dashboard_stats`).

create function public.daily_wait_series(p_org uuid, p_branch uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_stats_access(p_org, p_branch);
  if p_to < p_from or p_to - p_from > 400 then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', d.day,
      'wait_avg_seconds', case when d.wait_count > 0 then round(d.wait_sum::numeric / d.wait_count) end
    ) order by d.day)
    from (
      select g.d::date as day, coalesce(sum(r.wait_seconds_sum), 0) as wait_sum, coalesce(sum(r.wait_count), 0) as wait_count
      from generate_series(p_from, p_to, interval '1 day') g(d)
      left join public.stats_branch_rows(p_org, p_branch, p_from, p_to) r on r.day = g.d::date
      group by g.d
    ) d
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.daily_wait_series(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.daily_wait_series(uuid, uuid, date, date) to authenticated;
