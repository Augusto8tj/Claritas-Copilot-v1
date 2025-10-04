import { MarketChart } from "@/components/trading/market-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TradingPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Trading
        </h1>
      </div>
      <p className="text-muted-foreground">
        Acompanhe o mercado e prepare-se para executar suas estratégias.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Acompanhamento de Ativo (PETR4)</CardTitle>
          <CardDescription>
            Visualização do desempenho do ativo em tempo real (simulado).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarketChart />
        </CardContent>
      </Card>
    </div>
  );
}
