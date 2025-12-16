"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { getHistoricalData } from "@/services/deriv-api-service";

type ChartData = {
  date: string;
  price: number;
};

interface MarketChartProps {
  symbol: string;
}

export function MarketChart({ symbol }: MarketChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const historicalData = await getHistoricalData(symbol, "30 dias");
      setData(historicalData);
      setLoading(false);
    };

    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">Carregando dados do gráfico...</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(str: string) => {
                  const date = new Date(str + 'T00:00:00'); // Treat date as local
                  if (date.getDate() % 5 === 0) { // Show label every 5 days
                      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  }
                  return '';
              }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 5', 'dataMax + 5']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Preço"]}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
        </LineChart>
        </ResponsiveContainer>
    </div>
  );
}
