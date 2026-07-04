# Decisions Log

Deviations from the phase plans, and why.

## Phase 1 — Foundation

- **Email confirmation left ON** in Supabase Auth (plan recommended disabling it for a frictionless demo signup). User chose to keep the default. Consequence: `signup` doesn't auto-create a session — the UI shows "check your email" and the user must click the confirmation link before logging in. RLS/integration tests bypass this by creating pre-confirmed users via the Admin API (`email_confirm: true`).
- **`middleware.ts` renamed to `proxy.ts`** with the exported function renamed `middleware` → `proxy`. Next.js 16.2.10 deprecated the `middleware` file convention in favor of `proxy`; using the old name emitted a build warning (and would eventually break). Behavior is unchanged — same route matching, same session-refresh logic in `lib/supabase/middleware.ts`.
- **Vercel deploy done via CLI**, not GitHub-triggered CI. Project linked with `vercel link`, env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) set for Production + Development via `vercel env add`. Preview-environment vars were not set (Vercel required an explicit branch and it's not needed yet) — add them before relying on preview deployments.
- **`SUPABASE_SERVICE_ROLE_KEY` and DB password live only in `.env.local`** (gitignored) and were not pushed to Vercel, per the plan — no Vercel server route uses the service role yet. They'll be needed as Supabase Edge Function secrets in Phase 2, not as Vercel env vars.
