import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CandlestickChart } from "lucide-react";

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
      <Alert className="bg-primary/5 border-primary/20">
        <CandlestickChart className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-headline">Em Desenvolvimento</AlertTitle>
        <AlertDescription className="text-primary/90">
          Esta seção está sendo preparada para se conectar à API da sua corretora. Em breve, você poderá visualizar dados de mercado em tempo real e executar ordens com a ajuda da Claritas IA.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Dados de Mercado</CardTitle>
          <CardDescription>
            Visualização dos ativos (Em breve).
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">O gráfico de mercado aparecerá aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
}
