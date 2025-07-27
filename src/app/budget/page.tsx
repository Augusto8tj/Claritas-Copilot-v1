import { BudgetOverview } from "@/components/budget/budget-overview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PiggyBank } from "lucide-react";

export default function BudgetPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Orçamento Mensal
        </h1>
      </div>
      <p className="text-muted-foreground">
        Acompanhe seus gastos em relação às metas de orçamento mensais.
      </p>
      <Alert className="bg-primary/5 border-primary/20">
        <PiggyBank className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-headline">Dica de Orçamento</AlertTitle>
        <AlertDescription className="text-primary/90">
            Em uma versão futura, você poderá definir e editar seus próprios limites de orçamento para cada categoria diretamente nesta página.
        </AlertDescription>
      </Alert>
      <BudgetOverview />
    </div>
  );
}
