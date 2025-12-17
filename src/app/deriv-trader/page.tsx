

"use client";

import { useEffect, useState } from "react";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { AreaChart, CandlestickChart as CandlestickChartIcon, Trash2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDerivApi, type AccountType, type ActiveContract } from "@/hooks/use-deriv-api";
import { Skeleton } from "@/components/ui/skeleton";
import type { TradeResult } from "@/services/deriv-api-service";
import { OperationsLog } from "@/components/trading/operations-log";
import { AIAnalysisInterface } from "@/components/trading/ai-analysis-interface";


export type TimePeriod = '1m' | '15m' | '30m' | '1h' | '8h' | '1d';
export type ChartType = 'Area' | 'Candle';

export default function DerivTraderPage() {
  const [selectedAsset, setSelectedAsset] = useState("1HZ100V");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1m');
  const [chartType, setChartType] = useState<ChartType>('Area');
  const { 
    accountType, 
    setAccountType, 
    accountBalance, 
    activeContracts, 
    clearActiveContracts, 
    addActiveContract,
    operationsLog
  } = useDerivApi();


  useEffect(() => {
    // Se o período for 1m, força o tipo de gráfico para Area
    if (timePeriod === '1m' && chartType === 'Candle') {
      setChartType('Area');
    }
  }, [timePeriod, chartType]);

  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-8 h-8 mx-auto" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChartIcon className="w-8 h-8 mx-auto" />, disabled: timePeriod === '1m' },
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
              clearActiveContracts(); // Limpa as linhas ao trocar de ativo
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
                                {chartType === 'Area' ? <AreaChart className="w-5 h-5" /> : <CandlestickChartIcon className="w-5 h-5" />}
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
                    <ToggleGroup type="single" value={timePeriod} onValueChange={(value: TimePeriod) => value && setTimePeriod(value)} defaultValue="1m" aria-label="Período do Gráfico">
                        <ToggleGroupItem value="1m" aria-label="Ver último minuto">1M</ToggleGroupItem>
                        <ToggleGroupItem value="15m" aria-label="Ver últimos 15 minutos">15M</ToggleGroupItem>
                        <ToggleGroupItem value="30m" aria-label="Ver últimos 30 minutos">30M</ToggleGroupItem>
                        <ToggleGroupItem value="1h" aria-label="Ver última hora">1H</ToggleGroupItem>
                        <ToggleGroupItem value="8h" aria-label="Ver últimas 8 horas">8H</ToggleGroupItem>
                        <ToggleGroupItem value="1d" aria-label="Ver último dia">1D</ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardHeader>
            <CardContent>
                <MarketChart 
                    symbol={selectedAsset} 
                    timePeriod={timePeriod} 
                    chartType={chartType} 
                    activeContracts={activeContracts}
                />
            </CardContent>
            </Card>
            <OperationsLog operations={operationsLog} />
        </div>
         <div className="lg:col-span-4 space-y-6">
            <DerivTraderInterface 
                symbol={selectedAsset}
                onTradeSuccess={handleTradeSuccess}
            />
            <AIAnalysisInterface />
        </div>
      </div>
    </div>
  );
}
