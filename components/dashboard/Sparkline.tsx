"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export function Sparkline({
  values,
  color = "var(--primary)",
}: {
  values: number[];
  color?: string;
}) {
  const data = values.map((value, index) => ({ index, value }));

  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
