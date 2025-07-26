import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { MonthlyBalance } from "@/components/dashboard/monthly-balance";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { MainGoal } from "@/components/dashboard/main-goal";

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Dashboard
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AIInsightCard />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Net Worth</CardTitle>
            <CardDescription>Your financial journey over the last year.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <NetWorthChart />
          </CardContent>
        </Card>
        <div className="col-span-4 lg:col-span-3 space-y-4">
          <MonthlyBalance />
          <MainGoal />
        </div>
      </div>
      <UpcomingBills />
    </div>
  );
}
