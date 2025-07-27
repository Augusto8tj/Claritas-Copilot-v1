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
import { getBudgetData } from "@/services/financial-data-service";
import type { BudgetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Home,
  Utensils,
  Car,
  Ticket,
  ShoppingCart,
  MoreHorizontal,
  LucideIcon,
  Loader2,
} from "lucide-react";

const categoryIcons: { [key: string]: LucideIcon } = {
  Moradia: Home,
  Alimentação: Utensils,
  Transporte: Car,
  Lazer: Ticket,
  Compras: ShoppingCart,
  Outros: MoreHorizontal,
};

export function BudgetOverview() {
  const [budgetData, setBudgetData] = React.useState<BudgetCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      const data = await getBudgetData();
      setBudgetData(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const getProgressColor = (progress: number) => {
    if (progress > 90) return "bg-destructive";
    if (progress > 75) return "bg-accent";
    return "bg-primary";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Acompanhamento do Orçamento</CardTitle>
          <CardDescription>
            Veja como seus gastos se comparam aos seus limites.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Acompanhamento do Orçamento</CardTitle>
        <CardDescription>
          Veja como seus gastos se comparam aos seus limites.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {budgetData.map((category) => {
            const progress = (category.spent / category.budgeted) * 100;
            const Icon = categoryIcons[category.name] || MoreHorizontal;
            return (
              <div key={category.name}>
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium flex-1">{category.name}</h3>
                  <div className="text-sm text-muted-foreground text-right">
                    <span className="font-semibold text-foreground">
                      R${category.spent.toLocaleString("pt-BR")}
                    </span>{" "}
                    / R${category.budgeted.toLocaleString("pt-BR")}
                  </div>
                </div>
                <Progress value={progress} className="h-2" indicatorClassName={getProgressColor(progress)} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
