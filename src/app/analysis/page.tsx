import { SpendingChart } from "@/components/analysis/spending-chart";
import { TransactionsTable } from "@/components/analysis/transactions-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AnalysisPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Spending Analysis
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Expense Breakdown</CardTitle>
          <CardDescription>
            Your spending by category for the current month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingChart />
        </CardContent>
      </Card>
      <TransactionsTable />
    </div>
  );
}
