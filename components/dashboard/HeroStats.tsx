import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { computeDelta, serializeFilters } from "@/lib/dashboard/filters";
import type { CategoryKey, DashboardFilters } from "@/lib/dashboard/filters";
import type { StatsSummary, TimeseriesPoint } from "@/lib/dashboard/queries";

const CARDS: Array<{
  label: string;
  category: CategoryKey;
  key: keyof StatsSummary;
  prevKey: keyof StatsSummary;
  color: string;
}> = [
  { label: "Total Visits", category: "all", key: "total", prevKey: "prev_total", color: "var(--primary)" },
  {
    label: "Conversations",
    category: "conversations",
    key: "conversations",
    prevKey: "prev_conversations",
    color: "var(--category-conversations)",
  },
  {
    label: "Indexing",
    category: "indexing",
    key: "indexing",
    prevKey: "prev_indexing",
    color: "var(--category-indexing)",
  },
  {
    label: "Training",
    category: "training",
    key: "training",
    prevKey: "prev_training",
    color: "var(--category-training)",
  },
];

function sparklineValues(timeseries: TimeseriesPoint[], category: CategoryKey): number[] {
  const buckets = new Map<string, number>();
  for (const point of timeseries) {
    if (category !== "all" && point.category !== category) continue;
    buckets.set(point.bucket_start, (buckets.get(point.bucket_start) ?? 0) + point.count);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, count]) => count);
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs font-medium text-muted-foreground">New</span>;
  }
  if (delta === 0) {
    return <span className="text-xs font-medium text-muted-foreground">No change</span>;
  }
  const isUp = delta > 0;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 text-xs font-medium " +
        (isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")
      }
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

export function HeroStats({
  siteId,
  filters,
  stats,
  timeseries,
}: {
  siteId: string;
  filters: DashboardFilters;
  stats: StatsSummary;
  timeseries: TimeseriesPoint[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const current = Number(stats[card.key]);
        const previous = Number(stats[card.prevKey]);
        const delta = computeDelta(current, previous);
        const href = `/dashboard/${siteId}?${serializeFilters({
          ...filters,
          category: card.category,
        }).toString()}`;

        return (
          <Link key={card.label} href={href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-semibold tabular-nums">
                    {current.toLocaleString()}
                  </span>
                  <DeltaBadge delta={delta} />
                </div>
                <Sparkline
                  values={sparklineValues(timeseries, card.category)}
                  color={card.color}
                />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
