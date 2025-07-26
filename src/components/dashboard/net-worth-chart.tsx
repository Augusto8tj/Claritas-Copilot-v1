"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

const data = [
  { name: "Jan", netWorth: 45000 },
  { name: "Feb", netWorth: 46500 },
  { name: "Mar", netWorth: 48000 },
  { name: "Apr", netWorth: 52000 },
  { name: "May", netWorth: 51500 },
  { name: "Jun", netWorth: 53000 },
  { name: "Jul", netWorth: 55500 },
  { name: "Aug", netWorth: 57000 },
  { name: "Sep", netWorth: 56000 },
  { name: "Oct", netWorth: 59000 },
  { name: "Nov", netWorth: 61000 },
  { name: "Dec", netWorth: 63500 },
];

export function NetWorthChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value / 1000}k`}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)'
            }}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--primary))" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
