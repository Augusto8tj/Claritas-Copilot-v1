// /src/features/financials/components/dashboard/monthly-balance.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// This component is now a "dumb" component that just receives data.
interface MonthlyBalanceProps {
  income: number;
  expenses: number;
}

export function MonthlyBalance({ income, expenses }: MonthlyBalanceProps) {
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
