import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";

export default function DerivTraderPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Deriv Trader
        </h1>
      </div>
      <p className="text-muted-foreground">
        Nossa plataforma integrada para negociação de Opções e Multiplicadores.
      </p>
      <DerivTraderInterface />
    </div>
  );
}
