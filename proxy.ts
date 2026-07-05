import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { trackAiCrawlers } from "@/shared/track-crawlers";

// Dogfooding: this app tracks AI crawlers hitting its own deployed domain,
// via the same middleware helper we ship to customers. This `sites` row is
// a permanent fixture (not test/verification data) — see handoffs/TRACKER.md
// and shared/track-crawlers.ts for the contract.
const DOGFOOD_SITE_ID = "73e3e3e0-6303-4c3e-8e45-dbbeeadcaf3a"; // searchable-crawler.vercel.app
const INGEST_ENDPOINT =
  "https://onecvommgdocankabufy.supabase.co/functions/v1/ingest";

export async function proxy(request: NextRequest) {
  // Fire-and-forget; must never be awaited or allowed to affect the
  // auth/session-refresh response below.
  trackAiCrawlers(request, { siteId: DOGFOOD_SITE_ID, endpoint: INGEST_ENDPOINT });
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
