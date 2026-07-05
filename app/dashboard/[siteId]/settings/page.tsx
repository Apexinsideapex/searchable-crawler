import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDateWindow } from "@/lib/dashboard/filters";
import { fetchStatsSummary } from "@/lib/dashboard/queries";
import { TopBar } from "@/components/dashboard/TopBar";
import { CodeSnippet } from "@/components/dashboard/CodeSnippet";
import { SendTestCrawlButton } from "@/components/dashboard/SendTestCrawlButton";
import { CsvExportButton } from "@/components/dashboard/CsvExportButton";
import { DeleteSiteForm } from "@/components/dashboard/DeleteSiteForm";
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
  return `import { NextResponse } from "next/server";
import { trackAiCrawlers } from "./shared/track-crawlers";

export function middleware(req: Request) {
  trackAiCrawlers(req, {
    siteId: "${siteId}",
    endpoint: "${ingestUrl}",
  });
  return NextResponse.next();
}`;
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
                  Fastest install. Catches JS-executing agents: Applebot,
                  Gemini, and browser-based AI agents.
                </p>
                <CodeSnippet code={pixelSnippet(site.id)} />
              </TabsContent>
              <TabsContent value="middleware" className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  GPTBot, ClaudeBot and PerplexityBot never execute
                  JavaScript — they&apos;re invisible to browser scripts.
                  Server-side sees every request. Install both for full
                  coverage.
                </p>
                <CodeSnippet code={middlewareSnippet(site.id, ingestUrl)} />
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
