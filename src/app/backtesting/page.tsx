import { BacktestingInterface } from "@/components/backtesting/backtesting-interface";

export default function BacktestingPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Teste de Estratégias (Backtesting)
        </h1>
      </div>
      <p className="text-muted-foreground">
        Use a IA para simular estratégias de investimento com dados históricos.
      </p>
      <div className="h-[calc(100vh-14rem)]">
        <BacktestingInterface />
      </div>
    </div>
  );
}
