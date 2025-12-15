import { MarketChart } from "@/components/trading/market-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TraderPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Deriv Trader
        </h1>
      </div>
      <p className="text-muted-foreground">
        Nossa plataforma integrada para negociação de opções e multiplicadores.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
        <div>
            <Card>
                 <CardHeader>
                    <CardTitle className="font-headline">Painel de Negociação</CardTitle>
                    <CardDescription>
                        Configure e execute suas ordens aqui.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">Em breve: seletores de ativo, tipo de opção, valor e botões de compra/venda.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
