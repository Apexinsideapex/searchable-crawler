# Build Tracker — AI Crawler Analytics

Source plans: `00-MASTER-PLAN.md` .. `06-polish-and-demo.md` (repo root).
This file is the iteration/handoff log. Update it at the end of every session/phase.

## Status by phase

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Foundation + deploy skeleton | ✅ done | Deployed: https://searchable-crawler.vercel.app |
| 2 | Ingestion pipeline | ✅ done | Tasks 2.1–2.4 complete: bot-registry, ingest Edge Function, pixel, middleware tracker (dogfooded in `proxy.ts`) |
| 3 | Demo-data engine | ⬜ not started | |
| 4 | Dashboard MVP | ⬜ not started | |
| 5 | Intelligence layer | ⬜ not started | |
| 6 | Polish and demo | ⬜ not started | |

## Session log

### 2026-07-04 — Phase 1 kickoff
- Repo already has `supabase/` linked to project `onecvommgdocankabufy` (Supabase CLI linked, confirmed via `supabase projects list`).
- GitHub remote already set: `git@github.com:Apexinsideapex/searchable-crawler.git`, `gh` authenticated.
- Decisions from user Q&A (see `DECISIONS.md`):
  - Vercel deploy deferred — Vercel CLI token expired, user will `vercel login` later. Foundation will be fully working **locally** this session; deploy is a follow-up step, tracked below.
  - Email confirmation in Supabase Auth left at default (**required**), overriding the plan's recommendation to disable it. Test/dev flows use the Admin API (`email_confirm: true`) to create pre-confirmed users where needed (e.g. RLS two-account test) since real signup will require clicking the email link.

### 2026-07-04 — Phase 1 completed
- Next.js 16 (App Router, TS, Tailwind) scaffolded; `@supabase/supabase-js` + `@supabase/ssr` wired up (`lib/supabase/{client,server,service,middleware}.ts`).
- Auth pages built: `/`, `/login`, `/signup`, `/dashboard` (server actions in `app/login/actions.ts`; shared `AuthForm` client component). Route protection + session refresh via `proxy.ts` (renamed from `middleware.ts` — Next 16 deprecated the old filename).
- Migration `supabase/migrations/0001_init.sql` pushed to the linked project (`sites`, `crawler_events`, `insights_cache`, RLS policies, indexes, `crawler_events` added to `supabase_realtime` publication). Verified directly via psql (pooler connection — direct IPv6 connection wasn't reachable from this network).
- Tests: `tests/rls.test.ts` (Vitest) — 5 integration tests against the real Supabase project, using Admin API to create/teardown temp users. Covers: owner-only reads on `sites` and `crawler_events`, no cross-user leakage, anon gets zero rows, authenticated direct-insert into `crawler_events` is blocked (service-role-only by design). All passing.
- `npm run build` and `npm run lint` clean.
- User re-authenticated Vercel CLI mid-session (`vercel login`); linked project (auto-connected the existing GitHub repo), set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production + Development, deployed to production.
- **Live URL:** https://searchable-crawler.vercel.app — user manually verified signup/login/logout/dashboard-block on the deployed URL.
- Deviations logged in `DECISIONS.md` (email confirmation left ON, `proxy.ts` rename, service-role key kept out of Vercel).

## Outstanding / follow-up for next session
- [ ] Preview-environment env vars not set (Vercel wanted an explicit branch) — add before relying on preview deployments for PRs.
- [x] Phase 2: ingestion pipeline (`shared/bot-registry.ts`, `ingest` Edge Function, pixel, Next.js middleware tracker) — completed across Tasks 2.1–2.4.

### 2026-07-04 — Task 2.3 (pixel snippet) completed
- `public/tracker.js` added: 1149 bytes, no deps, no build step. Reads `data-site` (fallback `?sid=` on the script's own `src`) via `document.currentScript` (with a `script[src*="tracker.js"]` fallback), fires a GET to the ingest endpoint with `sid`+`u` query params via `fetch(..., {keepalive:true, mode:'no-cors'})`, falling back to `new Image().src` if `fetch` is unavailable. Whole thing wrapped in try/catch, fails silently if `site_id` can't be found.
- Design deviation from the literal "sendBeacon" wording in the plan: `navigator.sendBeacon` always POSTs (no bare-GET mode), so using it here would mean building the same JSON body the middleware sends and losing the main benefit of the pixel path — letting the ingest function read the request's real `User-Agent` header itself instead of trusting a JS-read `navigator.userAgent` field. Documented in `README.md` and in the file's header comment.
- Docs added to `README.md` under "Pixel snippet" with the embed tag (using the live `https://searchable-crawler.vercel.app/tracker.js` URL from Phase 1), the honest "JS-executing agents only" caveat, and the design rationale.
- Verification: no browser automation tool was reachable in this session (Chrome MCP extension not connected), so verification was (a) a careful manual trace of the script logic against a hand-built test HTML page served via local `python3 -m http.server`, and (b) a `curl` against the real deployed ingest endpoint using the exact query-string shape the script constructs (`?sid=<uuid>&u=<encoded url>` with a Chrome UA) — confirmed it returns the expected `{"error":"site not found"}` 404 for an unknown site id, proving the request shape is exactly right end-to-end. A live in-browser network-tab check is still recommended before Phase 6 onboarding wiring.

### 2026-07-05 — Task 2.4 (Next.js middleware helper) completed
- `shared/track-crawlers.ts` added: `trackAiCrawlers(req, { siteId, endpoint })` — cheap UA regex pre-filter, then a fire-and-forget JSON POST to the ingest Edge Function (`.catch(() => {})`, never awaited). Documented as a copy-paste snippet in `README.md` under "Middleware tracker", matching the "Pixel snippet" section's style.
- **Dogfooded** in this app's own `proxy.ts`: wired ahead of the existing `updateSession` auth/session-refresh call, pointed at a new permanent `sites` row (`domain: searchable-crawler.vercel.app`, `id: 73e3e3e0-6303-4c3e-8e45-dbbeeadcaf3a`, owned by the real signed-up user `r49.sharma@gmail.com` — confirmed via the service-role client that this was the only `auth.users` row and `sites` was empty before this task).
- Tests: `tests/track-crawlers.test.ts` (Vitest, mocked global `fetch`) — human UA no-ops, bot UAs (GPTBot + generic bot/crawl/spider/scrape patterns) fire exactly one POST with the expected body, the call is provably non-blocking (asserted ordering around an unresolved fetch promise), and fetch rejections are swallowed without throwing. All passing; full suite (`npx vitest run`) 38/38 green.
- **Found and fixed a pre-existing deploy-blocking bug** (unrelated to this task but discovered while verifying it): root `tsconfig.json` didn't exclude `supabase/functions/`, so `next build`'s type-check choked on the Deno Edge Function's `npm:` specifier import (`supabase/functions/ingest/index.ts:17`). This had been silently broken since the ingest function was added in Task 2.2 — local `main` was 5 commits ahead of `origin/main` the whole time, so it had never actually gone through a real Vercel build. Fixed by adding `"supabase/functions"` to `tsconfig.json`'s `exclude`. Confirmed pre-existing by stashing and reproducing on the prior commit.
- Pushed both commits to `origin/main` (previously unpushed Phase 1/2 commits went out together with this). Vercel auto-deployed via the GitHub integration; production build succeeded and the `searchable-crawler.vercel.app` alias now points at the new deployment.
- **Live verification**: `curl -A "GPTBot/1.0 (+https://openai.com/gptbot)" https://searchable-crawler.vercel.app/` produced a new row in `crawler_events` (via service-role query) tied to the dogfood `site_id`, correctly classified `bot_name: GPTBot`, `platform: OpenAI`, `bot_category: training`, `source: server`. A control `curl` with a plain browser UA produced no new row, confirming the pre-filter correctly no-ops for human traffic in production.

## Parked: real-data source for the demo (do the MOMENT Phase 2's ingest deploys) — see `03-demo-data-engine.md`
User owns a **separate, already-hosted Next.js site** with real traffic: `../TakeHome` (frontend at `TakeHome/frontend`, App Router `src/app`, Next 16.1.6, `output: "standalone"` → Docker/Fly/Cloud Run deploy, **no auth/middleware currently** — clean add). Installing our server-side tracker there gives us **genuinely real** GPTBot/ClaudeBot/etc. events accumulating in the background while Phases 3–6 are built — the credibility layer alongside the seeded arc.
- [ ] Create a dedicated `sites` row for the TakeHome domain → get its `site_id`.
- [ ] Add `src/middleware.ts` to `TakeHome/frontend` calling `trackAiCrawlers(req, { siteId, endpoint: 'https://onecvommgdocankabufy.supabase.co/functions/v1/ingest' })`, then `return NextResponse.next()`. Fire-and-forget, never `await`.
- [ ] Verify with a spoofed-UA curl to the deployed ingest first (proves wiring without waiting for real bots), then let real crawler hits accumulate over days.
