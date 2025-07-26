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
  { category: "Alimentação", amount: 850, fill: "var(--color-food)" },
  { category: "Compras", amount: 1200, fill: "var(--color-shopping)" },
  { category: "Moradia", amount: 1800, fill: "var(--color-housing)" },
  { category: "Transporte", amount: 450, fill: "var(--color-transport)" },
  { category: "Lazer", amount: 600, fill: "var(--color-entertainment)" },
  { category: "Outros", amount: 300, fill: "var(--color-other)" },
];

const chartConfig = {
  amount: {
    label: "Valor",
  },
  food: {
    label: "Alimentação",
    color: "hsl(var(--chart-1))",
  },
  shopping: {
    label: "Compras",
    color: "hsl(var(--chart-2))",
  },
  housing: {
    label: "Moradia",
    color: "hsl(var(--chart-3))",
  },
  transport: {
    label: "Transporte",
    color: "hsl(var(--chart-4))",
  },
  entertainment: {
    label: "Lazer",
    color: "hsl(var(--chart-5))",
  },
  other: {
    label: "Outros",
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
                        Gasto Total
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy + 12}
                        className="fill-foreground text-2xl font-bold"
                      >
                        R${totalAmount.toLocaleString('pt-BR')}
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
