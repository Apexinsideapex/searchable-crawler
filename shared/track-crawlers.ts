/**
 * shared/track-crawlers.ts
 *
 * Next.js middleware helper that reports AI-crawler traffic to the ingest
 * Edge Function. Zero dependencies — safe to copy-paste into a customer's
 * own Next.js project as-is.
 *
 * ## Usage (customer's `middleware.ts` / `proxy.ts`)
 *
 * ```ts
 * import { NextResponse } from "next/server";
 * import { trackAiCrawlers } from "./shared/track-crawlers";
 *
 * export function middleware(req: Request) {
 *   trackAiCrawlers(req, {
 *     siteId: "YOUR_SITE_ID", // UUID of your `sites` row, shown in onboarding
 *     endpoint: "https://onecvommgdocankabufy.supabase.co/functions/v1/ingest",
 *   });
 *   return NextResponse.next();
 * }
 * ```
 *
 * ## Design notes
 * - Cheap regex pre-filter avoids firing a request (and a DNS/TLS handshake)
 *   for the overwhelming majority of human traffic. It intentionally
 *   over-matches (e.g. plain "bot") — the ingest function does the
 *   authoritative classification via `bot-registry.ts` and silently drops
 *   anything that isn't a recognized crawler, so a false positive here just
 *   costs one wasted fetch, never a bad row in the database.
 * - **Fire-and-forget by contract.** This function must never be awaited by
 *   the caller and must never await the fetch itself — doing so would add
 *   crawler-tracking latency to every matching request on the customer's
 *   site, which is the one thing this helper must never do. `.catch(() => {})`
 *   swallows network errors so an ingest outage can never surface as an
 *   unhandled rejection or a slow/broken customer page.
 */
export function trackAiCrawlers(
  req: Request,
  cfg: { siteId: string; endpoint: string },
): void {
  const ua = req.headers.get("user-agent") ?? "";
  if (!/bot|crawl|spider|scrape|GPTBot|Claude|Perplexity|OAI/i.test(ua)) {
    return; // cheap pre-filter — not worth a network round trip
  }

  // Fire-and-forget: intentionally not awaited, and any rejection is
  // swallowed. Never add `await` here or in the caller.
  fetch(cfg.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      site_id: cfg.siteId,
      page_url: req.url,
      user_agent: ua,
      method: req.method,
      source: "server",
    }),
  }).catch(() => {});
}
