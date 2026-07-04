create table sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  created_at timestamptz not null default now()
);

create table crawler_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  user_agent text not null,
  bot_name text not null default 'Unknown',
  platform text not null default 'Unknown',
  bot_category text not null default 'unknown',
    -- 'training' | 'indexing' | 'conversations' | 'agent' | 'unknown'
  page_url text not null,
  page_path text not null,
  status_code smallint,            -- null for pixel events (client can't know it)
  method text,                     -- null for pixel events
  source text not null default 'pixel',
    -- 'pixel' | 'server' | 'simulator' | 'verification'
  is_verification boolean not null default false,
  ip_hash text
);

create table insights_cache (
  site_id uuid primary key references sites(id) on delete cascade,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  model text
);

create index idx_events_site_time on crawler_events (site_id, occurred_at desc);
create index idx_events_site_platform on crawler_events (site_id, platform);
create index idx_events_site_path on crawler_events (site_id, page_path);
create index idx_events_site_category on crawler_events (site_id, bot_category);

alter table sites enable row level security;
alter table crawler_events enable row level security;
alter table insights_cache enable row level security;

create policy sites_select on sites for select using (auth.uid() = user_id);
create policy sites_insert on sites for insert with check (auth.uid() = user_id);
create policy sites_delete on sites for delete using (auth.uid() = user_id);

create policy events_select on crawler_events for select
  using (site_id in (select id from sites where user_id = auth.uid()));
-- NO insert policy: only the ingest Edge Function (service role) writes events.

create policy insights_select on insights_cache for select
  using (site_id in (select id from sites where user_id = auth.uid()));

-- Realtime for the live feed (Phase 5). RLS applies to realtime; policy above covers it.
alter publication supabase_realtime add table crawler_events;
