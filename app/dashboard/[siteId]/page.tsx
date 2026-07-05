import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseFilters, resolveDateWindow } from "@/lib/dashboard/filters";
import {
  fetchDistinctPlatforms,
  fetchFeedEvents,
  fetchPlatformBreakdown,
  fetchStatsSummary,
  fetchTimeseries,
  fetchTopPages,
} from "@/lib/dashboard/queries";
import { TopBar } from "@/components/dashboard/TopBar";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { PlatformBreakdownChart } from "@/components/dashboard/PlatformBreakdownChart";
import { PagesTable } from "@/components/dashboard/PagesTable";
import { Feed } from "@/components/dashboard/Feed";
import { CsvExportButton } from "@/components/dashboard/CsvExportButton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

function toURLSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      params.append(key, v);
    }
  }
  return params;
}

export default async function SiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteId } = await params;
  const resolvedSearchParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("id", siteId)
    .single();
  if (siteError || !site) notFound();

  const filters = parseFilters(toURLSearchParams(resolvedSearchParams));
  const window = resolveDateWindow(filters.range);

  const [stats, timeseries, pages, feedEvents, platforms, platformBreakdown] =
    await Promise.all([
      fetchStatsSummary(supabase, siteId, window),
      fetchTimeseries(
        supabase,
        siteId,
        window,
        filters.category,
        filters.platforms,
      ),
      fetchTopPages(supabase, siteId, window, filters.category, filters.platforms),
      fetchFeedEvents(
        supabase,
        siteId,
        window,
        filters.category,
        filters.platforms,
      ),
      fetchDistinctPlatforms(supabase, siteId, window),
      fetchPlatformBreakdown(
        supabase,
        siteId,
        window,
        filters.category,
        filters.platforms,
      ),
    ]);

  const isEmpty = stats.total === 0;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={site.domain}
        backHref="/dashboard"
        settingsHref={`/dashboard/${siteId}/settings`}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FilterBar
            siteId={siteId}
            filters={filters}
            availablePlatforms={platforms}
          />
          <CsvExportButton
            siteId={siteId}
            domain={site.domain}
            filters={filters}
            hasEvents={!isEmpty}
          />
        </div>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <HeroStats
              siteId={siteId}
              filters={filters}
              stats={stats}
              timeseries={timeseries}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-2">
                <ActivityChart timeseries={timeseries} range={filters.range} />
              </Card>
              <Card className="p-4">
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  By platform
                </h2>
                {platformBreakdown.length > 0 ? (
                  <PlatformBreakdownChart platforms={platformBreakdown} />
                ) : (
                  <p className="text-sm text-muted-foreground">No data in range.</p>
                )}
              </Card>
            </div>
            <Tabs defaultValue="feed">
              <TabsList>
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
              </TabsList>
              <TabsContent value="feed">
                <Feed initialEvents={feedEvents} />
              </TabsContent>
              <TabsContent value="pages">
                <PagesTable pages={pages} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
