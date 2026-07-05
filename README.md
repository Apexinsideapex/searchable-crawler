# searchable-crawler
Crawler for Searchable 

## Pixel snippet (`public/tracker.js`)

Client-side beacon that captures AI agents/bots that actually execute
JavaScript on a customer's page. Add this tag anywhere in the page
(`async` so it never blocks rendering):

```html
<script async src="https://searchable-crawler.vercel.app/tracker.js" data-site="SITE_ID"></script>
```

`SITE_ID` is the UUID of the customer's `sites` row (shown in onboarding —
Phase 6 wires this into the UI; for now it's just a static snippet).

**Honest caveat:** this captures JS-executing agents only — install the
Next.js middleware helper (`shared/track-crawlers.ts`) for full coverage.
Most real crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) do not execute
JavaScript at all and will never fire this pixel; the middleware is the
path that catches those.

### How it works
- Reads `site_id` from the script tag's `data-site` attribute (via
  `document.currentScript`, read synchronously at top-level execution —
  this is reliable even for `async` scripts; a `script[src*="tracker.js"]`
  lookup and a `?sid=` query param on the script's own `src` URL are the
  fallbacks if `currentScript` is ever null).
- Sends a plain **GET** to the ingest endpoint with `sid` + `u` (the page
  URL) as query params, instead of a JSON POST body. This lets the ingest
  Edge Function read the request's real `User-Agent` **header** itself,
  rather than us reading `navigator.userAgent` in JS and shipping it as a
  field — the header reflects what the JS-driven agent's own HTTP client
  actually sent.
- `navigator.sendBeacon` always issues a POST (it has no bare-GET mode),
  so a literal sendBeacon call here would mean building the same JSON body
  the middleware sends. Instead the pixel uses
  `fetch(url, { keepalive: true, mode: 'no-cors' })` for the GET — like
  sendBeacon, `keepalive` requests are allowed to outlive page unload —
  with a plain `new Image().src = url` ping as the universal fallback for
  browsers without `fetch`.
- Wrapped in try/catch with every lookup null-checked: the script must
  never throw and break the host page. If `site_id` can't be determined,
  it does nothing.

Ingest endpoint (hardcoded as a single `const` at the top of
`tracker.js` for easy change later):
`https://onecvommgdocankabufy.supabase.co/functions/v1/ingest`

## Middleware tracker (`shared/track-crawlers.ts`)

Server-side capture that catches real crawlers (GPTBot, ClaudeBot,
PerplexityBot, etc.) directly on the request path — most of them never
execute JavaScript, so the pixel above never sees them. Copy this file into
your own Next.js project and call it from your `middleware.ts` (or `proxy.ts`
on Next.js 16+, which renamed the file):

```ts
import { NextResponse } from "next/server";
import { trackAiCrawlers } from "./shared/track-crawlers";

export function middleware(req: Request) {
  trackAiCrawlers(req, {
    siteId: "SITE_ID", // UUID of your `sites` row, shown in onboarding
    endpoint: "https://onecvommgdocankabufy.supabase.co/functions/v1/ingest",
  });
  return NextResponse.next();
}
```

### How it works
- A cheap regex (`/bot|crawl|spider|scrape|GPTBot|Claude|Perplexity|OAI/i`)
  pre-filters the `User-Agent` header before doing any network work — the
  overwhelming majority of requests are human traffic and never reach the
  `fetch` call. The regex deliberately over-matches; the ingest Edge
  Function does the authoritative classification (`shared/bot-registry.ts`)
  and silently drops anything that isn't a recognized crawler, so a false
  positive here only costs one wasted request, never a bad database row.
- Sends a JSON **POST** (`site_id`, `page_url`, `user_agent`, `method`,
  `source: "server"`) — unlike the pixel, this runs entirely server-side, so
  there's no `navigator.userAgent` to read; the request's own `User-Agent`
  header is forwarded as-is.
- **Fire-and-forget by contract**: `trackAiCrawlers` never awaits the
  `fetch` and swallows any rejection with `.catch(() => {})`. Callers must
  never `await` it either — the whole point is that crawler tracking can
  never add latency to (or break) a customer's real request/response cycle,
  even during an ingest-endpoint outage.

**Dogfooding:** this app installs `trackAiCrawlers` in its own `proxy.ts`,
pointed at a `sites` row for `searchable-crawler.vercel.app` — the app
tracks AI crawlers hitting itself.
