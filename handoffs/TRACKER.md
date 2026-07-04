# Build Tracker — AI Crawler Analytics

Source plans: `00-MASTER-PLAN.md` .. `06-polish-and-demo.md` (repo root).
This file is the iteration/handoff log. Update it at the end of every session/phase.

## Status by phase

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Foundation + deploy skeleton | ✅ done | Deployed: https://searchable-crawler.vercel.app |
| 2 | Ingestion pipeline | ⬜ not started | |
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
- [ ] Phase 2: ingestion pipeline (`shared/bot-registry.ts`, `ingest` Edge Function, pixel, Next.js middleware tracker).
