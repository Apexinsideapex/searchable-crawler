-- Insights Context RPC
-- Returns a single JSON blob containing aggregated statistics specifically
-- designed for LLM analysis.

create or replace function get_insights_context(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns json
language sql
stable
security invoker
as $$
  with current_period as (
    select
      bot_category,
      platform,
      bot_name,
      page_path,
      status_code,
      count(*) as visits
    from crawler_events
    where site_id = p_site_id
      and occurred_at >= p_from
      and occurred_at < p_to
    group by bot_category, platform, bot_name, page_path, status_code
  ),
  previous_period as (
    select
      bot_category,
      platform,
      count(*) as visits
    from crawler_events
    where site_id = p_site_id
      and occurred_at >= p_prev_from
      and occurred_at < p_prev_to
    group by bot_category, platform
  ),
  -- 1. Category Totals + Deltas
  category_stats as (
    select
      c.bot_category as category,
      sum(c.visits) as current_visits,
      coalesce(sum(p.visits), 0) as prev_visits
    from current_period c
    left join previous_period p on c.bot_category = p.bot_category
    group by c.bot_category
  ),
  -- 2. Platform Deltas
  platform_stats as (
    select
      c.platform,
      sum(c.visits) as current_visits,
      coalesce(sum(p.visits), 0) as prev_visits
    from current_period c
    left join previous_period p on c.platform = p.platform
    group by c.platform
  ),
  -- 3. Top Pages
  top_pages as (
    select
      page_path,
      sum(visits) as total_visits
    from current_period
    group by page_path
    order by total_visits desc
    limit 15
  ),
  -- 4. Error Pages (non-200)
  error_pages as (
    select
      page_path,
      status_code,
      sum(visits) as error_visits
    from current_period
    where status_code != 200
    group by page_path, status_code
    order by error_visits desc
  ),
  -- 5. First-seen bots (in the last 7 days vs all time before)
  new_bots as (
    select distinct c.bot_name
    from current_period c
    where not exists (
      select 1
      from crawler_events old
      where old.site_id = p_site_id
        and old.bot_name = c.bot_name
        and old.occurred_at < p_from
    )
  )
  select json_build_object(
    'timeframe', json_build_object('from', p_from, 'to', p_to),
    'category_trends', (select json_agg(row_to_json(cs)) from category_stats cs),
    'platform_trends', (select json_agg(row_to_json(ps)) from platform_stats ps),
    'top_pages', (select json_agg(row_to_json(tp)) from top_pages tp),
    'error_pages', (select json_agg(row_to_json(ep)) from error_pages ep),
    'new_bots_detected', (select coalesce(json_agg(nb.bot_name), '[]'::json) from new_bots nb)
  );
$$;
