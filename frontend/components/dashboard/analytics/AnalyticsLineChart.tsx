"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsTimelinePoint } from "@/lib/api";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function AnalyticsLineChart({
  data,
}: {
  data: AnalyticsTimelinePoint[];
}) {
  const hasData = data.some(
    (point) => point.visitors || point.starts || point.completions,
  );
  const chartData = data.map((point) => ({
    ...point,
    day: formatShortDate(point.date),
  }));

  if (!hasData) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-navy/10 bg-white text-sm font-semibold text-navy/45">
        Sem dados ainda
      </div>
    );
  }

  return (
    <div className="h-[320px] rounded-2xl border border-navy/5 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ left: -18, right: 8, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,31,61,0.08)" />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(15,31,61,0.5)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(15,31,61,0.5)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => numberFormatter.format(Number(value))}
          />
          <Tooltip
            formatter={(value, name) => [
              numberFormatter.format(Number(value)),
              labels[String(name)] ?? name,
            ]}
            labelFormatter={(label) => `Dia ${label}`}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid rgba(15,31,61,0.08)",
              boxShadow: "0 18px 45px rgba(15,31,61,0.12)",
            }}
          />
          <Legend formatter={(value) => labels[String(value)] ?? value} />
          <Line
            type="monotone"
            dataKey="visitors"
            stroke="#0F1F3D"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="starts"
            stroke="#00C48C"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="completions"
            stroke="#6D5DFB"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const labels: Record<string, string> = {
  visitors: "Visitantes",
  starts: "Inícios",
  completions: "Conclusões",
};

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
