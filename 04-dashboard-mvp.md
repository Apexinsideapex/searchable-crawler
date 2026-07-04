# Phase 4 — Dashboard MVP (Budget: 2.5h)

**Context:** This closes every PRD acceptance criterion (AC-1..AC-5; AC-6 lands in Phase 6). Build against the seeded data from Phase 3. Layout mirrors the reference product's proven structure: hero stats → activity chart → tabs (Feed / Pages). Design bar: clean, dense, dark-mode-friendly; looks like a real analytics product, not a hackathon page. Consult the frontend-design skill before styling.

## Objectives
1. `/dashboard/[siteId]` single-page analytics view.
2. Hero stats, stacked activity chart, Pages table, Feed (activity log), global filters, CSV export.

## Deliverables

### 4.1 Global controls (top bar)
- **Date range**: 24h / 7d / 30d pills (default 7d). All widgets react.
- **Category filter**: All / Training / Indexing / Conversations pills.
- **Platform filter**: multiselect dropdown populated from data.
- Filters compose (category + platform + range) and drive one shared query-state hook; every widget consumes it.

### 4.2 Hero stats (4 cards)
Total Visits · Conversations · Indexing · Training. Each card: count for period, **% delta vs the previous period of equal length**, tiny sparkline. Clicking a card sets the category filter. Delta math must compare equal-length windows (the panel may check).

### 4.3 Activity chart
Stacked bar (Recharts), bucketed hourly for 24h / daily for 7d & 30d, one series per category with fixed colors. Respects all filters.

### 4.4 Pages tab
Table: page path · total visits · unique bots · top platform · last seen. Sorted by visits desc, top 50. Respects filters. (Stretch, only if ahead of schedule: row click opens a drawer with per-bot breakdown for that page — the "Page Drawer lite".)

### 4.5 Feed tab (activity log)
Latest 100 events: relative time (exact on hover) · bot name + platform badge · category chip · path · status code (when present) · source icon · "verified" badge when `is_verification`. Respects filters. **Structure this component so Phase 5 can subscribe it to realtime — render from a list in state, prepend on insert.**

### 4.6 CSV export
Button exports the **currently filtered** events (cap 10k rows) client-side: columns `occurred_at,page_url,bot_name,platform,bot_category,status_code,source,user_agent`. Quote/escape properly (UAs contain commas). Filename `crawler-events-<domain>-<range>.csv`.

### 4.7 Query layer
- Aggregations in SQL, not JS: create 2–3 Postgres functions (`rpc`) e.g. `stats_summary(site_id, from, to)`, `timeseries(site_id, from, to, bucket)`, `top_pages(...)` — or plain grouped selects if faster to ship. RLS applies (invoked as the user, `security invoker`).
- No client-side fetching of 10k raw rows except for CSV export.

## Acceptance checklist (maps to PRD ACs)
- [ ] AC-1: seeded GPTBot/ClaudeBot/PerplexityBot/Googlebot rows all render with correct platform/category. (Note in README why Google-Extended is absent from detection — see master plan §2.)
- [ ] AC-2: platform breakdown visible (hero + chart + platform filter).
- [ ] AC-3: Pages tab ranks by visit count.
- [ ] AC-4: date range filtering changes every widget consistently.
- [ ] AC-5: CSV downloads, opens in Excel/Numbers cleanly, respects active filters.
- [ ] Period deltas verified by hand against SQL for one case.
- [ ] Empty state: brand-new site shows a friendly "waiting for first crawl" panel with install instructions link (never a broken chart).
- [ ] Lighthouse sanity: dashboard loads < 3s on the deployed URL with 10k events.

## Gotchas
- Timezone bucketing: bucket in SQL with `date_trunc` in UTC, format client-side.
- Recharts stacked bars need a dense series (fill missing buckets with zeros server-side or charts get gap-toothed).
- Keep components server-rendered where possible; only filters/feed/chart interactivity needs client components.

## Out of scope
Realtime (Phase 5), insights (Phase 5), onboarding & settings (Phase 6), custom date ranges, pagination beyond caps.
