
"use client";

import { useState } from "react";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";

export default function DerivTraderPage() {
  const [selectedAsset, setSelectedAsset] = useState("1HZ100V");

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
            Deriv Trader
            </h1>
            <AssetSelector 
            selectedAsset={selectedAsset} 
            onAssetChange={setSelectedAsset} 
            />
        </div>
      </div>
      <p className="text-muted-foreground">
        Nossa plataforma integrada para negociação de Opções e Multiplicadores.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <div className="lg:col-span-5">
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">
                Acompanhamento de Ativo ({selectedAsset})
                </CardTitle>
                <CardDescription>
                Visualização do desempenho do ativo em tempo real (simulado).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <MarketChart symbol={selectedAsset} />
            </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <DerivTraderInterface symbol={selectedAsset} />
        </div>
      </div>
    </div>
  );
}
