# Phase 3 — Demo Data Engine (Budget: 1.0h)

**Context:** No real AI crawler will visit a day-old site. Without this phase the demo is an empty dashboard. This phase creates (a) a **seeder** that writes 30 days of realistic history directly to Postgres, and (b) a **live simulator** that POSTs through the real ingest endpoint so the realtime feed and hero stats visibly move during the demo. The seed data carries a deliberate **story arc** that Phase 5's LLM brief will "discover" on stage.

## Objectives
1. `scripts/seed.ts` — deterministic (seeded RNG), idempotent (`--reset` truncates the site's events first), writes ~10,000 events across 30 days.
2. `scripts/simulate.ts --live` — fires 1–3 events/sec through the deployed ingest endpoint until Ctrl-C.

## Deliverables

### 3.1 Realism requirements (non-negotiable)
- **Full UA strings** from `FULL_UA_SAMPLES` in the shared registry — never bare bot names. Panel members WILL open the activity log.
- **~25 pages, power-law popularity**: `/`, `/pricing`, `/blog/<8 posts>`, `/docs/<10 pages>`, `/about`, `/changelog`, plus `/docs/old-api` (the 404 page). Top 3 pages ≈ 45% of traffic.
- **Platform mix** (matches published 2026 observations): GPTBot highest volume; then Googlebot/GoogleOther, ClaudeBot, Meta, bingbot, PerplexityBot, CCBot (bursty: 200–400 events in 2 single-day batches, quiet otherwise), Amazonbot, Bytespider, long tail.
- **Diurnal + weekday shape**: mild sinusoidal daily curve, ~20% weekend dip. Crawlers aren't 9–5 but flat lines look fake.
- **Category balance**: training ≈ 55%, indexing ≈ 30%, conversations ≈ 12%, unknown ≈ 3%. `status_code` populated only on `source='server'` rows (~60% of events): mostly 200, the story-arc 404s, a sprinkle of 301.

### 3.2 The story arc (plant these; Phase 5 harvests them)
1. **ClaudeBot volume doubles** across the 30 days (linear ramp) — mirrors real 2026 reporting, great talking point.
2. **Conversations growth on `/pricing` and `/blog/ai-visibility-guide`**: week-over-week increase in ChatGPT-User + Claude-User + Perplexity-User hits. Narrative: "AI is starting to recommend these pages."
3. **First-seen: DeepSeekBot** appears only in the last 3 days (~40 events).
4. **`/docs/old-api` returns 404** to every crawler that hits it (~120 events) — "crawl budget wasted on a dead page."
5. **Bytespider spike** on day 25 (5× its baseline for one day) — the anomaly-detection talking point.

### 3.3 Implementation notes
- Seeder inserts in batches of 500 via service-role client (`SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, gitignored). Direct DB writes — do NOT hammer the Edge Function with 10k requests.
- `--site <id>` required; `--days 30 --events 10000` defaults. Seeded RNG (e.g. mulberry32) so reruns are identical.
- Simulator: picks weighted random bot+page, sends real POSTs to deployed `ingest` with `source:'simulator'`; `--rate` flag; prints each event as it sends (nice on-screen during demo).
- Add npm scripts: `seed`, `seed:reset`, `simulate`.

## Acceptance checklist
- [ ] `npm run seed:reset -- --site <id>` completes < 60s; `select count(*)` ≈ 10k.
- [ ] Spot SQL checks: daily counts show the ClaudeBot ramp; DeepSeekBot min(occurred_at) within last 3 days; 404s only on `/docs/old-api`; CCBot bursty.
- [ ] Simulator events appear in the DB with correct classification (proves end-to-end via the REAL pipeline, not direct insert).
- [ ] Rerunning seed with `--reset` produces identical aggregate counts (determinism).

## Gotchas
- Insert `occurred_at` explicitly — DB default `now()` would collapse the timeline.
- Keep total ≤ ~15k events: Supabase free tier + snappy dashboard queries.
- Timezone: generate in UTC; the dashboard renders in browser-local — fine, just be consistent.

## Out of scope
Fancy statistical models; per-IP realism beyond a small pool of hashed fake IPs per platform.
