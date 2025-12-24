
"use client";

import {
  AreaChart,
  CandlestickChart,
  Clock,
  Minus,
  Moon,
  Plus,
  Sun,
  Waves,
  TrendingUp,
  TrendingDown,
  LineChart,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { THEMES } from './themes';
import type { ChartType, TimePeriod } from '@/hooks/use-market-data';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface HeaderInfoProps {
  symbol: string;
  latestPrice: number;
  prevPrice: number;
  colors: typeof THEMES.dark;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  chartTheme: 'light' | 'dark';
  setChartTheme: (theme: 'light' | 'dark') => void;
  handleZoom: (direction: 'in' | 'out') => void;
  showBollingerBands: boolean;
  setShowBollingerBands: (show: boolean) => void;
  showSMA: boolean;
  setShowSMA: (show: boolean) => void;
  showEMA: boolean;
  setShowEMA: (show: boolean) => void;
  showVWAP: boolean;
  setShowVWAP: (show: boolean) => void;
}

export function HeaderInfo({
  symbol,
  latestPrice,
  prevPrice,
  colors,
  chartType,
  setChartType,
  timePeriod,
  setTimePeriod,
  chartTheme,
  setChartTheme,
  handleZoom,
  showBollingerBands,
  setShowBollingerBands,
  showSMA, setShowSMA, showEMA, setShowEMA, showVWAP, setShowVWAP
}: HeaderInfoProps) {
  const chartButtonClass = cn('h-8 w-8 p-0 border', `bg-[${colors.bg}]`);
  const timePeriods: TimePeriod[] = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '8h', '1d'];

  const change = latestPrice - prevPrice;
  const changePercent = (change / prevPrice) * 100;
  const isPositive = change >= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 mb-2">
      {/* Informações do Ativo */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold" style={{ color: colors.text }}>
          {symbol}
        </h2>
        <div className="flex items-center gap-2" style={{ color: isPositive ? colors.bull : colors.bear }}>
          <span className="font-semibold text-lg">
            {latestPrice.toFixed(4)}
          </span>
          <div className="text-xs font-mono flex items-center">
             {isPositive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
             <span>{change.toFixed(4)} ({changePercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Controles do Gráfico */}
      <div className="flex items-center gap-1.5">
         <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 px-2 text-xs">Indicadores</Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 space-y-2">
             <div className="flex items-center justify-between">
                <Label htmlFor="sma-toggle" className="text-sm font-normal">Média Móvel (SMA)</Label>
                <Switch id="sma-toggle" checked={showSMA} onCheckedChange={setShowSMA} />
             </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ema-toggle" className="text-sm font-normal">Média Móvel Exp. (EMA)</Label>
                <Switch id="ema-toggle" checked={showEMA} onCheckedChange={setShowEMA} />
             </div>
             <div className="flex items-center justify-between">
                <Label htmlFor="vwap-toggle" className="text-sm font-normal">VWAP</Label>
                <Switch id="vwap-toggle" checked={showVWAP} onCheckedChange={setShowVWAP} />
             </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="bb-toggle" className="text-sm font-normal">Bandas de Bollinger</Label>
                <Switch id="bb-toggle" checked={showBollingerBands} onCheckedChange={setShowBollingerBands} />
             </div>
          </PopoverContent>
        </Popover>

        <ToggleGroup
          type="single"
          value={chartType}
          onValueChange={(value: ChartType) => value && setChartType(value)}
          aria-label="Tipo de Gráfico"
        >
          <ToggleGroupItem value="Area" aria-label="Gráfico de Área">
            <AreaChart size={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="Candle" aria-label="Gráfico de Velas">
            <CandlestickChart size={16} />
          </ToggleGroupItem>
        </ToggleGroup>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 w-[70px] text-xs flex items-center gap-1">
              <Clock size={14} />
              {timePeriod.toUpperCase()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1">
            <div className="grid grid-cols-5 gap-1">
              {timePeriods.map(p => (
                <Button key={p} variant={timePeriod === p ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setTimePeriod(p)}>{p.toUpperCase()}</Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setChartTheme(chartTheme === 'dark' ? 'light' : 'dark')}>
          {chartTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>
    </div>
  );
}
