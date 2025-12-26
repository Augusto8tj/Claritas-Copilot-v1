

'use client';

import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationsLog } from "@/components/trading/operations-log";
import { AIAnalysisInterface } from "@/components/trading/ai-analysis-interface";
import { riseFallSchema, type RiseFallFormValues } from "@/components/trading/deriv-trader-interface.types";
import { AutoTraderInterface } from "@/components/trading/auto-trader-interface";
import { AutoTraderCouncilInterface } from "@/components/trading/auto-trader-council-interface";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMarketData } from "@/hooks/use-market-data";
import { useTradeAnalysis } from "@/hooks/use-trade-analysis";
import { useAutopilot } from "@/hooks/use-autopilot";
import { useRobotCouncil } from "@/hooks/use-robot-council";
import { calculateAllIndicators } from "@/services/indicator-service";
import { SystemStatusSummary } from "@/components/trading/system-status-summary";
import { ManualCouncilInterface } from "@/components/trading/manual-council-interface";


/**
 * This core component is now separate to ensure that all hooks using
 * `useFormContext` are called within the <FormProvider> of the parent page.
 */
function DerivTraderCore({ activeSymbol }: { activeSymbol: string | null }) {
  const { 
    operationsLog,
    addActiveContract,
    executeTrade,
  } = useDerivApi();
  
  const { chartData, isChartLoading, chartError, chartType, setChartType, timePeriod, setTimePeriod } = useMarketData(activeSymbol);
  
  const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog);
  
  const [indicators, setIndicators] = useState({
      rsi: null as number | null,
      stoch: null as number | null,
      ma: { short: null as number | null, long: null as number | null },
      bollingerBands: [] as ({ upper: number; middle: number; lower: number } | null)[],
      macd: null as { macd: number | null, signal: number | null } | null,
      priceAction: null as string | null,
      adx: null as number | null,
      atr: null as number | null,
      ichimoku: null as { inCloud: boolean, trend: 'bullish' | 'bearish' | 'neutral' } | null,
      awesomeOscillator: null as number | null,
      volumePoc: null as number | null,
      sma: [] as (number | null)[],
      ema: [] as (number | null)[],
      vwap: [] as (number | null)[],
  });

  const robotCouncil = useRobotCouncil(activeSymbol, operationsLog, addActiveContract, executeTrade, indicators);
  const autopilot = useAutopilot(indicators);

  React.useEffect(() => {
      if (chartData.length > 0 && robotCouncil.strategyCouncil.length > 0) {
          const calculatedIndicators = calculateAllIndicators(chartData, robotCouncil.strategyCouncil);
          setIndicators(calculatedIndicators);
      }
  }, [chartData, robotCouncil.strategyCouncil]);

  return (
    <>
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Center Column: Trading Terminal & Chart */}
        <div className="lg:col-span-2 space-y-6">
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
                      indicators={indicators}
                  />
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DerivTraderInterface 
                  symbol={activeSymbol || ""}
              />
              <div className="space-y-6">
                  <AIAnalysisInterface analyzeSessionPerformance={tradeAnalysis.analyzeSessionPerformance} />
                  <OperationsLog operations={operationsLog} />
              </div>
            </div>
        </div>

        {/* Right Column: AI Copilots */}
        <div className="space-y-6">
            <AutoTraderCouncilInterface {...robotCouncil} />
            <AutoTraderInterface {...autopilot} />
        </div>
      </div>

       {/* Manual Council Prompt Interface */}
      {robotCouncil.manualPrompt && (
        <div className="mt-6">
            <ManualCouncilInterface
                prompt={robotCouncil.manualPrompt}
                onProcessResponse={robotCouncil.processManualCouncilResponse}
            />
        </div>
      )}
    </>
  );
}


export default function DerivTraderPage() {
  const [activeSymbol, setActiveSymbol] = useState<string | null>('1HZ10V');

  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: 5,
      duration_unit: "t",
      allowEquals: false,
    },
  });

  const { 
    accountType, 
    setAccountType, 
    accountBalance, 
    clearActiveContracts, 
    operationsLog,
    isConnecting,
    isAssetsLoading,
    assetGroups,
  } = useDerivApi();

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
                onAssetChange={(asset) => setActiveSymbol(asset)} 
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

        <DerivTraderCore activeSymbol={activeSymbol} />
      </div>
    </FormProvider>
  );
}
