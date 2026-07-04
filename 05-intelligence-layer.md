# Phase 5 — Intelligence Layer / Wow Factor (Budget: 2.0h)

**Context:** Three items in strict priority order — the cut line falls bottom-up if time runs short. Each is independently shippable. This is where the demo goes from "solid" to "hire this person."

## 5.1 Realtime live feed + Send Verification (P0 of this phase, ~40min)

### Realtime
- Supabase Realtime subscription on `crawler_events` INSERTs filtered by `site_id` (publication enabled in Phase 1; RLS select policy authorizes the channel).
- New events prepend into the Feed with a brief highlight animation; hero counters increment optimistically; a small "LIVE" pulse dot when the channel is connected.
- Debounce: if >5 events/sec arrive, batch UI updates (simulator can burst).

### Send Verification button
- Button in the dashboard header: "Send test crawl". Calls the deployed `ingest` endpoint with a real full GPTBot UA, current site homepage as URL, `source:'verification'`, `is_verification:true`.
- Expected on-stage result: click → event slides into the live feed with a "verified" badge in <5 seconds. **This is the demo money-shot — test it on the deployed URL until it's boringly reliable.**

## 5.2 LLM Intelligence Brief (~60min)

### Edge Function `insights`
- Auth: called from the dashboard with the user's JWT; verify site ownership.
- **Context blob** assembled server-side (this is the craft — small, structured, information-dense):
  - Category totals current vs previous period (+ deltas)
  - Top 15 pages with visit counts + per-category split
  - Per-platform totals + deltas (this surfaces the ClaudeBot ramp)
  - First-seen bots in last 7 days (surfaces DeepSeekBot)
  - Status-code distribution per page where non-200 (surfaces the 404 page)
  - Day-over-day platform z-scores or simple max/mean ratios (surfaces the Bytespider spike)
- **LLM call**: Anthropic Messages API (`claude-sonnet-4-6`, `ANTHROPIC_API_KEY` as Supabase secret). System prompt: "You are an AEO analyst… return ONLY JSON matching this schema: `{ insights: [{ severity: 'info'|'warning'|'critical', headline, body, affected_pages: string[], suggested_action }] } — 3 to 5 insights, prioritized, specific numbers over adjectives."` Strip code fences defensively before `JSON.parse`.
- **Cache**: upsert into `insights_cache`; serve cached if `generated_at` < 4h old; "Refresh" button bypasses.
- **Deterministic fallback** (never an empty brief): if the LLM call fails or returns unparseable JSON, compute 2–3 rule-based insights from the same context blob (biggest platform delta, any 404 page, any first-seen bot).

### UI
- "Intelligence Brief" card at the top of the dashboard: severity icon, headline, expandable body, affected page chips (clicking one filters the Pages tab), generated-at timestamp, refresh button, subtle "AI-generated — verify before acting" note.

## 5.3 Access Check (stretch, ~20min — cut first)
- Edge Function `access-check`: fetch `https://<site.domain>/robots.txt` (+ HEAD `llms.txt`), parse User-agent blocks, return per-AI-bot allow/block matrix.
- UI: simple matrix table (bot × allowed?) + llms.txt found/not-found + one-line explainer that `Google-Extended`/`Applebot-Extended` are control tokens that live HERE, not in access logs (ties the PRD correction into the product).
- Use a real domain with a robots.txt for the demo site (e.g. the domain seeded in Phase 3 can be a real site the user owns, or fall back to any public domain).

## Acceptance checklist
- [ ] Two browser windows: simulator running in terminal → events stream into the feed in window 1 AND window 2 (proves realtime, not polling).
- [ ] Send Verification: 10/10 successful runs on the deployed URL, event visible <5s.
- [ ] Insights brief renders 3–5 insights referencing ≥3 planted story-arc items by name/number.
- [ ] Kill the API key in a test → fallback insights render, no error state visible to user.
- [ ] Cache: second load within 4h makes no LLM call (check function logs).
- [ ] (If built) Access check renders a correct matrix for a known robots.txt.

## Gotchas
- Realtime + RLS: the subscribing client must be the authenticated user or the channel silently receives nothing. Test signed-in.
- Realtime payloads exclude columns > a size threshold in some configs — select what you need on the client if the payload looks truncated; simplest robust path: use the INSERT payload directly, it fits.
- LLM latency (2–8s): show a skeleton loader; never block the rest of the dashboard on the brief.
- Do not let the model see raw UAs or hashes — aggregates only (token cost + focus).

## Out of scope
Alerts, workflows, synthetic page-fetch-as-GPTBot health checks (mention as roadmap), citations funnel.
