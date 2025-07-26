import { getFinancialInsights } from "@/ai/flows/financial-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

export async function AIInsightCard() {
  // Mock data for demonstration purposes
  const mockFinancialData = JSON.stringify({
    renda: 5000,
    despesas: {
      moradia: 1500,
      transporte: 400,
      alimentacao: 600,
      servicos_publicos: 200,
      lazer: 800, // Gastos elevados com lazer
    },
    economias: 10000,
    investimentos: 25000,
    dividas: 5000,
  });
  const mockUserGoals = "Economizar para a entrada de uma casa, reduzir dívidas.";

  const { insights } = await getFinancialInsights({
    financialData: mockFinancialData,
    userGoals: mockUserGoals,
  });

  return (
    <Card className="col-span-4 bg-primary/5 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-primary font-headline">
          Insight do Copiloto de IA
        </CardTitle>
        <Lightbulb className="w-5 h-5 text-primary" />
      </CardHeader>
      <CardContent>
        {insights.length > 0 ? (
          <ul className="space-y-2 text-sm text-primary/80">
            {insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1.5">&#8226;</span>
                <span>{insight}</span>
                </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum novo insight no momento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
