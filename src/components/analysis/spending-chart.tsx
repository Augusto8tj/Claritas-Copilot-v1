"use client";

import * as React from "react";
import { Label, Pie, PieChart, Cell } from "recharts";

import {
  CardContent,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
  { category: "Food & Dining", amount: 850, fill: "var(--color-food)" },
  { category: "Shopping", amount: 1200, fill: "var(--color-shopping)" },
  { category: "Housing", amount: 1800, fill: "var(--color-housing)" },
  { category: "Transport", amount: 450, fill: "var(--color-transport)" },
  { category: "Entertainment", amount: 600, fill: "var(--color-entertainment)" },
  { category: "Other", amount: 300, fill: "var(--color-other)" },
];

const chartConfig = {
  amount: {
    label: "Amount",
  },
  food: {
    label: "Food & Dining",
    color: "hsl(var(--chart-1))",
  },
  shopping: {
    label: "Shopping",
    color: "hsl(var(--chart-2))",
  },
  housing: {
    label: "Housing",
    color: "hsl(var(--chart-3))",
  },
  transport: {
    label: "Transport",
    color: "hsl(var(--chart-4))",
  },
  entertainment: {
    label: "Entertainment",
    color: "hsl(var(--chart-5))",
  },
  other: {
    label: "Other",
    color: "hsl(var(--muted))",
  },
};

export function SpendingChart() {
  const totalAmount = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.amount, 0);
  }, []);

  return (
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-[300px]"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={chartData}
            dataKey="amount"
            nameKey="category"
            innerRadius={80}
            strokeWidth={5}
          >
            {chartData.map((entry) => (
                <Cell key={`cell-${entry.category}`} fill={entry.fill} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy - 12}
                        className="fill-muted-foreground text-sm"
                      >
                        Total Spent
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy + 12}
                        className="fill-foreground text-2xl font-bold"
                      >
                        ${totalAmount.toLocaleString()}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
  );
}
