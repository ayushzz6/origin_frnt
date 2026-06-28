'use client';

// Isolated so recharts (~80KB) is code-split out of the Dashboard's initial
// bundle and only fetched when the Time-Spent donut actually renders.
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface ActivityDonutDatum {
  name: string;
  value: number;
  color: string;
}

export default function ActivityDonut({
  data,
  formatValue,
}: {
  data: ActivityDonutDatum[];
  formatValue: (secs: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius="64%" outerRadius="100%" paddingAngle={3} dataKey="value" strokeWidth={0}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          formatter={(v) => [formatValue(Number(v)), '']}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
