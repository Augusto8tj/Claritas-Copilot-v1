
'use client';

import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Label, BarChart, Bar, ComposedChart, ReferenceDot, Area } from "recharts";
import { Loader2 } from "lucide-react";
import type { CandleData, TickData, ChartData, ActiveContract } from '@/hooks/use-market-data';
import type { TimePeriod, ChartType } from '@/hooks/use-market-data';

const Candlestick = (props: any) => {
    const { x, y, width, height, low, high, open, close } = props;
    const isBullish = close > open;
    const color = isBullish ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))';

    return (
        <g stroke={color} fill={color} strokeWidth="1">
            {/* Wick */}
            <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} />
            {/* Body */}
            <rect x={x} y={isBullish ? y + (high - close) : y + (high - open)} width={width} height={Math.max(1, Math.abs(open-close))} />
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
      return `${(value / 1000).toFixed(0)}k`;
    }
    if (value < 10) {
        return value.toFixed(4);
    }
    return value.toFixed(2);
  };

  const latestPrice = visibleData.length > 0 ? (visibleData[visibleData.length - 1] as any).price || (visibleData[visibleData.length - 1] as any).close : 0;
  
  const renderChart = () => {
     // For '1m', '2m', '3m', we only have tick data, so we must use a LineChart.
     if (['1m','2m','3m'].includes(timePeriod)) {
        const tickData = visibleData as TickData[];
        if (!tickData || tickData.length === 0) return null;
        
        const xDomain = tickData.length > 0 ? [tickData[0].epoch, tickData[tickData.length - 1].epoch] : [0, 0];
        
        const prices = tickData.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        const margin = priceRange * 0.1; // 10% margin
        const yDomain: [number, number] = [minPrice - margin, maxPrice + margin];


        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...tickData]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                        dataKey="epoch"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR')}
                        type="number"
                        domain={xDomain}
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
                        formatter={(value: number, name, props: any) => [Number(value).toFixed(4), "Preço"]}
                        labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        animationDuration={0}
                    />
                    <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                    />
                     {activeContracts.map(contract => (
                        <React.Fragment key={contract.contractId}>
                            {/* Entry Dot */}
                            <ReferenceDot
                                x={contract.entryTime}
                                y={contract.entryTick}
                                r={5}
                                fill="hsl(var(--accent))"
                                stroke="white"
                                strokeWidth={2}
                            />
                            {/* Exit Dot */}
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
                       <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="3 3">
                           <Label value={priceTickFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
                       </ReferenceLine>
                    )}
                </LineChart>
            </ResponsiveContainer>
        )
     }

     // For other time periods, we have candle data.
     const candleData = visibleData as CandleData[];
     if (!candleData || candleData.length === 0) return null;
     
     const allLows = candleData.map(d => d.low).filter(v => v !== undefined);
     const allHighs = candleData.map(d => d.high).filter(v => v !== undefined);

     if(allLows.length === 0 || allHighs.length === 0) return null;

     const minPrice = Math.min(...allLows);
     const maxPrice = Math.max(...allHighs);
     const priceRange = maxPrice - minPrice;
     const margin = priceRange * 0.1; // 10% margin
     const yDomain: [number, number] = [minPrice - margin, maxPrice + margin];
     

     // Show candle chart if selected
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
                     <Area 
                        dataKey="bollingerBands" 
                        stroke="hsl(var(--primary) / 0.5)"
                        fill="hsl(var(--primary) / 0.1)"
                        isAnimationActive={false} 
                        type="monotone"
                     />
                    )}
                     <Bar dataKey="close" name="candle" shape={<Candlestick />} isAnimationActive={false}>
                        {candleData.map(entry => <Cell key={`cell-${entry.epoch}`} />)}
                     </Bar>
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
                       <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="3 3">
                           <Label value={priceTickFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
                       </ReferenceLine>
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        );
     }

     // Fallback to a line chart using the 'close' price from candle data.
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
                    formatter={(value: number, name, props: any) => [Number(value).toFixed(4), "Preço de Fechamento"]}
                    labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                />
                <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="close"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
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
                    <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="3 3">
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
