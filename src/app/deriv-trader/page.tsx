
"use client";

import { useState } from "react";
import { DerivTraderInterface } from "@/components/trading/deriv-trader-interface";
import { AssetSelector } from "@/components/trading/asset-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketChart } from "@/components/trading/market-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { AreaChart, CandlestickChart as CandlestickChartIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDerivApi, type AccountType } from "@/hooks/use-deriv-api";

export type TimePeriod = '1m' | '15m' | '30m' | '1h' | '8h' | '1d';
export type ChartType = 'Area' | 'Candle';

export default function DerivTraderPage() {
  const [selectedAsset, setSelectedAsset] = useState("1HZ100V");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1m');
  const [chartType, setChartType] = useState<ChartType>('Area');
  const { accountType, setAccountType } = useDerivApi();

  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-8 h-8 mx-auto" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChartIcon className="w-8 h-8 mx-auto" />, disabled: false },
  ];

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
        <ToggleGroup type="single" value={accountType} onValueChange={(value: AccountType) => value && setAccountType(value)} defaultValue="demo" aria-label="Tipo de Conta">
            <ToggleGroupItem value="demo" aria-label="Usar conta demo">Demo</ToggleGroupItem>
            <ToggleGroupItem value="real" aria-label="Usar conta real">Real</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-muted-foreground">
        Nossa plataforma integrada para negociação de Opções e Multiplicadores.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <div className="lg:col-span-5">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="font-headline">
                    Acompanhamento de Ativo ({selectedAsset})
                    </CardTitle>
                    <CardDescription>
                    Visualização do desempenho do ativo em tempo real.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
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
                <MarketChart symbol={selectedAsset} timePeriod={timePeriod} chartType={chartType} />
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
