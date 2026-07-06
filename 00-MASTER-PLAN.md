# AI Crawler Analytics — Master Build Plan (1 Day, AI-Agent Executed)

**Deliverable:** Live deployed app (Vercel + Supabase) + demo-ready data + short walkthrough.
**Reference product:** Trakkr AI Crawlers (https://trakkr.ai/learn/docs/features/ai-crawlers)
**PRD:** See `PRD.md` (baseline — we extend where impressive, and correct it where it's factually wrong).

---

## 1. The strategy in one paragraph

The PRD's own risk register admits the fatal flaw: **most AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript**, so a JS-only pixel captures almost nothing. The industry-standard answer (and what Trakkr does) is **server-side capture**. Our build ships BOTH: the PRD's pixel (fast install, works for JS-executing agents) AND a copy-paste **Next.js middleware tracker** (sees every request, including non-JS bots). We then layer on the three things that make a demo memorable: a **real-time live feed**, a **"Send Verification" synthetic crawl button** (data appears on screen in <5 seconds — the demo money-shot), and an **LLM-generated Intelligence Brief** with per-page AEO recommendations. Because no real crawler will visit a day-old demo site, a **realistic seed-data engine with a deliberate story arc** is a first-class phase, not an afterthought.

## 2. PRD corrections to state openly (principal-engineer signals)

Present these respectfully in the README/demo — "the PRD as written has three issues I fixed":

1. **JS pixel blind spot — evidence-backed.** Vercel/MERJ analyzed 500M+ GPTBot fetches: zero JS execution (GPTBot downloads JS files ~11.5% of the time but never runs them); same for ClaudeBot, PerplexityBot, OAI-SearchBot, Meta, Bytespider. Confirmed current as of mid-2026. Known exceptions that DO render JS: Applebot (browser-based crawler), Gemini (inherits Googlebot's rendering infra), and browser-based AI agents. **Framing: pixel and middleware see different populations** — the pixel uniquely catches JS-executing agents; the middleware catches the bulk crawlers. Ship both, feeding one ingest endpoint. Cite the Vercel study in the README (vercel.com/blog/the-rise-of-the-ai-crawler).
2. **`Google-Extended` is NOT a user agent.** It is a robots.txt opt-out *token* that never appears in access logs (same for `Applebot-Extended`). Detecting it in UA strings is impossible. We detect `Googlebot` / `GoogleOther` / `Google-CloudVertexBot` instead, and surface `Google-Extended` in the robots.txt Access Check where it actually lives.
3. **Bot list is outdated and taxonomy is off.** 2026 landscape includes Claude-User, Claude-SearchBot, Perplexity-User, MistralAI-User, DeepSeekBot, GrokBot, Amazonbot, DuckAssistBot, Meta-ExternalFetcher. Industry taxonomy is **Training / Indexing / Conversations** (+ emerging Agent) — not "training/search/assistant". Conversations (ChatGPT-User, Claude-User) is the strongest signal: a real human is asking an AI about you *right now*.

## 3. Phase map (execute in this order)

| # | Phase | File | Budget | Why this order |
|---|-------|------|--------|----------------|
| 1 | Foundation + deploy skeleton | `01-foundation.md` | 1.0h | Deploy to Vercel in hour one; iterate against prod from the start |
| 2 | Ingestion pipeline (detector, Edge Function, pixel, middleware) | `02-ingestion-pipeline.md` | 1.5h | Everything downstream depends on the event shape |
| 3 | Demo-data engine (seeder + live simulator) | `03-demo-data-engine.md` | 1.0h | Build the dashboard AGAINST realistic data, not empty tables |
| 4 | Dashboard MVP (PRD scope: stats, chart, pages, feed, filters, CSV) | `04-dashboard-mvp.md` | 2.5h | The must-ship core; all PRD acceptance criteria close here |
| 5 | Intelligence layer (realtime feed, LLM brief, AEO/access check) | `05-intelligence-layer.md` | 2.0h | The wow layer; each item independently cuttable |
| 6 | Polish, onboarding, README, demo prep | `06-polish-and-demo.md` | 1.5h | The panel judges the demo, not the diff |

Total ≈ 9.5h + ~0.5h buffer. **Hard rule: if a phase overruns by >30 min, cut its stretch items and move on.** Phases 1–4 are P0. Phase 5 items are ranked (realtime → LLM brief → access check) so the cut line is pre-decided. Phase 6 is P0 (a broken demo of great code loses to a great demo of good code).

## 4. Architecture (locked decisions — do not relitigate mid-build)

```
Customer site ──(pixel GET beacon)──┐
Customer Next.js ─(middleware POST)─┤
Simulator script ──(POST)───────────┼──▶ Supabase Edge Function `ingest`
"Send Verification" button ─(POST)──┘         │ validate site_id → classify UA → hash IP → insert
                                              ▼
                                    Supabase Postgres (RLS)
                                     │            │
                                     │       SQL aggregates
                                     ▼            ▼
                              Next.js dashboard on Vercel
                                     ▲
                    Edge Function `insights` (Gemini brief, 4h cache, rule fallback)
                    Edge Function `access-check` (robots.txt / llms.txt parse)
```

- **Monorepo**: one Next.js (App Router, TS, Tailwind) repo with `supabase/` directory. One Vercel project. One `git push` = deploy.
- **Single source of truth for bot detection**: `shared/bot-registry.ts` (pure data + pure `classifyBot()` fn, no runtime deps) imported by the Edge Function (Deno), middleware (Node/Edge), and seeder. A `scripts/sync-shared.ts` copy step keeps `supabase/functions/_shared/` in sync; CI-style check fails the build on drift.
- **Ingest is service-role, not anon-insert**: Edge Function validates the site exists, then inserts with service role. No public INSERT policy on `crawler_events`. Dashboard reads via RLS.
- **Charts**: Recharts. **CSV**: client-side generation from a filtered query (streaming/export API is out of scope).
- **LLM**: Gemini API (`gemini-3.1-pro-preview`) via Supabase secret; strict-JSON output; deterministic fallback so the brief is never empty.

## 5. The demo script (build toward this from hour one)

1. Sign up → add site → onboarding shows **two install tabs**: Pixel (30s) and Next.js Middleware ("this one sees the bots the pixel can't — here's why").
2. Click **Send Verification** → a synthetic GPTBot visit appears in the **live feed within seconds** (tagged with a "verified" badge).
3. Run `npm run simulate -- --live` on screen → feed streams, hero stats tick up in real time.
4. Walk the seeded 30-day dashboard: hero stats with period-over-period deltas, stacked category chart, top pages, filters, CSV export.
5. Open the **Intelligence Brief**: LLM has found the planted story arc — ClaudeBot volume doubling, DeepSeekBot first-seen 3 days ago, a page serving 404s to crawlers, Conversations growth on /pricing.
6. Access Check tab: robots.txt matrix for the demo domain; note the Google-Extended token distinction.
7. Close on the honest limitations slide (see §7).

## 6. Global conventions for the coding agent (apply to every phase)

- TypeScript strict everywhere. `timestamptz` everywhere. No `any` in shared code.
- Every phase ends with: acceptance checklist green → commit → push → **verify on the deployed URL**, not localhost.
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `ANTHROPIC_API_KEY` live in Supabase/Vercel env only. Never in the repo. `NEXT_PUBLIC_*` for anon key + URL only.
- Prefer boring: no queues, no workers, no ORMs, no state libraries. Supabase JS client + React Server Components + a few client components.
- When a decision isn't covered by a phase file, choose the option that makes the **demo** better, then note it in `DECISIONS.md`.

## 7. Honest limitations (say them before the panel does)

- Pixel misses non-JS crawlers (mitigated by middleware path; log-drain/CDN integrations are the real v2).
- UA strings are spoofable; production would verify via published IP ranges / reverse DNS (documented, not built).
- No dedup across pixel+middleware double-install (Trakkr hashes events; noted as v2).
- Free-tier Supabase limits under real crawl volume; batching/aggregation tables are the scale path.

## 8. Out of scope (unchanged from PRD + additions)

REST API, webhooks, alerts, bot blocking, log-file analysis, multi-user teams, custom date ranges, event dedup, IP-range bot verification, citations/clicks funnel (mention as roadmap — it's Trakkr's crawl→cite→click story and shows we understand where this feature goes next).
