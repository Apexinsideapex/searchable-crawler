import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDateWindow } from "@/lib/dashboard/filters";
import { fetchStatsSummary } from "@/lib/dashboard/queries";
import { TopBar } from "@/components/dashboard/TopBar";
import { CodeSnippet } from "@/components/dashboard/CodeSnippet";
import { CopyAgentPromptButton } from "@/components/dashboard/CopyAgentPromptButton";
import { SendTestCrawlButton } from "@/components/dashboard/SendTestCrawlButton";
import { CsvExportButton } from "@/components/dashboard/CsvExportButton";
import { DeleteSiteForm } from "@/components/dashboard/DeleteSiteForm";
import { AccessCheck } from "@/components/dashboard/AccessCheck";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Settings has no filter bar of its own, so the export here covers the
// widest supported window (30d) across all categories/platforms -- the
// filtered export for a specific range still lives on the main dashboard.
const EXPORT_FILTERS = { range: "30d", category: "all", platforms: null } as const;

// The app's own deployed origin -- hardcoded to match the existing pattern
// in README.md / proxy.ts (one Vercel project, one production domain).
const APP_ORIGIN = "https://searchable-crawler.vercel.app";

function pixelSnippet(siteId: string): string {
  return `<script async src="${APP_ORIGIN}/tracker.js" data-site="${siteId}"></script>`;
}

function middlewareSnippet(siteId: string, ingestUrl: string): string {
  // Fully self-contained: everything lives in the customer's own
  // middleware.ts. No import from this repo's shared/ dir (which they don't
  // have) and no second file to create -- true copy-paste.
  return `// middleware.ts -- place at the root of your Next.js project
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const SITE_ID = "${siteId}";
const INGEST_URL = "${ingestUrl}";

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|scrape|chatgpt|gpt|claude|anthropic|perplexity|oai|google|gemini|meta|facebook|mistral|deepseek|grok|duckassist|you\\.com|cohere|ai2/i.test(ua)) {
    // Build the URL from the public host header -- req.url reports the
    // internal bind address (e.g. 0.0.0.0:8080 / localhost) when self-hosted
    // (Cloud Run, Docker, etc.), which would break domain matching.
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const pageUrl = host
      ? \`https://\${host}\${req.nextUrl.pathname}\${req.nextUrl.search}\`
      : req.url;
    // waitUntil keeps the serverless invocation alive until the report
    // finishes, without delaying the response. A bare fire-and-forget
    // fetch can be dropped once the response returns. Errors swallowed.
    event.waitUntil(
      fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: SITE_ID,
          page_url: pageUrl,
          user_agent: ua,
          method: req.method,
          source: "server",
        }),
      }).catch(() => {}),
    );
  }
  return NextResponse.next();
}

// If you already have a config.matcher, merge these excludes into it
// rather than adding a second config export.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|png|jpg|svg)).*)"],
};`;
}

/** Handoff prompt so the user can paste the pixel install to their AI agent. */
function pixelAgentPrompt(siteId: string): string {
  return `Add AI-crawler analytics tracking to this website.

Load this exact script tag on every page, in the global <head> (e.g. app/layout.tsx, pages/_document, index.html, or the framework's head/script mechanism — for Next.js prefer next/script):

${pixelSnippet(siteId)}

Rules:
- Do NOT change the src or data-site values.
- It must load site-wide, not on a single page.
- If this is a React/Next app, use the framework's head/script API rather than raw HTML.

When done, tell me one way to verify it's firing.`;
}

/** Handoff prompt so the user can paste the middleware install to their AI agent. */
function middlewareAgentPrompt(siteId: string, ingestUrl: string): string {
  return `Add server-side AI-crawler analytics tracking to this Next.js app.

Create a file named middleware.ts at the project root (next to package.json, or inside src/ if the project uses a src directory) with exactly this content:

${middlewareSnippet(siteId, ingestUrl)}

Rules:
- Do NOT change SITE_ID or INGEST_URL.
- If a middleware.ts already exists, do NOT overwrite it. Instead merge this in: run the bot-detection + event.waitUntil(fetch(...)) block inside the existing middleware function before it returns, and merge the config.matcher excludes into the existing matcher rather than adding a second config export. Preserve all existing middleware behavior.
- The fetch must stay inside event.waitUntil and must never be awaited, so it never delays the response.
- IMPORTANT (CDN caching): middleware only runs when a request reaches the origin. Statically generated pages are served from a CDN/full-route cache (default Cache-Control s-maxage), so crawlers on cached pages never trigger the middleware. Do NOT try to fix this with a next.config headers() Cache-Control rule — Next.js overwrites Cache-Control for pages, so it has no effect. The correct fix is route segment config: add "export const dynamic = 'force-dynamic'" (App Router) — in the root layout to cover the whole app, and/or on the specific page files you want tracked. On Pages Router, use getServerSideProps / an equivalent that opts the page out of static generation. This makes pages render per-request so every request reaches the origin and the middleware runs.

When done, tell me one way to verify it's firing (and confirm a request to a cached-looking page now shows Cache-Control: no-store / private instead of a long s-maxage).`;
}

export default async function SiteSettingsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: site, error } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("id", siteId)
    .single();
  if (error || !site) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ingestUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/ingest`;

  const exportWindow = resolveDateWindow(EXPORT_FILTERS.range);
  const exportStats = await fetchStatsSummary(supabase, site.id, exportWindow);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title={`${site.domain} — Settings`} backHref={`/dashboard/${site.id}`} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Site info</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">Domain: </span>
              {site.domain}
            </p>
            <p>
              <span className="text-muted-foreground">Site ID: </span>
              <code className="text-xs">{site.id}</code>
            </p>
            <Link
              href="/dashboard/new"
              className="mt-2 w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              + Add another site
            </Link>
          </CardContent>
        </Card>

        <AccessCheck siteId={siteId} />

        <Card>
          <CardHeader>
            <CardTitle>Install tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pixel">
              <TabsList>
                <TabsTrigger value="pixel">Pixel (30 seconds)</TabsTrigger>
                <TabsTrigger value="middleware">
                  Next.js Middleware (recommended)
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pixel" className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  One script tag, any framework — 30-second install. But it
                  only catches <strong>JS-executing</strong> agents (Applebot,
                  Gemini, browser-based AI agents). It <strong>cannot</strong>{" "}
                  see GPTBot, ClaudeBot or PerplexityBot — install the
                  middleware for those.
                </p>
                <CodeSnippet code={pixelSnippet(site.id)} />
                <CopyAgentPromptButton prompt={pixelAgentPrompt(site.id)} />
              </TabsContent>
              <TabsContent value="middleware" className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  The only way to catch GPTBot, ClaudeBot and PerplexityBot,
                  which never execute JavaScript and are invisible to the
                  pixel. Next.js only; drop this one file at your project root
                  (no extra dependencies, no build step).
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Heads up on caching:</strong> middleware only runs
                  when a request reaches your origin. Statically generated
                  pages served from a CDN/edge cache (common on self-hosted
                  Next.js — Cloud Run, etc.) bypass it, so crawlers on cached
                  pages go untracked. (On Vercel, middleware runs at the edge
                  before the cache, so this doesn&apos;t happen.) If your pages
                  are cached, add{" "}
                  <code className="text-xs">
                    export const dynamic = &quot;force-dynamic&quot;
                  </code>{" "}
                  to the root layout (or the pages you want tracked) so they hit
                  the origin — the &ldquo;Copy prompt&rdquo; button tells your
                  agent to do this. Add the pixel too for JS-executing agents on
                  cached pages.
                </p>
                <CodeSnippet code={middlewareSnippet(site.id, ingestUrl)} />
                <CopyAgentPromptButton
                  prompt={middlewareAgentPrompt(site.id, ingestUrl)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verify install</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Send a synthetic GPTBot visit through the real ingestion
              pipeline, then check whether it landed.
            </p>
            <SendTestCrawlButton siteId={site.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Exports the last 30 days across all categories and platforms.
              For a specific range or filter, use the export button on the{" "}
              <Link
                href={`/dashboard/${site.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                dashboard
              </Link>
              .
            </p>
            <CsvExportButton
              siteId={site.id}
              domain={site.domain}
              filters={EXPORT_FILTERS}
              hasEvents={exportStats.total > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteSiteForm siteId={site.id} domain={site.domain} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
