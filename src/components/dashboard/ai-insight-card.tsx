import { getFinancialInsights } from "@/ai/flows/financial-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

export async function AIInsightCard() {
  // Mock data for demonstration purposes
  const mockFinancialData = JSON.stringify({
    renda: 7250,
    despesas: {
      moradia: 1800,
      transporte: 450,
      alimentacao: 850,
      compras: 780,
      lazer: 600,
      outros: 350
    },
    economias: 18500,
    investimentos: 45000,
    dividas: 5000,
  });
  const mockUserGoals = "Economizar para a entrada de uma casa, fazer uma viagem internacional.";

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
