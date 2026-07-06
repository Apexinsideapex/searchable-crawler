# searchable-crawler
Crawler for Searchable 

## Pixel snippet (`public/tracker.js`)

Client-side beacon that captures AI agents/bots that actually execute
JavaScript on a customer's page. Add this tag anywhere in the page
(`async` so it never blocks rendering):

```html
<script async src="https://searchable-crawler.vercel.app/tracker.js" data-site="SITE_ID"></script>
```

`SITE_ID` is the UUID of the customer's `sites` row, shown (with a ready-to-
copy snippet and a "Copy prompt for your AI agent" button) on the site's
**Settings → Install tracking** page.

**Honest caveat:** this captures JS-executing agents only — install the
Next.js middleware (see below) for full coverage. Most real crawlers
(GPTBot, ClaudeBot, PerplexityBot, etc.) do not execute JavaScript at all
and will never fire this pixel; the middleware is the path that catches
those.

**Domain-binding:** the ingest endpoint rejects any event whose `page_url`
host isn't the site's registered `domain` (or a subdomain of it) with a
`403 domain_mismatch`. Since `SITE_ID` is inherently public (it ships in the
page), this stops a leaked id from being used to inject spoofed traffic for
arbitrary pages. Practical consequence: the domain you register for a site
must match where you install the snippet.

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

## Middleware tracker (Next.js)

Server-side capture that catches real crawlers (GPTBot, ClaudeBot,
PerplexityBot, etc.) directly on the request path — most of them never
execute JavaScript, so the pixel above never sees them.

The Settings page generates a **fully self-contained `middleware.ts`** — no
extra files to copy, no dependencies beyond `next/server`. Drop it at your
project root (or `src/middleware.ts`; `proxy.ts` on Next.js 16+, which
renamed the file):

```ts
// middleware.ts -- place at the root of your Next.js project
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const SITE_ID = "SITE_ID"; // UUID of your `sites` row, from Settings
const INGEST_URL = "https://onecvommgdocankabufy.supabase.co/functions/v1/ingest";

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|scrape|chatgpt|gpt|claude|anthropic|perplexity|oai|google|gemini|meta|facebook|mistral|deepseek|grok|duckassist|you\.com|cohere|ai2/i.test(ua)) {
    event.waitUntil(
      fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: SITE_ID,
          page_url: req.url,
          user_agent: ua,
          method: req.method,
          source: "server",
        }),
      }).catch(() => {}),
    );
  }
  return NextResponse.next();
}

// If you already have a config.matcher, merge these excludes into it.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|png|jpg|svg)).*)"],
};
```

### How it works
- A cheap regex pre-filters the `User-Agent` header before doing any network
  work — the overwhelming majority of requests are human traffic and never
  reach the `fetch` call. The regex deliberately over-matches; the ingest
  Edge Function does the authoritative classification
  (`shared/bot-registry.ts`) and silently drops anything that isn't a
  recognized crawler, so a false positive here only costs one wasted
  request, never a bad database row.
- Sends a JSON **POST** (`site_id`, `page_url`, `user_agent`, `method`,
  `source: "server"`) — unlike the pixel, this runs entirely server-side, so
  there's no `navigator.userAgent` to read; the request's own `User-Agent`
  header is forwarded as-is.
- **Never blocks the response.** The `fetch` is wrapped in
  `event.waitUntil(...)` and its rejection swallowed with `.catch(() => {})`.
  `waitUntil` keeps the serverless invocation alive until the report
  finishes *after* the response is sent — a bare un-awaited `fetch` can be
  dropped once the response returns on Vercel Edge / Cloudflare / Cloud Run,
  so `waitUntil` is what makes delivery reliable without adding latency.

### Internal helper (`shared/track-crawlers.ts`)

The same logic also lives as a dependency-free helper, `trackAiCrawlers`,
which **this app** installs in its own `proxy.ts` (dogfooding — pointed at a
`sites` row for `searchable-crawler.vercel.app`, so the app tracks AI
crawlers hitting itself). Customers get the inlined single-file snippet above
rather than this helper, so there's no second file to copy into their repo.
