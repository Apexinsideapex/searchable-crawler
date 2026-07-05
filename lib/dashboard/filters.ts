export type RangeKey = "24h" | "7d" | "30d";
export type CategoryKey = "all" | "training" | "indexing" | "conversations";

export interface DashboardFilters {
  range: RangeKey;
  category: CategoryKey;
  platforms: string[] | null;
}

export interface DateWindow {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: "1 hour" | "1 day";
}

const RANGE_MS: Record<RangeKey, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const RANGE_BUCKET: Record<RangeKey, DateWindow["bucket"]> = {
  "24h": "1 hour",
  "7d": "1 day",
  "30d": "1 day",
};

const RANGE_KEYS: RangeKey[] = ["24h", "7d", "30d"];
const CATEGORY_KEYS: CategoryKey[] = [
  "all",
  "training",
  "indexing",
  "conversations",
];

export function resolveDateWindow(
  range: RangeKey,
  now: Date = new Date(),
): DateWindow {
  const lengthMs = RANGE_MS[range];
  const to = now;
  const from = new Date(to.getTime() - lengthMs);
  const prevTo = from;
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from, to, prevFrom, prevTo, bucket: RANGE_BUCKET[range] };
}

export function computeDelta(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function isRangeKey(value: string): value is RangeKey {
  return (RANGE_KEYS as string[]).includes(value);
}

function isCategoryKey(value: string): value is CategoryKey {
  return (CATEGORY_KEYS as string[]).includes(value);
}

export function parseFilters(
  searchParams: URLSearchParams,
): DashboardFilters {
  const rangeParam = searchParams.get("range");
  const categoryParam = searchParams.get("category");
  const platformsParam = searchParams.get("platforms");

  const range = rangeParam && isRangeKey(rangeParam) ? rangeParam : "7d";
  const category =
    categoryParam && isCategoryKey(categoryParam) ? categoryParam : "all";
  const platforms = platformsParam
    ? platformsParam
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : null;

  return { range, category, platforms: platforms && platforms.length > 0 ? platforms : null };
}

export function serializeFilters(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("range", filters.range);
  params.set("category", filters.category);
  if (filters.platforms && filters.platforms.length > 0) {
    params.set("platforms", filters.platforms.join(","));
  }
  return params;
}
