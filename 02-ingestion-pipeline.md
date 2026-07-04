# Phase 2 — Ingestion Pipeline (Budget: 1.5h)

**Context:** Read `00-MASTER-PLAN.md` §2 and §4. This phase builds the detector (single source of truth), the ingest Edge Function, the JS pixel, and the Next.js middleware tracker. Everything downstream consumes this event shape — get it right, freeze it.

## Objectives
1. `shared/bot-registry.ts`: 2026-accurate bot registry + pure `classifyBot(ua)`.
2. Supabase Edge Function `ingest`: accepts pixel GETs and server POSTs, classifies, inserts.
3. Distributable pixel snippet and Next.js middleware helper.
4. Verification path (`is_verification` events) that Phase 5's button will trigger.

## Deliverables

### 2.1 `shared/bot-registry.ts`
Pure data + pure functions, zero deps, importable by Deno AND Node/Edge.

```ts
export type BotCategory = 'training' | 'indexing' | 'conversations' | 'agent' | 'unknown';
export interface BotDef { pattern: RegExp; name: string; platform: string; category: BotCategory; }
```

Registry — **order most-specific-first** (e.g. `ChatGPT-User` before any generic match; `Claude-SearchBot` and `Claude-User` before `ClaudeBot` is not strictly needed since patterns differ, but keep the discipline):

| Pattern (case-insensitive substring) | Platform | Category |
|---|---|---|
| ChatGPT-User | OpenAI | conversations |
| OAI-SearchBot | OpenAI | indexing |
| GPTBot | OpenAI | training |
| Claude-SearchBot | Anthropic | indexing |
| Claude-User | Anthropic | conversations |
| Claude-Web | Anthropic | conversations |
| ClaudeBot | Anthropic | training |
| anthropic-ai | Anthropic | training |
| Perplexity-User | Perplexity | conversations |
| PerplexityBot | Perplexity | indexing |
| Google-CloudVertexBot | Google | indexing |
| Google-Agent | Google | agent |
| GoogleOther | Google | training |
| Googlebot | Google | indexing |
| MistralAI-User | Mistral | conversations |
| Meta-ExternalFetcher | Meta | conversations |
| Meta-ExternalAgent | Meta | training |
| FacebookBot | Meta | training |
| Applebot-Extended... **DO NOT ADD** — robots.txt token, never in UA (same: Google-Extended) | | |
| Applebot | Apple | indexing |
| Amazonbot | Amazon | training |
| Bytespider | ByteDance | training |
| CCBot | Common Crawl | training |
| DeepSeekBot | DeepSeek | training |
| GrokBot | xAI | training |
| DuckAssistBot | DuckDuckGo | indexing |
| YouBot | You.com | indexing |
| cohere-ai | Cohere | training |
| AI2Bot | Allen AI | training |
| bingbot | Microsoft | indexing |

Fallback: if UA matches `/bot|crawl|spider|scrape/i` → `{name:'Unknown bot', platform:'Unknown', category:'unknown'}`. Otherwise return `null` (human traffic — the ingest function still stores pixel events? **No: drop non-bot events.** This product tracks crawlers only; storing human traffic bloats the table and muddies the demo).

Also export `FULL_UA_SAMPLES: Record<botName, string>` — real-world full strings for the seeder/simulator, e.g. `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)`. Include realistic full strings for at least the top 10 bots.

**Sync mechanism:** `scripts/sync-shared.ts` copies `shared/bot-registry.ts` → `supabase/functions/_shared/bot-registry.ts`. Add npm scripts: `sync:shared` and `check:shared` (diff-fails if drifted); run `check:shared` in the build script.

### 2.2 Edge Function `supabase/functions/ingest/index.ts`
- **POST** (middleware/simulator/verification): JSON body `{ site_id, page_url, user_agent, status_code?, method?, source?, is_verification? }`.
- **GET** (pixel beacon): query params `sid`, `u` (page URL), UA from the request header. Respond `204` (or 1×1 gif — 204 is fine).
- Logic: validate `site_id` exists (service-role lookup; return 404 if not) → `classifyBot(ua)` → if null (human), return 204 without insert → compute `page_path` from URL → `ip_hash = sha256(salt + ip)` using `IP_HASH_SALT` secret, IP from `x-forwarded-for` → insert with service role.
- CORS: `Access-Control-Allow-Origin: *`, handle `OPTIONS`. `verify_jwt = false` for this function (public endpoint) — set in `supabase/config.toml` or deploy flag.
- Cap `user_agent` at 512 chars, `page_url` at 2048. Reject bodies >4KB. (Cheap abuse hygiene; real rate limiting is documented as v2.)

### 2.3 Pixel snippet (`public/tracker.js` + embed snippet)
- `tracker.js` (<2KB): reads `data-site` attr or `?sid=` from its own script tag, sends `navigator.sendBeacon` (fallback `fetch keepalive`) GET/POST to the ingest URL with `location.href`.
- Embed snippet (shown in onboarding, Phase 6):
  ```html
  <script async src="https://<app>.vercel.app/tracker.js" data-site="SITE_ID"></script>
  ```
- Include the honest comment in the docs: "captures JS-executing agents only — install the middleware for full coverage."

### 2.4 Next.js middleware helper (`shared/track-crawlers.ts`, published as copy-paste doc)
```ts
export function trackAiCrawlers(req: Request, cfg: { siteId: string; endpoint: string }) {
  const ua = req.headers.get('user-agent') ?? '';
  if (!/bot|crawl|spider|scrape|GPTBot|Claude|Perplexity|OAI/i.test(ua)) return; // cheap pre-filter
  // fire-and-forget; NEVER await in the request path
  fetch(cfg.endpoint, { method: 'POST', body: JSON.stringify({
    site_id: cfg.siteId, page_url: req.url, user_agent: ua,
    method: req.method, source: 'server',
  })}).catch(() => {});
}
```
- Document usage inside a customer's `middleware.ts` (call, then `return NextResponse.next()`).
- **Dogfood it**: install it in OUR app's own middleware pointing at a demo site row — our deployed app tracks crawlers hitting itself. One-line flex in the demo.

## Acceptance checklist
- [ ] `curl -X POST` to deployed ingest with a GPTBot UA → row appears with `platform='OpenAI', bot_category='training'`, correct `page_path`, non-null `ip_hash`.
- [ ] Same with `ChatGPT-User` → `conversations` (proves ordering).
- [ ] Human UA (Chrome) → 204, **no row**.
- [ ] Unknown UA containing "crawler" → `Unknown bot / unknown` row.
- [ ] Invalid `site_id` → 404, no row.
- [ ] GET beacon path works from a browser (open a test HTML page with the snippet; spoof UA via curl for bot case).
- [ ] `check:shared` fails when the two registry copies differ.
- [ ] Unit tests for `classifyBot` covering ≥12 UAs incl. full real-world strings and the Google-Extended trap (assert it does NOT classify as a bot via a UA that merely mentions it — nonexistent in practice, so just assert registry has no such entry).

## Gotchas
- Supabase Edge Functions default to requiring a JWT — the ingest endpoint must disable that or every beacon 401s.
- `x-forwarded-for` may contain a list; take the first hop.
- Regex objects can't be `JSON.stringify`'d — keep registry as TS source, not JSON, and rely on the copy-sync script.
- Full real UAs contain "Mozilla/5.0" — never anchor patterns to string start.

## Out of scope this phase
Dashboard UI, verification BUTTON (Phase 5 — but the `is_verification` flag path must already work via curl), dedup, IP-range verification.
