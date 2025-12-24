'use client';

import * as React from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
  Label,
  ComposedChart,
  Area,
  Bar
} from "recharts";
import { Loader2 } from "lucide-react";

import type {
  CandleData,
  TickData,
  ChartData,
  ActiveContract,
  TimePeriod,
  ChartType
} from '@/hooks/use-market-data';

/* =========================================================
   UTIL — Domínio Y estável, robusto e profissional
========================================================= */
const getStableYDomain = (values: number[], padding = 0.06): [number, number] => {
  if (values.length < 2) return ['auto', 'auto'] as any;

  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.02)];
  const high = sorted[Math.floor(sorted.length * 0.98)];

  if (low === undefined || high === undefined) {
    return ['auto', 'auto'] as any;
  }

  const range = high - low || high * 0.01;

  return [
    low - range * padding,
    high + range * padding,
  ];
};

/* =========================================================
   CANDLESTICK — 100% auto-ajustável ao eixo Y
========================================================= */
const Candlestick = (props: any) => {
  const { x, width, payload, yAxisMap } = props;

  if (!payload || !yAxisMap) return null;

  const { open, close, high, low } = payload;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!yAxis?.scale) return null;

  const scale = yAxis.scale;

  const bullish = close >= open;
  const color = bullish
    ? 'hsl(var(--chart-2))'
    : 'hsl(var(--destructive))';

  const openY = scale(open);
  const closeY = scale(close);
  const highY = scale(high);
  const lowY = scale(low);

  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(1, Math.abs(openY - closeY));

  return (
    <g>
      {/* Wick */}
      <line
        x1={x + width / 2}
        x2={x + width / 2}
        y1={highY}
        y2={lowY}
        stroke={color}
        strokeWidth={1}
      />

      {/* Body */}
      <rect
        x={x + width * 0.2}
        y={bodyTop}
        width={width * 0.6}
        height={bodyHeight}
        fill={color}
        rx={1}
      />
    </g>
  );
};

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
interface MarketChartProps {
  activeContracts: ActiveContract[];
  zoomLevel: number;
  chartData: ChartData[];
  isChartLoading: boolean;
  chartError: string | null;
  chartType: ChartType;
  timePeriod: TimePeriod;
  showBollingerBands: boolean;
}

export function MarketChart({
  activeContracts,
  zoomLevel,
  chartData,
  isChartLoading,
  chartError,
  chartType,
  timePeriod,
  showBollingerBands,
}: MarketChartProps) {

  const visibleData = React.useMemo(() => {
    if (chartData.length > zoomLevel) {
      return chartData.slice(chartData.length - zoomLevel);
    }
    return chartData;
  }, [chartData, zoomLevel]);

  const priceFormatter = (v: number) => {
    if (v > 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v < 10) return v.toFixed(4);
    return v.toFixed(2);
  };

  const latestPrice =
    visibleData.length > 0
      ? 'price' in visibleData.at(-1)!
        ? (visibleData.at(-1) as TickData).price
        : (visibleData.at(-1) as CandleData).close
      : null;
      
    if (isChartLoading && visibleData.length === 0) {
      return (
        <div className="h-[400px] w-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground ml-3">Carregando dados do gráfico...</p>
        </div>
      );
    }

    if (chartError) {
      return (
        <div className="h-[400px] w-full flex items-center justify-center text-center p-4">
          <p className="text-destructive">{chartError}</p>
        </div>
      );
    }

  /* =======================================================
     TICKS (1m, 2m, 3m)
  ======================================================= */
  if (['1m', '2m', '3m'].includes(timePeriod)) {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div className="h-[400px] w-full relative group">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

            <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e =>
                new Date(e * 1000).toLocaleTimeString('pt-BR')
              }
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              domain={yDomain}
              tickFormatter={priceFormatter}
              orientation="right"
              width={80}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
              formatter={(value: number) => [priceFormatter(value), "Preço"]}
              contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
            />

            <Line
              type="stepAfter"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {latestPrice && (
              <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4">
                <Label value={priceFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
              </ReferenceLine>
            )}
            
            {activeContracts.map(contract => (
              <ReferenceDot
                key={contract.contractId}
                x={contract.entryTime}
                y={contract.entryTick}
                r={5}
                fill="hsl(var(--accent))"
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* =======================================================
     CANDLES
  ======================================================= */
  const candleData = visibleData as CandleData[];
  const yDomain = getStableYDomain(
    candleData.flatMap(d => [d.high, d.low])
  );

  return (
    <div className="h-[400px] w-full relative group">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={candleData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

          <XAxis
            dataKey="epoch"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={e =>
              new Date(e * 1000).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            }
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            domain={yDomain}
            tickFormatter={priceFormatter}
            orientation="right"
            width={80}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
          />

          {showBollingerBands && (
            <>
              <Area
                dataKey="bollingerUpper"
                stackId="bollinger"
                stroke="transparent"
                fill="hsl(var(--primary) / 0.12)"
                isAnimationActive={false}
              />
              <Area
                dataKey="bollingerLower"
                stackId="bollinger"
                stroke="transparent"
                fill="hsl(var(--background))"
                isAnimationActive={false}
              />
            </>
          )}

          <Bar
            dataKey="close"
            shape={<Candlestick />}
            isAnimationActive={false}
          />
          
          {activeContracts.map(contract => (
            <ReferenceDot
              key={contract.contractId}
              x={contract.entryTime}
              y={contract.entryTick}
              r={5}
              fill="hsl(var(--accent))"
              stroke="white"
              strokeWidth={2}
            />
          ))}


          {latestPrice && (
            <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4">
              <Label value={priceFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12}/>
            </ReferenceLine>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}