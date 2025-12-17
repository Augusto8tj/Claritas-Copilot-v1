

'use client';

import { useEffect, useState } from "react";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { AreaChart, Trash2, Plus, Minus, CandlestickChart } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDerivApi, type AccountType, type ActiveContract } from "@/hooks/use-deriv-api";
import { Skeleton } from "@/components/ui/skeleton";
import type { TradeResult } from "@/services/deriv-api-service";
import { OperationsLog } from "@/components/trading/operations-log";
import { AIAnalysisInterface } from "@/components/trading/ai-analysis-interface";
import { AutoTraderInterface } from "@/components/trading/auto-trader-interface";

export type TimePeriod = '1m' | '15m' | '30m' | '1h' | '8h' | '1d';
export type ChartType = 'Area' | 'Candle';

const timePeriods: TimePeriod[] = ['1m', '15m', '30m', '1h', '8h', '1d'];

export default function DerivTraderPage() {
  const [selectedAsset, setSelectedAsset] = useState("1HZ100V");
  const [zoomLevel, setZoomLevel] = useState(100); // Representa o número de pontos de dados a serem mostrados.
  
  const { 
    accountType, 
    setAccountType, 
    accountBalance, 
    activeContracts, 
    clearActiveContracts, 
    addActiveContract,
    operationsLog,
    isConnected,
    activeToken,
    subscribeToSymbol,
    chartType,
    setChartType,
    timePeriod,
    setTimePeriod
  } = useDerivApi();

  useEffect(() => {
    if (isConnected && selectedAsset) {
      subscribeToSymbol(selectedAsset, timePeriod, chartType);
    }
  }, [isConnected, selectedAsset, timePeriod, chartType, subscribeToSymbol]);

  useEffect(() => {
    if (timePeriod !== '1m' && chartType === 'Area') {
        // Area chart is only for 1m (ticks), switch to candle for others
        setChartType('Candle');
    } else if (timePeriod === '1m' && chartType === 'Candle') {
        // Candle chart is not available for 1m, switch to Area
        setChartType('Area');
    }
  }, [timePeriod, chartType, setChartType]);


  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-8 h-8 mx-auto" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChart className="w-8 h-8 mx-auto" />, disabled: timePeriod === '1m' },
  ];
  
  const handleTradeSuccess = (tradeResult: TradeResult) => {
      if (tradeResult.success && tradeResult.contractId && tradeResult.entryTick && tradeResult.entryTime) {
          addActiveContract({
              contractId: tradeResult.contractId,
              entryTick: tradeResult.entryTick,
              entryTime: tradeResult.entryTime,
          });
      }
  }

  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prevZoom => {
        let newZoom;
        if (direction === 'in') {
            newZoom = Math.max(20, prevZoom - 20); // Zoom in, show fewer points, min 20
        } else {
            newZoom = Math.min(500, prevZoom + 20); // Zoom out, show more points, max 500
        }
        return newZoom;
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
            Deriv Trader
            </h1>
            <AssetSelector 
            selectedAsset={selectedAsset} 
            onAssetChange={(asset) => {
              setSelectedAsset(asset);
              clearActiveContracts();
            }} 
            />
        </div>
        <div className="flex flex-col items-end">
            <ToggleGroup type="single" value={accountType} onValueChange={(value: AccountType) => value && setAccountType(value)} defaultValue="demo" aria-label="Tipo de Conta">
                <ToggleGroupItem value="demo" aria-label="Usar conta demo">Demo</ToggleGroupItem>
                <ToggleGroupItem value="real" aria-label="Usar conta real">Real</ToggleGroupItem>
            </ToggleGroup>
            <div className="text-right mt-1 h-6">
                {accountBalance.loading ? (
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
                    Acompanhamento ({selectedAsset})
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
                    <div className="flex items-center rounded-md border bg-background">
                        <ToggleGroup type="single" value={timePeriod} onValueChange={(value: TimePeriod) => value && setTimePeriod(value)} aria-label="Período do Gráfico" className="gap-0">
                            {timePeriods.map(period => (
                                <ToggleGroupItem 
                                    key={period}
                                    value={period} 
                                    aria-label={`Ver ${period}`}
                                    className="rounded-none data-[state=on]:bg-accent/50 h-9"
                                >
                                    {period.toUpperCase()}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="relative">
                <MarketChart 
                    activeContracts={activeContracts}
                    zoomLevel={zoomLevel}
                />
                 <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleZoom('in')} disabled={zoomLevel <= 20}>
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Zoom In</span>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleZoom('out')} disabled={zoomLevel >= 500}>
                        <Minus className="h-4 w-4" />
                        <span className="sr-only">Zoom Out</span>
                    </Button>
                </div>
            </CardContent>
            </Card>
            <OperationsLog operations={operationsLog} />
        </div>
         <div className="lg:col-span-4 space-y-6">
            <AutoTraderInterface
                symbol={selectedAsset}
                onTradeSuccess={handleTradeSuccess}
            />
            <DerivTraderInterface 
                symbol={selectedAsset}
                onTradeSuccess={handleTradeSuccess}
                isConnected={isConnected && !!activeToken}
            />
            <AIAnalysisInterface symbol={selectedAsset} />
        </div>
      </div>
    </div>
  );
}
