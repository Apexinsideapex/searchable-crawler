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
