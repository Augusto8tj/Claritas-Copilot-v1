
'use client';

import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Label, ComposedChart, Area, Cell, Bar } from "recharts";
import { Loader2 } from "lucide-react";
import type { CandleData, TickData, ChartData, ActiveContract } from '@/hooks/use-market-data';
import type { TimePeriod, ChartType } from '@/hooks/use-market-data';

// 1. UTILITY FUNCTION for stable Y-axis domain
const getStableYDomain = (values: number[], padding = 0.05): [number, number] => {
  if (values.length < 2) return ['auto', 'auto'] as any;

  // Using a robust method to find a stable range, ignoring extreme outliers
  const sorted = [...values].sort((a, b) => a - b);
  // Using 2nd and 98th percentiles to avoid extreme outliers from skewing the chart
  const low = sorted[Math.floor(sorted.length * 0.02)];
  const high = sorted[Math.floor(sorted.length * 0.98)];
  
  if(low === undefined || high === undefined) return ['auto', 'auto'] as any;

  const range = high - low;

  return [
    low - range * padding,
    high + range * padding,
  ];
};


// 2. PROFESSIONAL (CORRECTED) CANDLESTICK COMPONENT
const Candlestick = ({ x, y, width, height, payload }: any) => {
  if (!payload || payload.open === undefined) return null;
    
  const { open, close, high, low } = payload;
  const bullish = close >= open;
  const color = bullish
    ? 'hsl(var(--chart-2))'
    : 'hsl(var(--destructive))';

  // The y-coordinate from recharts is the TOP of the highest point (high).
  // We need to calculate body position based on that.
  const bodyHeight = Math.max(1, Math.abs(open - close));
  const bodyY = bullish ? y + (high - close) : y + (high - open);

  return (
    <g>
      {/* Wick */}
      <line
        x1={x + width / 2}
        x2={x + width / 2}
        y1={y}
        y2={y + (high - low)}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + width * 0.15}
        y={bodyY}
        width={width * 0.7}
        height={bodyHeight}
        fill={color}
      />
    </g>
  );
};


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

  const priceTickFormatter = (value: any) => {
    if (typeof value !== 'number') return value;
    if (value > 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    if (value < 10) {
        return value.toFixed(4);
    }
    return value.toFixed(2);
  };
  
  const latestPrice = visibleData.length > 0 
    ? 'price' in visibleData[visibleData.length - 1] 
      ? (visibleData[visibleData.length - 1] as TickData).price 
      : (visibleData[visibleData.length - 1] as CandleData).close 
    : 0;

  
  const renderChart = () => {
     if (['1m','2m','3m'].includes(timePeriod)) {
        const tickData = visibleData as TickData[];
        if (!tickData || tickData.length === 0) return null;
        
        const prices = tickData.map(d => d.price);
        const yDomain = getStableYDomain(prices);
        
        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tickData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                        dataKey="epoch"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(e) =>
                            new Date(e * 1000).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            })
                        }
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        dataKey="price"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={yDomain}
                        tickFormatter={priceTickFormatter}
                        orientation="right"
                        width={80}
                    />
                    <Tooltip
                        formatter={(value: number) => [Number(value).toFixed(4), "Preço"]}
                        labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        animationDuration={0}
                    />
                    <Line
                        type="stepAfter"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                     {activeContracts.map(contract => (
                        <React.Fragment key={contract.contractId}>
                            <ReferenceDot
                                x={contract.entryTime}
                                y={contract.entryTick}
                                r={5}
                                fill="hsl(var(--accent))"
                                stroke="white"
                                strokeWidth={2}
                            />
                            {contract.status !== 'open' && contract.exitTime && contract.exitTick && (
                                <ReferenceDot
                                    x={contract.exitTime}
                                    y={contract.exitTick}
                                    r={5}
                                    fill={contract.status === 'won' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                                    stroke="white"
                                    strokeWidth={2}
                                />
                            )}
                        </React.Fragment>
                    ))}
                    {latestPrice && (
                       <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4">
                           <Label value={priceTickFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
                       </ReferenceLine>
                    )}
                </LineChart>
            </ResponsiveContainer>
        )
     }

     const candleData = visibleData as CandleData[];
     if (!candleData || candleData.length === 0) return null;
     
     const prices = candleData.flatMap(d => [d.high, d.low]);
     const yDomain = getStableYDomain(prices);
     
     if (chartType === 'Candle') {
        return (
            <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={candleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                        dataKey="epoch" 
                        tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})} 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                    />
                    <YAxis 
                        domain={yDomain}
                        tickFormatter={priceTickFormatter}
                        orientation="right"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={80}
                        scale="linear"
                    />
                    <Tooltip
                        labelFormatter={(label) => new Date(label * 1000).toLocaleString('pt-BR')}
                        formatter={(value: any, name: any, props: any) => {
                            if (name === 'candle' && props.payload) {
                                const { open, high, low, close } = props.payload;
                                return [
                                    `Abertura: ${open?.toFixed(4)}`,
                                    `Máxima: ${high?.toFixed(4)}`,
                                    `Mínima: ${low?.toFixed(4)}`,
                                    `Fechamento: ${close?.toFixed(4)}`
                                ];
                            }
                            return [value];
                        }}
                         contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    />
                    {showBollingerBands && (
                    <>
                        <Area
                            dataKey="bollingerUpper"
                            stackId="bollinger"
                            stroke="transparent"
                            fill="hsl(var(--primary) / 0.1)"
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
                     <Bar dataKey="close" name="candle" shape={<Candlestick />} isAnimationActive={false} />
                     
                     {activeContracts.map(contract => (
                        <React.Fragment key={contract.contractId}>
                            <ReferenceDot
                                x={contract.entryTime}
                                y={contract.entryTick}
                                r={5}
                                fill="hsl(var(--accent))"
                                stroke="white"
                                strokeWidth={2}
                            />
                            {contract.status !== 'open' && contract.exitTime && contract.exitTick && (
                                <ReferenceDot
                                    x={contract.exitTime}
                                    y={contract.exitTick}
                                    r={5}
                                    fill={contract.status === 'won' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                                    stroke="white"
                                    strokeWidth={2}
                                />
                            )}
                        </React.Fragment>
                    ))}
                    {latestPrice && (
                       <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4">
                           <Label value={priceTickFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
                       </ReferenceLine>
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        );
     }

     return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={candleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                    dataKey="epoch"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                />
                <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={yDomain}
                    tickFormatter={priceTickFormatter}
                    orientation="right"
                    width={80}
                />
                <Tooltip
                    formatter={(value: number) => [Number(value).toFixed(4), "Preço de Fechamento"]}
                    labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                />
                 {showBollingerBands && (
                    <>
                        <Area
                            type="monotone"
                            dataKey="bollingerUpper"
                            stackId="bollinger"
                            stroke="transparent"
                            fill="hsl(var(--primary) / 0.1)"
                            isAnimationActive={false}
                        />
                         <Area
                            type="monotone"
                            dataKey="bollingerLower"
                            stackId="bollinger"
                            stroke="transparent"
                            fill="hsl(var(--background))"
                            isAnimationActive={false}
                        />
                    </>
                 )}
                <Line
                    type="linear"
                    dataKey="close"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
                {activeContracts.map(contract => (
                    <React.Fragment key={contract.contractId}>
                        <ReferenceDot
                            x={contract.entryTime}
                            y={contract.entryTick}
                            r={5}
                            fill="hsl(var(--accent))"
                            stroke="white"
                            strokeWidth={2}
                        />
                        {contract.status !== 'open' && contract.exitTime && contract.exitTick && (
                            <ReferenceDot
                                x={contract.exitTime}
                                y={contract.exitTick}
                                r={5}
                                fill={contract.status === 'won' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                                stroke="white"
                                strokeWidth={2}
                            />
                        )}
                    </React.Fragment>
                ))}
                 {latestPrice && (
                    <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4">
                        <Label value={priceTickFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
                    </ReferenceLine>
                 )}
            </LineChart>
        </ResponsiveContainer>
     );
  }

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

  return (
    <div className="h-[400px] w-full relative group">
      {renderChart()}
    </div>
  );
}
