import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function MonthlyBalance() {
  const income = 7250;
  const expenses = 4830;
  const progress = (expenses / income) * 100;

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
