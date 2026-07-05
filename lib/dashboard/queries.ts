import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryKey, DateWindow } from "./filters";
import type { CrawlerEventRow } from "./csv";

export interface StatsSummary {
  total: number;
  training: number;
  indexing: number;
  conversations: number;
  prev_total: number;
  prev_training: number;
  prev_indexing: number;
  prev_conversations: number;
}

export interface TimeseriesPoint {
  bucket_start: string;
  category: string;
  count: number;
}

export interface PlatformCount {
  platform: string;
  count: number;
}

export interface TopPageRow {
  page_path: string;
  total_visits: number;
  unique_bots: number;
  top_platform: string;
  last_seen: string;
}

export interface FeedEventRow extends CrawlerEventRow {
  id: string;
  page_path: string;
  is_verification: boolean;
}

const FEED_COLUMNS =
  "id, occurred_at, page_url, page_path, bot_name, platform, bot_category, status_code, source, is_verification, user_agent";

function categoryParam(category: CategoryKey): string | null {
  return category === "all" ? null : category;
}

function platformsParam(platforms: string[] | null): string[] | null {
  return platforms && platforms.length > 0 ? platforms : null;
}

export async function fetchStatsSummary(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
): Promise<StatsSummary> {
  const { data, error } = await supabase
    .rpc("stats_summary", {
      p_site_id: siteId,
      p_from: window.from.toISOString(),
      p_to: window.to.toISOString(),
      p_prev_from: window.prevFrom.toISOString(),
      p_prev_to: window.prevTo.toISOString(),
    })
    .single();
  if (error) throw error;

  const row = data as Record<string, number | string>;
  return {
    total: Number(row.total),
    training: Number(row.training),
    indexing: Number(row.indexing),
    conversations: Number(row.conversations),
    prev_total: Number(row.prev_total),
    prev_training: Number(row.prev_training),
    prev_indexing: Number(row.prev_indexing),
    prev_conversations: Number(row.prev_conversations),
  };
}

export async function fetchTimeseries(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
  category: CategoryKey,
  platforms: string[] | null,
): Promise<TimeseriesPoint[]> {
  const { data, error } = await supabase.rpc("timeseries", {
    p_site_id: siteId,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
    p_bucket: window.bucket,
    p_category: categoryParam(category),
    p_platforms: platformsParam(platforms),
  });
  if (error) throw error;

  return (data as Array<Record<string, string | number>>).map((row) => ({
    bucket_start: String(row.bucket_start),
    category: String(row.category),
    count: Number(row.count),
  }));
}

export async function fetchTopPages(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
  category: CategoryKey,
  platforms: string[] | null,
): Promise<TopPageRow[]> {
  const { data, error } = await supabase.rpc("top_pages", {
    p_site_id: siteId,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
    p_category: categoryParam(category),
    p_platforms: platformsParam(platforms),
  });
  if (error) throw error;

  return (data as Array<Record<string, string | number>>).map((row) => ({
    page_path: String(row.page_path),
    total_visits: Number(row.total_visits),
    unique_bots: Number(row.unique_bots),
    top_platform: String(row.top_platform),
    last_seen: String(row.last_seen),
  }));
}

// Supabase's PostgrestFilterBuilder generics don't thread cleanly through a
// shared helper without generated Database types; narrow to `any` here and
// let each caller's own return-type annotation keep the public API typed.
export async function fetchDistinctPlatforms(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("distinct_platforms", {
    p_site_id: siteId,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
  });
  if (error) throw error;
  return (data as Array<{ platform: string }>).map((row) => row.platform);
}

export async function fetchPlatformBreakdown(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
  category: CategoryKey,
  platforms: string[] | null,
): Promise<PlatformCount[]> {
  const { data, error } = await supabase.rpc("platform_breakdown", {
    p_site_id: siteId,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
    p_category: categoryParam(category),
    p_platforms: platformsParam(platforms),
  });
  if (error) throw error;

  return (data as Array<Record<string, string | number>>).map((row) => ({
    platform: String(row.platform),
    count: Number(row.count),
  }));
}

function applyEventFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  siteId: string,
  window: DateWindow,
  category: CategoryKey,
  platforms: string[] | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let q = query
    .eq("site_id", siteId)
    .gte("occurred_at", window.from.toISOString())
    .lt("occurred_at", window.to.toISOString());
  const cat = categoryParam(category);
  if (cat) q = q.eq("bot_category", cat);
  const plats = platformsParam(platforms);
  if (plats) q = q.in("platform", plats);
  return q;
}

export async function fetchFeedEvents(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
  category: CategoryKey,
  platforms: string[] | null,
  limit = 100,
): Promise<FeedEventRow[]> {
  const base = supabase.from("crawler_events").select(FEED_COLUMNS);
  const { data, error } = await applyEventFilters(
    base,
    siteId,
    window,
    category,
    platforms,
  )
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as FeedEventRow[];
}

export async function fetchCsvRows(
  supabase: SupabaseClient,
  siteId: string,
  window: DateWindow,
  category: CategoryKey,
  platforms: string[] | null,
  cap = 10000,
): Promise<CrawlerEventRow[]> {
  const base = supabase
    .from("crawler_events")
    .select(
      "occurred_at, page_url, bot_name, platform, bot_category, status_code, source, user_agent",
    );
  const { data, error } = await applyEventFilters(
    base,
    siteId,
    window,
    category,
    platforms,
  )
    .order("occurred_at", { ascending: false })
    .limit(cap);
  if (error) throw error;
  return data as unknown as CrawlerEventRow[];
}
