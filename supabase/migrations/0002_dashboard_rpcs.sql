-- Dashboard RPCs: stats_summary, timeseries, top_pages, distinct_platforms
--
-- All four functions are `security invoker` — they run as the calling
-- authenticated user, so the existing RLS policy on crawler_events
-- (events_select: site_id in (select id from sites where user_id = auth.uid()))
-- applies automatically. No ownership checks are duplicated here.

create or replace function stats_summary(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns table (
  total bigint,
  training bigint,
  indexing bigint,
  conversations bigint,
  prev_total bigint,
  prev_training bigint,
  prev_indexing bigint,
  prev_conversations bigint
)
language sql
stable
security invoker
as $$
  select
    coalesce(count(*) filter (where occurred_at >= p_from and occurred_at < p_to), 0) as total,
    coalesce(count(*) filter (where occurred_at >= p_from and occurred_at < p_to and bot_category = 'training'), 0) as training,
    coalesce(count(*) filter (where occurred_at >= p_from and occurred_at < p_to and bot_category = 'indexing'), 0) as indexing,
    coalesce(count(*) filter (where occurred_at >= p_from and occurred_at < p_to and bot_category = 'conversations'), 0) as conversations,
    coalesce(count(*) filter (where occurred_at >= p_prev_from and occurred_at < p_prev_to), 0) as prev_total,
    coalesce(count(*) filter (where occurred_at >= p_prev_from and occurred_at < p_prev_to and bot_category = 'training'), 0) as prev_training,
    coalesce(count(*) filter (where occurred_at >= p_prev_from and occurred_at < p_prev_to and bot_category = 'indexing'), 0) as prev_indexing,
    coalesce(count(*) filter (where occurred_at >= p_prev_from and occurred_at < p_prev_to and bot_category = 'conversations'), 0) as prev_conversations
  from crawler_events
  where site_id = p_site_id
    and (
      (occurred_at >= p_from and occurred_at < p_to)
      or (occurred_at >= p_prev_from and occurred_at < p_prev_to)
    );
$$;

create or replace function timeseries(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval,
  p_category text,
  p_platforms text[]
)
returns table (
  bucket_start timestamptz,
  category text,
  count bigint
)
language sql
stable
security invoker
as $$
  -- date_bin aligns timestamps to fixed-width buckets anchored at an
  -- arbitrary origin; it's the right primitive here because p_bucket can be
  -- any interval width (e.g. '15 minutes', '2 hours'), not just the fixed
  -- units date_trunc() understands natively. Same origin is used both to
  -- compute the aligned generate_series() start and to bucket each event,
  -- so the two line up exactly.
  with buckets as (
    -- generate_series is inclusive on both ends; filter out a trailing
    -- bucket that starts exactly at (or past) p_to so a range like
    -- [00:00, 03:00) with a 1h bucket yields 3 buckets, not 4.
    select bucket_start
    from generate_series(
      date_bin(p_bucket, p_from, timestamptz '2000-01-01 00:00:00+00'),
      p_to,
      p_bucket
    ) as bucket_start
    where bucket_start < p_to
  ),
  categories as (
    select category from (values ('training'), ('indexing'), ('conversations')) as c(category)
  ),
  grid as (
    select b.bucket_start, c.category
    from buckets b
    cross join categories c
  ),
  events as (
    select
      date_bin(p_bucket, ce.occurred_at, timestamptz '2000-01-01 00:00:00+00') as bucket_start,
      ce.bot_category as category,
      count(*) as count
    from crawler_events ce
    where ce.site_id = p_site_id
      and ce.occurred_at >= p_from
      and ce.occurred_at < p_to
      and ce.bot_category in ('training', 'indexing', 'conversations')
      and (p_category is null or ce.bot_category = p_category)
      and (p_platforms is null or array_length(p_platforms, 1) is null or ce.platform = any(p_platforms))
    group by 1, 2
  )
  select
    grid.bucket_start,
    grid.category,
    coalesce(events.count, 0) as count
  from grid
  left join events
    on events.bucket_start = grid.bucket_start
   and events.category = grid.category
  order by grid.bucket_start, grid.category;
$$;

create or replace function top_pages(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_category text,
  p_platforms text[]
)
returns table (
  page_path text,
  total_visits bigint,
  unique_bots bigint,
  top_platform text,
  last_seen timestamptz
)
language sql
stable
security invoker
as $$
  select
    ce.page_path,
    count(*) as total_visits,
    count(distinct ce.bot_name) as unique_bots,
    mode() within group (order by ce.platform) as top_platform,
    max(ce.occurred_at) as last_seen
  from crawler_events ce
  where ce.site_id = p_site_id
    and ce.occurred_at >= p_from
    and ce.occurred_at < p_to
    and (p_category is null or ce.bot_category = p_category)
    and (p_platforms is null or array_length(p_platforms, 1) is null or ce.platform = any(p_platforms))
  group by ce.page_path
  order by total_visits desc
  limit 50;
$$;

create or replace function distinct_platforms(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  platform text
)
language sql
stable
security invoker
as $$
  select distinct ce.platform
  from crawler_events ce
  where ce.site_id = p_site_id
    and ce.occurred_at >= p_from
    and ce.occurred_at < p_to
  order by ce.platform;
$$;
