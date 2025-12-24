

'use client';

import { useState, useCallback } from "react";
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
import { AutoTraderCouncilInterface } from "@/components/trading/auto-trader-council-interface";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMarketData } from "@/hooks/use-market-data";
import { useRobotCouncil } from "@/hooks/use-robot-council";
import { useTradeAnalysis } from "@/hooks/use-trade-analysis";


export default function DerivTraderPage() {
  const [activeSymbol, setActiveSymbol] = useState<string | null>('1HZ75V');
  const [zoomLevel, setZoomLevel] = useState(100);

  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: 28,
      duration_unit: "s",
      allowEquals: false,
    },
  });

  const { 
    accountType, 
    setAccountType, 
    accountBalance, 
    activeContracts, 
    clearActiveContracts, 
    operationsLog,
    isConnected,
    isConnecting,
    isAssetsLoading,
    assetGroups,
    executeTrade,
    addActiveContract,
  } = useDerivApi();
  
  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prevZoom => {
        const change = 20;
        let newZoom;
        if (direction === 'in') {
            newZoom = Math.max(50, prevZoom - change);
        } else {
            newZoom = Math.min(500, prevZoom + change);
        }
        return newZoom;
    });
  };
  
  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey) {
          e.preventDefault();
          const direction = e.deltaY > 0 ? 'out' : 'in';
          handleZoom(direction);
      }
  };
  
  const { chartData, isChartLoading, chartError, chartType, setChartType, timePeriod, setTimePeriod } = useMarketData(activeSymbol);
  const [showBollingerBands, setShowBollingerBands] = useState(false);
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);

  const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog);
  const { indicators, ...robotCouncil } = useRobotCouncil(activeSymbol, chartData, operationsLog, addActiveContract, executeTrade);
  
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
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Trading Terminal */}
          <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="font-headline text-lg">
                            Gráfico ({activeSymbol})
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Desempenho em tempo real do ativo. Ctrl + Scroll para zoom.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeContracts.length > 0 && (
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={clearActiveContracts}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Limpar negociações</span>
                        </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent onWheel={handleWheelZoom}>
                    <MarketChart 
                        activeSymbol={activeSymbol || ''}
                        activeContracts={activeContracts}
                        chartData={chartData}
                        isChartLoading={isChartLoading}
                        chartError={chartError}
                        chartType={chartType}
                        setChartType={setChartType}
                        timePeriod={timePeriod}
                        setTimePeriod={setTimePeriod}
                        showBollingerBands={showBollingerBands}
                        setShowBollingerBands={setShowBollingerBands}
                        showSMA={showSMA}
                        setShowSMA={setShowSMA}
                        showEMA={showEMA}
                        setShowEMA={setShowEMA}
                        showVWAP={showVWAP}
                        setShowVWAP={setShowVWAP}
                        handleZoom={handleZoom}
                        zoomLevel={zoomLevel}
                        indicators={indicators}
                    />
                </CardContent>
              </Card>
              <DerivTraderInterface 
                  symbol={activeSymbol || ""}
                  isConnected={isConnected}
                  executeTrade={executeTrade}
              />
          </div>

          {/* Right Column: AI Copilot */}
          <div className="space-y-6">
              <AutoTraderCouncilInterface />
              <AIAnalysisInterface analyzeSessionPerformance={tradeAnalysis.analyzeSessionPerformance} />
              <OperationsLog operations={operationsLog} />
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
