-- platform_breakdown: ranked visit counts per platform for the dashboard's
-- platform breakdown chart (PRD FR-3.2 / AC-2). `security invoker` — same
-- RLS-delegation pattern as the other dashboard RPCs in 0002.

create or replace function platform_breakdown(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_category text,
  p_platforms text[]
)
returns table (
  platform text,
  count bigint
)
language sql
stable
security invoker
as $$
  select
    ce.platform,
    count(*) as count
  from crawler_events ce
  where ce.site_id = p_site_id
    and ce.occurred_at >= p_from
    and ce.occurred_at < p_to
    and (p_category is null or ce.bot_category = p_category)
    and (p_platforms is null or array_length(p_platforms, 1) is null or ce.platform = any(p_platforms))
  group by ce.platform
  order by count desc, ce.platform
  limit 10;
$$;
