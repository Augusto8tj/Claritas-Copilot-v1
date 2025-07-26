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
  { name: "Fev", netWorth: 46500 },
  { name: "Mar", netWorth: 48000 },
  { name: "Abr", netWorth: 52000 },
  { name: "Mai", netWorth: 51500 },
  { name: "Jun", netWorth: 53000 },
  { name: "Jul", netWorth: 55500 },
  { name: "Ago", netWorth: 57000 },
  { name: "Set", netWorth: 58000 },
  { name: "Out", netWorth: 59000 },
  { name: "Nov", netWorth: 61000 },
  { name: "Dez", netWorth: 63500 },
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
          tickFormatter={(value) => `R$${value / 1000}k`}
        />
        <Tooltip
            formatter={(value: number) => `R$${value.toLocaleString('pt-BR')}`}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)'
            }}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="Patrimônio Líquido"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--primary))" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
