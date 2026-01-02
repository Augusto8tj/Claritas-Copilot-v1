// src/features/financials/components/dashboard/net-worth-chart.tsx
'use client';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getTransactions } from "@/services/financial-data-service";
import type { Transaction } from "@/lib/types";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartDataPoint {
  name: string;
  netWorth: number;
}

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function processData(transactions: Transaction[]): ChartDataPoint[] {
  const monthlyData: { [key: string]: { income: number, expenses: number } } = {};

  // Inicializa todos os meses do ano para garantir que o gráfico tenha sempre 12 pontos
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 12; i++) {
    const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = { income: 0, expenses: 0 };
  }
  
  transactions.forEach(t => {
    try {
      const transactionDate = new Date(t.date);
      // Ignora transações de anos diferentes para manter a consistência
      if (transactionDate.getFullYear() !== currentYear) return;
      
      const monthKey = `${currentYear}-${String(transactionDate.getUTCMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[monthKey]) {
        if (t.type === 'income') {
          monthlyData[monthKey].income += t.amount;
        } else {
          monthlyData[monthKey].expenses += t.amount;
        }
      }
    } catch(e) {
      console.error("Invalid date format for transaction:", t);
    }
  });

  let cumulativeNetWorth = 0;
  return months.map((monthName, index) => {
    const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
    const monthBalance = (monthlyData[monthKey]?.income || 0) - (monthlyData[monthKey]?.expenses || 0);
    cumulativeNetWorth += monthBalance;
    return {
      name: monthName,
      netWorth: cumulativeNetWorth,
    };
  });
}

export function NetWorthChart() {
    const { user } = useAuth();
    const [data, setData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const transactions = await getTransactions(user.uid);
                const processed = processData(transactions);
                setData(processed);
            } catch (error) {
                console.error("Failed to fetch or process transactions for chart:", error);
                // Em caso de erro, preenchemos com dados zerados para não quebrar a UI
                setData(months.map(m => ({ name: m, netWorth: 0 })));
            }
            setLoading(false);
        };
        fetchData();
    }, [user]);

    const chartData = useMemo(() => data, [data]);

    if (loading) {
       return (
         <Card className="col-span-4">
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="pl-2">
                <Skeleton className="h-[350px] w-full" />
            </CardContent>
        </Card>
       )
    }
    
  return (
    <Card className="col-span-4">
        <CardHeader>
            <CardTitle className="font-headline">Patrimônio Líquido</CardTitle>
            <CardDescription>Sua jornada financeira no último ano.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
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
         </CardContent>
    </Card>
  );
}
