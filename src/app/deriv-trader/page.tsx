

'use client';

import React, { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";
import { Button } from "@/components/ui/button";
import { Trash2, Bot, Users, NotepadText } from "lucide-react";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationsLog } from "@/components/trading/operations-log";
import { AIAnalysisInterface } from "@/components/trading/ai-analysis-interface";
import { riseFallSchema, type RiseFallFormValues } from "@/components/trading/deriv-trader-interface.types";
import { AutoTraderInterface } from "@/components/trading/auto-trader-interface";
import { AutoTraderCouncilInterface } from "@/components/trading/auto-trader-council-interface";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTradeAnalysis } from "@/hooks/use-trade-analysis";
import { useAutopilot } from "@/hooks/use-autopilot";
import { useRobotCouncil } from "@/hooks/use-robot-council";
import { SystemStatusSummary } from "@/components/trading/system-status-summary";
import { ManualCouncilInterface } from "@/components/trading/manual-council-interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AITradeSuggestion } from "@/components/trading/ai-trade-suggestion";


/**
 * This core component is now separate to ensure that all hooks using
 * `useFormContext` are called within the <FormProvider> of the parent page.
 */
function DerivTraderCore({ activeSymbol, setActiveSymbol, indicators }: { activeSymbol: string | null, setActiveSymbol: (symbol: string | null) => void, indicators: any }) {
  const { 
    operationsLog,
    chartData,
    isChartLoading,
    chartError,
    chartType,
    setChartType,
    timePeriod,
    setTimePeriod,
  } = useDerivApi();
  
  // Initialize hooks that depend on the active symbol and other API data
  const robotCouncil = useRobotCouncil(activeSymbol);
  const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog, robotCouncil.incrementGeminiRequestCount);
  const autopilot = useAutopilot(activeSymbol, robotCouncil.incrementGeminiRequestCount);
  
  // Note: The `indicators` state is now managed inside useRobotCouncil.
  // We can extract it if other components need it, or pass the whole council object.

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
                <CardTitle className="font-headline text-lg">
                    Gráfico ({activeSymbol})
                </CardTitle>
                <CardDescription className="text-xs">
                    Desempenho em tempo real do ativo.
                </CardDescription>
            </div>
        </CardHeader>
        <CardContent>
            <MarketChart 
                activeSymbol={activeSymbol || ''}
                chartData={chartData}
                isChartLoading={isChartLoading}
                chartError={chartError}
                chartType={chartType}
                setChartType={setChartType}
                timePeriod={timePeriod}
                setTimePeriod={setTimePeriod}
                operations={operationsLog}
                // Pass indicators from the council hook if needed by the chart
                indicators={indicators}
            />
        </CardContent>
      </Card>
      
       {/* Layout para telas maiores */}
       <div className="hidden lg:grid lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DerivTraderInterface symbol={activeSymbol || ""} />
                    <div className="space-y-6">
                        <AITradeSuggestion symbol={activeSymbol || ''} incrementRequestCount={robotCouncil.incrementGeminiRequestCount} />
                        <AIAnalysisInterface analyzeSessionPerformance={tradeAnalysis.analyzeSessionPerformance} />
                        <OperationsLog operations={operationsLog} />
                    </div>
                </div>
            </div>
             <div className="space-y-6">
                <AutoTraderCouncilInterface {...robotCouncil} />
                <AutoTraderInterface {...autopilot} />
            </div>
       </div>

       {/* Layout com Abas para telas pequenas */}
       <div className="lg:hidden mt-6">
           <Tabs defaultValue="trade">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="trade">Negociar</TabsTrigger>
                    <TabsTrigger value="autopilot"><Bot className="w-4 h-4 mr-1"/> Pilotos IA</TabsTrigger>
                    <TabsTrigger value="log"><NotepadText className="w-4 h-4 mr-1"/>Registos</TabsTrigger>
                </TabsList>

                <TabsContent value="trade" className="mt-4 space-y-6">
                    <DerivTraderInterface symbol={activeSymbol || ""} />
                    <AITradeSuggestion symbol={activeSymbol || ''} incrementRequestCount={robotCouncil.incrementGeminiRequestCount} />
                </TabsContent>

                <TabsContent value="autopilot" className="mt-4 space-y-6">
                    <AutoTraderCouncilInterface {...robotCouncil} />
                    <AutoTraderInterface {...autopilot} />
                </TabsContent>

                 <TabsContent value="log" className="mt-4 space-y-6">
                    <OperationsLog operations={operationsLog} />
                    <AIAnalysisInterface analyzeSessionPerformance={tradeAnalysis.analyzeSessionPerformance} />
                </TabsContent>
           </Tabs>
       </div>

       {/* Manual Council Prompt Interface */}
      {robotCouncil.manualPromptBatches.length > 0 && (
        <div className="mt-6">
            <ManualCouncilInterface
                batches={robotCouncil.manualPromptBatches}
                onProcessResponse={robotCouncil.processManualCouncilResponse}
            />
        </div>
      )}
    </>
  );
}


export default function DerivTraderPage() {
  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: 5,
      duration_unit: "t",
      allowEquals: false,
    },
  });

  // All API state is now managed by the single useDerivApi hook
  const { 
    accountType, 
    setAccountType, 
    accountBalance, 
    clearActiveContracts, 
    operationsLog,
    isConnecting,
    isAssetsLoading,
    assetGroups,
    activeSymbol,
    setActiveSymbol,
  } = useDerivApi();

   // The indicators state now lives here as the source of truth
  const { indicators } = useRobotCouncil(activeSymbol);
  
  // Ensure the hook's active symbol is updated when the local state changes
  const handleAssetChange = (asset: string) => {
    setActiveSymbol(asset);
  };

  return (
    <FormProvider {...form}>
      <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
              <h1 className="text-3xl font-bold tracking-tight font-headline shrink-0">
                Deriv Trader
              </h1>
              <AssetSelector 
                selectedAsset={activeSymbol || ""} 
                onAssetChange={handleAssetChange} 
                assetGroups={assetGroups}
                isAssetsLoading={isAssetsLoading}
              />
          </div>
          <div className="flex items-center justify-end gap-4">
              <ToggleGroup type="single" value={accountType} onValueChange={(value: any) => value && setAccountType(value)} defaultValue="demo" aria-label="Tipo de Conta">
                  <ToggleGroupItem value="demo" aria-label="Usar conta demo">Demo</ToggleGroupItem>
                  <ToggleGroupItem value="real" aria-label="Usar conta real">Real</ToggleGroupItem>
              </ToggleGroup>
              <div className="text-right h-6 w-40">
                  {accountBalance.loading || isConnecting ? (
                      <Skeleton className="h-5 w-full" />
                  ) : accountBalance.balance !== null ? (
                      <p className="text-sm font-medium text-muted-foreground truncate">
                          Saldo: <span className="font-bold text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: accountBalance.currency || 'USD' }).format(accountBalance.balance)}</span>
                      </p>
                  ) : null}
              </div>
              {operationsLog.length > 0 && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={clearActiveContracts}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Limpar negociações</span>
                </Button>
              )}
          </div>
        </div>

        <SystemStatusSummary />

        <DerivTraderCore activeSymbol={activeSymbol} setActiveSymbol={setActiveSymbol} indicators={indicators} />
      </div>
    </FormProvider>
  );
}
