

"use client";

import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Label, BarChart, Bar, ComposedChart, ReferenceDot } from "recharts";
import { useDerivApi, type ActiveContract } from "@/hooks/use-deriv-api";
import { Loader2 } from "lucide-react";
import type { CandleData, TickData } from '@/hooks/use-deriv-api';


const Candlestick = (props: any) => {
    const { x, y, width, height, payload } = props;
    
    if ([x, y, width, height].some(val => val === undefined || isNaN(val)) || !payload) {
        return null;
    }
    
    const { open, close, high, low } = payload;
     if ([open, close, high, low].some(val => val === undefined || isNaN(val))) {
        return null;
    }

    const isBullish = close > open;
    const color = isBullish ? 'hsl(142.1 76.2% 41.2%)' : 'hsl(0 84.2% 60.2%)';

    const bodyY = isBullish ? y + (height * (high - close) / (high - low)) : y + (height * (high - open) / (high - low));
    const bodyHeight = Math.max(1, Math.abs((height * (open - close)) / (high - low)));

    return (
        <g>
            <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth="1" />
            <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={color} />
        </g>
    );
};


interface MarketChartProps {
  activeContracts: ActiveContract[];
  zoomLevel: number;
}


export function MarketChart({ activeContracts, zoomLevel }: MarketChartProps) {
  const { chartData, isChartLoading, chartError, chartType, timePeriod } = useDerivApi();

  const visibleData = React.useMemo(() => {
    if (chartData.length > zoomLevel) {
        return chartData.slice(chartData.length - zoomLevel);
    }
    return chartData;
  }, [chartData, zoomLevel]);
  
  const renderChart = () => {
     // For '1m', we only have tick data, so we must use a LineChart.
     if (timePeriod === '1m') {
        const tickData = visibleData as TickData[];
        const xDomain = tickData.length > 0 ? [tickData[0].epoch, tickData[tickData.length - 1].epoch] : [0, 0];
        
        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tickData}>
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
                        domain={['dataMin - 0.0005', 'dataMax + 0.0005']}
                        tickFormatter={(value) => Number(value).toFixed(4)}
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
                                    fill={contract.status === 'won' ? 'hsl(120, 70%, 50%)' : 'hsl(0, 70%, 50%)'}
                                    stroke="white"
                                    strokeWidth={2}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </LineChart>
            </ResponsiveContainer>
        )
     }

     // For other time periods, we have candle data.
     const candleData = visibleData as CandleData[];
     const yDomain = candleData.length > 0
        ? [Math.min(...candleData.map(d => d.low)), Math.max(...candleData.map(d => d.high))]
        : ['auto', 'auto'];

     // Show candle chart if selected
     if (chartType === 'Candle') {
        return (
            <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={candleData} barGap={-3} barCategoryGap="30%">
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
                        tickFormatter={(val) => Number(val).toFixed(4)}
                        orientation="right"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                    />
                    <Tooltip
                        labelFormatter={(label) => new Date(label * 1000).toLocaleString('pt-BR')}
                        formatter={(value, name, props) => {
                            if (props.payload) {
                                const { open, high, low, close } = props.payload;
                                return [
                                    `Abertura: ${open.toFixed(4)}`,
                                    `Máxima: ${high.toFixed(4)}`,
                                    `Mínima: ${low.toFixed(4)}`,
                                    `Fechamento: ${close.toFixed(4)}`
                                ];
                            }
                            return [value];
                        }}
                         contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    />
                     <Bar dataKey="close" shape={<Candlestick />} />
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
                                    fill={contract.status === 'won' ? 'hsl(120, 70%, 50%)' : 'hsl(0, 70%, 50%)'}
                                    stroke="white"
                                    strokeWidth={2}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </BarChart>
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
                    dataKey="close"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={yDomain}
                    tickFormatter={(value) => Number(value).toFixed(4)}
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
                                fill={contract.status === 'won' ? 'hsl(120, 70%, 50%)' : 'hsl(0, 70%, 50%)'}
                                stroke="white"
                                strokeWidth={2}
                            />
                        )}
                    </React.Fragment>
                ))}
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
