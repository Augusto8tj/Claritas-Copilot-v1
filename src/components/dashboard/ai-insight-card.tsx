import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

async function getMockInsights() {
  // Simula uma pequena demora de rede sem chamar a API real
  await new Promise(resolve => setTimeout(resolve, 50));
  return [
      "Seu gasto com 'Compras' aumentou 15% este mês. Que tal revisar assinaturas não utilizadas?",
      "Você economizou R$250 em 'Alimentação' comparado ao mês passado. Ótimo trabalho!",
      "Considere aplicar R$500 do seu saldo atual na sua meta 'Viagem para o Japão' para acelerar o progresso."
    ];
}


export async function AIInsightCard() {
  const insights = await getMockInsights();

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
