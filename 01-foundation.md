# Phase 1 — Foundation & Deploy Skeleton (Budget: 1.0h)

**Context:** Read `00-MASTER-PLAN.md` §4 first. This phase produces a deployed, authenticated, empty app and the full database schema. Nothing user-visible beyond login and an empty dashboard shell — but it must be LIVE on Vercel before the phase ends.

## Objectives
1. Repo + Next.js app deployed to Vercel with Supabase Auth working end-to-end.
2. Complete Postgres schema with RLS, indexes, and realtime enabled.
3. Env/secrets wiring done once, correctly.

## Deliverables

### 1.1 Repo scaffold
- `create-next-app` (App Router, TypeScript, Tailwind, ESLint). Add `@supabase/supabase-js` + `@supabase/ssr`.
- Directory layout:
  ```
  app/            (routes)
  components/
  lib/            (supabase clients: browser, server, service-role)
  shared/         (bot-registry.ts — created in Phase 2, reserve the dir)
  supabase/       (migrations/, functions/)
  scripts/        (seeder, simulator, sync-shared — later phases)
  ```
- Auth: email+password via Supabase Auth (`@supabase/ssr` cookie flow). Routes: `/login`, `/signup`, `/dashboard` (protected via middleware auth check). Keep UI minimal — Phase 6 polishes.

### 1.2 Schema (single migration file `supabase/migrations/0001_init.sql`)
```sql
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
```

### 1.3 Deploy
- Create Supabase project, run migration (`supabase db push` or SQL editor).
- Create Vercel project linked to the repo. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. (Service role key goes to Supabase function secrets in Phase 2, NOT to Vercel unless a server route needs it.)
- Push. Confirm live URL loads, signup → login → `/dashboard` shell works **on the deployed URL**.

## Acceptance checklist
- [ ] Deployed URL: signup, login, logout all work; `/dashboard` blocked when signed out.
- [ ] Migration applied cleanly on a fresh Supabase project (no manual SQL edits).
- [ ] `select * from crawler_events` as anon returns nothing; as the owning user returns own rows only (test with two accounts).
- [ ] Realtime publication includes `crawler_events` (verify in Supabase dashboard → Database → Replication).
- [ ] `DECISIONS.md` created with any deviations.

## Gotchas
- Use `@supabase/ssr` (not deprecated auth-helpers). Middleware must refresh the session cookie or server components will randomly see a null user.
- `timestamptz`, never `timestamp` — the PRD's schema gets this wrong; charts will bucket wrong across timezones otherwise.
- Don't enable email confirmation in Supabase Auth settings — it will stall the demo signup flow.

## Out of scope this phase
Any UI beyond the auth shell; the sites CRUD screen (Phase 6 onboarding); Edge Functions.
