
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

  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: 25,
      duration_unit: "s",
      allowEquals: false,
    },
  });

  // Main API hook for connection and trading
  const { 
    ws,
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
    promisesRef
  } = useDerivApi();

  // Hook for managing chart data and subscriptions
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
    priceTicks,
  } = useMarketData(ws, promisesRef);
  
  // Hook for single autopilot logic
  const {
      isAutopilotOn,
      setIsAutopilotOn,
      autopilotStrategy,
      dailyBalance: autopilotDailyBalance,
      setDailyBalance: setAutopilotDailyBalance,
      dailyTarget: autopilotDailyTarget,
      setDailyTarget: setAutopilotDailyTarget,
      geminiRequestCount: autopilotGeminiCount,
      isLoading: isAutopilotLoading,
      error: autopilotError,
      currentRSI,
      currentStoch
  } = useAutopilot(activeSymbol, chartData, operationsLog, addActiveContract, executeTrade);

  // Hook for robot council logic
  const {
      isCouncilAutopilotOn,
      setIsCouncilAutopilotOn,
      strategyCouncil,
      isFetchingCouncil,
      councilVotes,
      geminiRequestCount: councilGeminiCount,
      dailyBalance: councilDailyBalance,
      setDailyBalance: setCouncilDailyBalance,
      dailyTarget: councilDailyTarget,
      setDailyTarget: setCouncilDailyTarget,
      consensusThreshold,
      setConsensusThreshold,
      isDynamicConsensusOn,
      setIsDynamicConsensusOn,
      isMeritocracyOn,
      setIsMeritocracyOn,
      indicators,
  } = useRobotCouncil(activeSymbol, chartData, operationsLog, addActiveContract, executeTrade);

  // Hook for trade analysis logic
  const { analyzeSessionPerformance } = useTradeAnalysis(activeSymbol, operationsLog);
  

  const memoizedSubscribeToSymbol = useCallback(subscribeToSymbol, [subscribeToSymbol]);

  useEffect(() => {
    if (isConnected && !isAssetsLoading && activeSymbol) {
        memoizedSubscribeToSymbol(activeSymbol, timePeriod);
    }
  }, [isConnected, isAssetsLoading, activeSymbol, timePeriod, memoizedSubscribeToSymbol]);


  useEffect(() => {
    // Set a default active symbol once assets are loaded and if no symbol is active yet
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


  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-8 h-8 mx-auto" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChart className="w-8 h-8 mx-auto" />, disabled: ['1m', '2m', '3m'].includes(timePeriod) },
  ];
  
  return (
    <FormProvider {...form}>
      <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight font-headline">
              Deriv Trader
              </h1>
              <AssetSelector 
              selectedAsset={activeSymbol || ""} 
              onAssetChange={(asset) => {
                setActiveSymbol(asset);
              }} 
              assetGroups={assetGroups}
              isAssetsLoading={isAssetsLoading}
              />
          </div>
          <div className="flex flex-col items-end">
              <ToggleGroup type="single" value={accountType} onValueChange={(value: any) => value && setAccountType(value)} defaultValue="demo" aria-label="Tipo de Conta">
                  <ToggleGroupItem value="demo" aria-label="Usar conta demo">Demo</ToggleGroupItem>
                  <ToggleGroupItem value="real" aria-label="Usar conta real">Real</ToggleGroupItem>
              </ToggleGroup>
              <div className="text-right mt-1 h-6">
                  {accountBalance.loading || isConnecting ? (
                      <Skeleton className="h-4 w-28" />
                  ) : accountBalance.balance !== null ? (
                      <p className="text-sm font-medium text-muted-foreground">
                          Saldo: <span className="font-bold text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: accountBalance.currency || 'USD' }).format(accountBalance.balance)}</span>
                      </p>
                  ) : null}
              </div>
          </div>
        </div>
        <p className="text-muted-foreground">
          Nossa plataforma integrada para negociação de Opções e Multiplicadores.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
              <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                      <CardTitle className="font-headline">
                      Acompanhamento ({activeSymbol})
                      </CardTitle>
                      <CardDescription>
                      Desempenho em tempo real.
                      </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                      {activeContracts.length > 0 && (
                      <Button variant="outline" size="icon" className="h-10 w-10" onClick={clearActiveContracts}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Limpar linhas de negociação</span>
                      </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={cn("h-10 w-10", showBollingerBands && "bg-accent")}
                        onClick={() => setShowBollingerBands(!showBollingerBands)}
                        disabled={chartType !== 'Candle'}
                        aria-label="Toggle Bollinger Bands"
                      >
                          <Waves className="h-5 w-5" />
                      </Button>
                      <Popover>
                          <PopoverTrigger asChild>
                              <Button variant="outline" className="w-11 h-10 p-0">
                                  {chartType === 'Area' ? <AreaChart className="w-5 h-5" /> : <CandlestickChart className="w-5 h-5" />}
                                  <span className="sr-only">Alterar tipo de gráfico</span>
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2">
                              <div className="grid grid-cols-2 gap-2">
                                  {chartTypes.map(type => (
                                      <Button
                                          key={type.label}
                                          variant="ghost"
                                          className={cn(
                                              "flex flex-col h-auto p-2",
                                              chartType === type.label && "bg-accent"
                                          )}
                                          onClick={() => setChartType(type.label)}
                                          disabled={type.disabled}
                                      >
                                          {type.icon}
                                          <span className="text-xs mt-1">{type.label}</span>
                                      </Button>
                                  ))}
                              </div>
                          </PopoverContent>
                      </Popover>
                     
                       <Popover>
                          <PopoverTrigger asChild>
                               <Button variant="outline" className="w-[80px] h-10">
                                  <Clock className="w-4 h-4 mr-2" />
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
                                          className="w-full"
                                      >
                                          {period.toUpperCase()}
                                      </Button>
                                  ))}
                              </div>
                          </PopoverContent>
                      </Popover>

                  </div>
              </CardHeader>
              <CardContent className="relative">
                  <MarketChart 
                      activeContracts={activeContracts}
                      chartData={chartData}
                      isChartLoading={isChartLoading}
                      chartError={chartError}
                      chartType={chartType}
                      timePeriod={timePeriod}
                      showBollingerBands={showBollingerBands}
                  />
              </CardContent>
              </Card>
              <OperationsLog operations={operationsLog} priceTicks={priceTicks} />
          </div>
          <div className="lg:col-span-4 space-y-6">
              <DerivTraderInterface 
                  symbol={activeSymbol || ""}
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  activeToken={activeToken}
                  executeTrade={executeTrade}
              />
              <AutoTraderCouncilInterface
                isCouncilAutopilotOn={isCouncilAutopilotOn}
                setIsCouncilAutopilotOn={setIsCouncilAutopilotOn}
                strategyCouncil={strategyCouncil}
                isFetchingCouncil={isFetchingCouncil}
                councilVotes={councilVotes}
                geminiRequestCount={councilGeminiCount}
                dailyBalance={councilDailyBalance}
                setDailyBalance={setCouncilDailyBalance}
                dailyTarget={councilDailyTarget}
                setDailyTarget={setCouncilDailyTarget}
                consensusThreshold={consensusThreshold}
                setConsensusThreshold={setConsensusThreshold}
                isDynamicConsensusOn={isDynamicConsensusOn}
                setIsDynamicConsensusOn={setIsDynamicConsensusOn}
                isMeritocracyOn={isMeritocracyOn}
                setIsMeritocracyOn={setIsMeritocracyOn}
                indicators={indicators}
              />
              <AutoTraderInterface
                isAutopilotOn={isAutopilotOn}
                setIsAutopilotOn={setIsAutopilotOn}
                autopilotStrategy={autopilotStrategy}
                dailyBalance={autopilotDailyBalance}
                setDailyBalance={setAutopilotDailyBalance}
                dailyTarget={autopilotDailyTarget}
                setDailyTarget={setAutopilotDailyTarget}
                geminiRequestCount={autopilotGeminiCount}
                isLoading={isAutopilotLoading}
                error={autopilotError}
                currentRSI={currentRSI}
                currentStoch={currentStoch}
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
