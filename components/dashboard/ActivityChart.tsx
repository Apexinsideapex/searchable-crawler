"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RangeKey } from "@/lib/dashboard/filters";
import type { TimeseriesPoint } from "@/lib/dashboard/queries";

const CATEGORY_COLOR: Record<string, string> = {
  training: "var(--category-training)",
  indexing: "var(--category-indexing)",
  conversations: "var(--category-conversations)",
};

function formatBucket(iso: string, range: RangeKey): string {
  const date = new Date(iso);
  if (range === "24h") {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toChartRows(timeseries: TimeseriesPoint[], range: RangeKey) {
  const rows = new Map<string, { bucket_start: string; label: string } & Record<string, number | string>>();
  for (const point of timeseries) {
    const existing = rows.get(point.bucket_start) ?? {
      bucket_start: point.bucket_start,
      label: formatBucket(point.bucket_start, range),
      training: 0,
      indexing: 0,
      conversations: 0,
    };
    existing[point.category] = point.count;
    rows.set(point.bucket_start, existing);
  }
  return [...rows.values()].sort((a, b) => a.bucket_start.localeCompare(b.bucket_start));
}

export function ActivityChart({
  timeseries,
  range,
}: {
  timeseries: TimeseriesPoint[];
  range: RangeKey;
}) {
  const data = toChartRows(timeseries, range);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="training" stackId="a" fill={CATEGORY_COLOR.training} />
          <Bar dataKey="indexing" stackId="a" fill={CATEGORY_COLOR.indexing} />
          <Bar
            dataKey="conversations"
            stackId="a"
            fill={CATEGORY_COLOR.conversations}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
