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
        <CardTitle className="font-headline">Monthly Balance</CardTitle>
        <CardDescription>Your income vs. expenses this month.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">Expenses</span>
            <span className="font-bold">
              ${expenses.toLocaleString()}
            </span>
          </div>
          <Progress value={progress} />
          <div className="flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">Income</span>
            <span className="font-bold text-green-600">
              ${income.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
