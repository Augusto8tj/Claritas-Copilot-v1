// /src/features/financials/components/dashboard/monthly-balance.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getFinancialSummary } from "@/services/financial-data-service";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

function MonthlyBalanceSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                    <div className="flex justify-between">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


export function MonthlyBalance() {
  const { user } = useAuth();
  const [summary, setSummary] = React.useState<{ income: number; expenses: number; } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    };
    
    const fetchSummary = async () => {
        setLoading(true);
        try {
            const data = await getFinancialSummary(user.uid);
            setSummary(data);
        } catch(e) {
            console.error("Failed to fetch monthly balance:", e);
            setSummary({ income: 0, expenses: 0 }); // Fallback on error
        }
        setLoading(false);
    }
    fetchSummary();

  }, [user]);

  if (loading) {
    return <MonthlyBalanceSkeleton />;
  }
  
  if (!summary) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Balanço Mensal</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">Não foi possível carregar os dados.</p>
            </CardContent>
        </Card>
    )
  }

  const { income, expenses } = summary;
  const progress = income > 0 ? (expenses / income) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Balanço Mensal</CardTitle>
        <CardDescription>Sua receita vs. despesas este mês.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">Despesas</span>
            <span className="font-bold">
              R${expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Progress value={progress} />
          <div className="flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">Receita</span>
            <span className="font-bold text-green-600">
              R${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
