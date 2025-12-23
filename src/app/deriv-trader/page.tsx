
'use client';

import { useEffect, useState, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";
import { Button } from "@/components/ui/button";
import { AreaChart, Trash2, Plus, Minus, CandlestickChart, Waves, Clock } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationsLog } from "@/components/trading/operations-log";
import { AIAnalysisInterface } from "@/components/trading/ai-analysis-interface";
import { riseFallSchema, type RiseFallFormValues } from "@/components/trading/deriv-trader-interface.types";
import { AutoTraderInterface } from "@/components/trading/auto-trader-interface";
import { AutoTraderCouncilInterface } from "@/components/trading/auto-trader-council-interface";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMarketData, type TimePeriod, type ChartType } from "@/hooks/use-market-data";
import { useAutopilot } from "@/hooks/use-autopilot";
import { useRobotCouncil } from "@/hooks/use-robot-council";
import { useTradeAnalysis } from "@/hooks/use-trade-analysis";


const timePeriods: TimePeriod[] = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '8h', '1d'];

export default function DerivTraderPage() {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: 25,
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
    addActiveContract,
    executeTrade,
  } = useDerivApi();

  const {
    chartData,
    isChartLoading,
    chartError,
    chartType,
    setChartType,
    timePeriod,
    setTimePeriod,
    showBollingerBands,
    setShowBollingerBands,
    subscribeToSymbol,
  } = useMarketData();
  
  const { analyzeSessionPerformance } = useTradeAnalysis(activeSymbol, operationsLog);

  const autopilot = useAutopilot(
    activeSymbol,
    chartData,
    operationsLog,
    addActiveContract,
    executeTrade
  );

  const robotCouncil = useRobotCouncil(
    activeSymbol,
    chartData,
    operationsLog,
    addActiveContract,
    executeTrade
  );

  const memoizedSubscribeToSymbol = useCallback(subscribeToSymbol, []);

  useEffect(() => {
    if (isConnected && !isAssetsLoading && activeSymbol) {
        memoizedSubscribeToSymbol(activeSymbol, timePeriod);
    }
  }, [isConnected, isAssetsLoading, activeSymbol, timePeriod, memoizedSubscribeToSymbol]);


  useEffect(() => {
    if (!isAssetsLoading && !activeSymbol && assetGroups.length > 0) {
        const firstAsset = assetGroups[0]?.options[0]?.value;
        if(firstAsset) {
            setActiveSymbol(firstAsset);
        }
    }
  }, [isAssetsLoading, activeSymbol, assetGroups]);


  useEffect(() => {
    if (['1m', '2m', '3m'].includes(timePeriod) && chartType !== 'Area') {
        setChartType('Area');
    }
  }, [timePeriod, chartType, setChartType]);

 const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prevZoom => {
        let newZoom;
        if (direction === 'in') {
            newZoom = Math.max(20, prevZoom - 20);
        } else {
            newZoom = Math.min(500, prevZoom + 20);
        }
        return newZoom;
    });
  };

  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-8 h-8 mx-auto" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChart className="w-8 h-8 mx-auto" />, disabled: ['1m', '2m', '3m'].includes(timePeriod) },
  ];
  
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          
          {/* Main Content: Chart & Operations Log (Spans more columns on larger screens) */}
          <div className="md:col-span-2 lg:col-span-3 space-y-6">
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
                    <div className="flex items-center gap-2">
                        {activeContracts.length > 0 && (
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={clearActiveContracts}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Limpar negociações</span>
                        </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className={cn("h-8 w-8", showBollingerBands && "bg-accent")}
                            onClick={() => setShowBollingerBands(!showBollingerBands)}
                            disabled={chartType !== 'Candle'}
                            aria-label="Toggle Bollinger Bands"
                        >
                            <Waves className="h-4 w-4" />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-9 h-8 p-0">
                                    {chartType === 'Area' ? <AreaChart className="w-4 h-4" /> : <CandlestickChart className="w-4 h-4" />}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                                <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as ChartType)} className="grid grid-cols-2 gap-2">
                                {chartTypes.map(type => (
                                    <ToggleGroupItem value={type.label} key={type.label} disabled={type.disabled} className="flex flex-col h-auto p-2">
                                        {type.icon}
                                        <span className="text-xs mt-1">{type.label}</span>
                                    </ToggleGroupItem>
                                ))}
                                </ToggleGroup>
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[70px] h-8 text-xs">
                                    <Clock className="w-3 h-3 mr-1.5" />
                                    <span>{timePeriod.toUpperCase()}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                                <div className="grid grid-cols-4 gap-2">
                                    {timePeriods.map(period => (
                                        <Button
                                            key={period}
                                            variant={timePeriod === period ? "default" : "ghost"}
                                            onClick={() => setTimePeriod(period)}
                                            className="w-full h-8 text-xs"
                                        >
                                            {period.toUpperCase()}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleZoom('in')} disabled={zoomLevel <= 20}>
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleZoom('out')} disabled={zoomLevel >= 500}>
                            <Minus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <MarketChart 
                        activeContracts={activeContracts}
                        zoomLevel={zoomLevel}
                        chartData={chartData}
                        isChartLoading={isChartLoading}
                        chartError={chartError}
                        chartType={chartType}
                        timePeriod={timePeriod}
                        showBollingerBands={showBollingerBands}
                    />
                </CardContent>
              </Card>
              <div className="md:hidden">
                <DerivTraderInterface 
                    symbol={activeSymbol || ""}
                    isConnected={isConnected}
                    executeTrade={executeTrade}
                />
              </div>
              <OperationsLog operations={operationsLog} />
          </div>

          {/* Sidebar: Trading and AI Panels */}
          <div className="md:col-span-1 lg:col-span-1 space-y-6">
              <div className="hidden md:block">
                <DerivTraderInterface 
                    symbol={activeSymbol || ""}
                    isConnected={isConnected}
                    executeTrade={executeTrade}
                />
              </div>
              <AutoTraderCouncilInterface
                isCouncilAutopilotOn={robotCouncil.isCouncilAutopilotOn}
                setIsCouncilAutopilotOn={robotCouncil.setIsCouncilAutopilotOn}
                strategyCouncil={robotCouncil.strategyCouncil}
                isFetchingCouncil={robotCouncil.isFetchingCouncil}
                councilVotes={robotCouncil.councilVotes}
                geminiRequestCount={robotCouncil.geminiRequestCount}
                dailyBalance={robotCouncil.dailyBalance}
                setDailyBalance={robotCouncil.setDailyBalance}
                dailyTarget={robotCouncil.dailyTarget}
                setDailyTarget={robotCouncil.setDailyTarget}
                consensusThreshold={robotCouncil.consensusThreshold}
                setConsensusThreshold={robotCouncil.setConsensusThreshold}
                isDynamicConsensusOn={robotCouncil.isDynamicConsensusOn}
                setIsDynamicConsensusOn={robotCouncil.setIsDynamicConsensusOn}
                isMeritocracyOn={robotCouncil.isMeritocracyOn}
                setIsMeritocracyOn={robotCouncil.setIsMeritocracyOn}
                indicators={robotCouncil.indicators}
              />
              <AutoTraderInterface
                isAutopilotOn={autopilot.isAutopilotOn}
                setIsAutopilotOn={autopilot.setIsAutopilotOn}
                autopilotStrategy={autopilot.autopilotStrategy}
                dailyBalance={autopilot.dailyBalance}
                setDailyBalance={autopilot.setDailyBalance}
                dailyTarget={autopilot.dailyTarget}
                setDailyTarget={autopilot.setDailyTarget}
                geminiRequestCount={autopilot.geminiRequestCount}
                isLoading={autopilot.isLoading}
                error={autopilot.error}
                currentRSI={autopilot.currentRSI}
                currentStoch={autopilot.currentStoch}
              />
              <AIAnalysisInterface 
                analyzeSessionPerformance={analyzeSessionPerformance} 
              />
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
