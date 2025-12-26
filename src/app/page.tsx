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
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const revalidate = 0; // Force dynamic rendering

function MainGoalSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="flex items-center justify-center p-6">
        <Skeleton className="h-36 w-36 rounded-full" />
      </CardContent>
    </Card>
  )
}


export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Painel
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<Skeleton className="h-36 w-full" />}>
           <AIInsightCard />
        </Suspense>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Patrimônio Líquido</CardTitle>
            <CardDescription>Sua jornada financeira no último ano.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <NetWorthChart />
          </CardContent>
        </Card>
        <div className="col-span-4 lg:col-span-3 space-y-4">
          <MonthlyBalance />
          <Suspense fallback={<MainGoalSkeleton />}>
            <MainGoal />
          </Suspense>
        </div>
      </div>
      <UpcomingBills />
    </div>
  );
}
