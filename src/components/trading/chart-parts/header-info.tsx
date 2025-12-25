
"use client";

import {
  AreaChart,
  CandlestickChart,
  Clock,
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { THEMES } from './themes';
import type { ChartType, TimePeriod } from '@/hooks/use-market-data';

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
}: HeaderInfoProps) {
  const chartButtonClass = cn('h-8 w-8 p-0 border', `bg-[${colors.bg}]`);
  const timePeriods: TimePeriod[] = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '8h', '1d'];

  const change = latestPrice - prevPrice;
  const changePercent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;
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
            <Button variant="outline" className="h-8 px-2 text-xs" disabled>Indicadores</Button>
          </PopoverTrigger>
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
          <ToggleGroupItem value="Candle" aria-label="Gráfico de Velas" disabled>
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
              {timePeriods.map((period) => (
                <Button
                  key={period}
                  variant={timePeriod === period ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setTimePeriod(period)}
                >
                  {period.toUpperCase()}
                </Button>
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
