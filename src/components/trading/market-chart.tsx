

"use client";

import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import type { TimePeriod, ChartType } from "@/app/deriv-trader/page";
import { CandlestickChartIcon } from "../icons";

type TickData = {
  epoch: number;
  price: number;
};

type CandleData = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ChartData = TickData | CandleData;

interface MarketChartProps {
  symbol: string;
  timePeriod: TimePeriod;
  chartType: ChartType;
}

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";

const getHistoryDurationForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 10 * 60; // 10 minutes
        case '15m': return 4 * 60 * 60; // 4 hours
        case '30m': return 24 * 60 * 60; // 24 hours
        case '1h': return 4 * 24 * 60 * 60; // 4 days
        case '8h': return 7 * 24 * 60 * 60; // 7 days
        case '1d': return 30 * 24 * 60 * 60; // 30 days
        default: return 10 * 60;
    }
}


const getGranularityForTimePeriod = (timePeriod: TimePeriod): number | undefined => {
    if (timePeriod === '1m') return undefined; // Ticks, not candles
    const durationSeconds = getHistoryDurationForTimePeriod(timePeriod);
    if (durationSeconds <= 24 * 3600) return 60; // 1-minute candles for up to 24h
    if (durationSeconds <= 7 * 24 * 3600) return 300; // 5-minute candles for up to 7 days
    return 3600; // 1-hour candles for more
}


function CustomCandle({ x, y, width, height, low, high, open, close }: any) {
  // Safety check to prevent rendering with invalid NaN values
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height) || isNaN(low) || isNaN(high) || isNaN(open) || isNaN(close)) {
    return null;
  }
  
  const isBullish = close >= open;
  const color = isBullish ? "hsl(var(--primary))" : "hsl(var(--destructive))";
  
  // Ensure width is at least 1 to be visible
  const bodyWidth = Math.max(width, 1);
  
  const bodyY = isBullish ? y + (high - close) : y + (high - open);
  const bodyHeight = Math.max(Math.abs(open - close), 1);

  const wickX = x + bodyWidth / 2;

  return (
    <g>
      {/* Wick */}
      <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={color} strokeWidth="1" />
      {/* Body */}
      <rect x={x} y={bodyY} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  );
};


export function MarketChart({ symbol, timePeriod, chartType }: MarketChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData([]);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const historyDuration = getHistoryDurationForTimePeriod(timePeriod);
      const startTime = Math.floor(Date.now() / 1000) - historyDuration;
      
      const shouldUseTicks = timePeriod === '1m';
      const style = shouldUseTicks ? 'ticks' : 'candles';
      const granularity = getGranularityForTimePeriod(timePeriod);

      const request = {
          "ticks_history": symbol,
          "end": "latest",
          "start": startTime,
          "style": style,
          ...(granularity && { "granularity": granularity })
      };
      ws.send(JSON.stringify(request));

      // Subscribe to live ticks only for the '1m' view
      if (shouldUseTicks) {
        ws.send(JSON.stringify({ "ticks": symbol, "subscribe": 1 }));
      }
    };

    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);

      if (response.error) {
        console.error("Deriv API error:", response.error.message);
        setError(response.error.message);
        setLoading(false);
        ws.close();
        return;
      }
      
      let initialData: ChartData[] = [];
      if (response.msg_type === 'history' && response.history) {
        initialData = response.history.times.map((time: number, index: number) => ({
          epoch: time,
          price: response.history.prices[index],
        }));
      } else if (response.msg_type === 'candles' && response.candles) {
        initialData = response.candles.map((candle: any) => ({
            epoch: candle.epoch,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        })).filter((c: CandleData) => c.open);
      }
      
      if (initialData.length > 0) {
        setData(initialData);
        setLoading(false);
      } else if (response.msg_type === 'history' || response.msg_type === 'candles') {
        // This case handles when the API returns an empty history for the requested period.
        if (data.length === 0) { // Only stop loading if we haven't received any data yet
          setLoading(false);
        }
      }

      if (response.msg_type === 'tick' && timePeriod === '1m') {
        const tick = response.tick;
        const newTickData: TickData = { epoch: tick.epoch, price: tick.quote };
        setData(currentData => {
            if (currentData.length > 0 && (currentData[currentData.length - 1] as TickData).epoch === newTickData.epoch) {
                return currentData;
            }
            const newData = [...currentData, newTickData];
            const maxPoints = 1000; 
            if (newData.length > maxPoints) {
                return newData.slice(newData.length - maxPoints);
            }
            return newData;
        });
      }
    };
    
    ws.onerror = (event) => {
        console.error("WebSocket connection error:", event);
        setError("Não foi possível conectar ao servidor de dados em tempo real.");
        setLoading(false);
    }

    ws.onclose = (event) => {
        if (!event.wasClean && !error) {
           console.warn(`[Deriv WS] A conexão foi perdida inesperadamente (Código: ${event.code}).`);
        }
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
         try {
            wsRef.current.send(JSON.stringify({ "forget_all": "ticks" }));
            wsRef.current.close();
         } catch (e) {
            console.warn("[Deriv WS] WebSocket already closed or errored on cleanup.");
         }
      }
      wsRef.current = null;
    };
  }, [symbol, timePeriod, chartType]);
  
  const getXAxisDomain = (): [number, number] => {
    const now = Math.floor(Date.now() / 1000);
    const duration = getHistoryDurationForTimePeriod(timePeriod);
    return [now - duration, now];
  };

  const yDomain = React.useMemo(() => {
    if (data.length === 0) return ['auto', 'auto'];

    const values = data.flatMap(d => {
        if ('price' in d) return [d.price];
        if ('high' in d) return [d.high, d.low];
        return [];
    });

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1;

    return [min - padding, max + padding];
  }, [data]);

  const renderAreaChart = () => {
    const chartData = data as (TickData | CandleData)[];
    // For area chart on longer periods, use 'close' price from candles
    const dataKey = (chartData[0] && 'price' in chartData[0]) ? 'price' : 'close';

    return (
        <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
            dataKey="epoch"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            type="number"
            domain={getXAxisDomain()}
            allowDataOverflow={true}
            />
            <YAxis
            dataKey={dataKey}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
            allowDataOverflow
            width={80}
            />
            <Tooltip
                formatter={(value: number, name, props: any) => [`$${Number(value).toFixed(2)}`, "Preço"]}
                labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                animationDuration={200}
                position={{ y: 0 }}
            />
            <Line
            isAnimationActive={false}
            type="monotone"
            dataKey={dataKey}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            />
        </LineChart>
    );
  }

  const renderCandleChart = () => {
      return (
        <BarChart data={data as CandleData[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
                dataKey="epoch"
                tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                type="number"
                domain={getXAxisDomain()}
                allowDataOverflow={true}
            />
            <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                allowDataOverflow
                width={80}
            />
            <Tooltip
                 cursor={{fill: "hsl(var(--muted) / 0.5)"}}
                 content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                    const candle = payload[0].payload as CandleData;
                    return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                            <p className="font-bold mb-2">
                                {new Date(label * 1000).toLocaleString('pt-BR')}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <span className="text-muted-foreground">Abertura:</span>
                                <span className="font-bold text-right">${candle.open.toFixed(2)}</span>
                                <span className="text-muted-foreground">Máxima:</span>
                                <span className="font-bold text-right text-green-500">${candle.high.toFixed(2)}</span>
                                <span className="text-muted-foreground">Mínima:</span>
                                <span className="font-bold text-right text-red-500">${candle.low.toFixed(2)}</span>
                                <span className="text-muted-foreground">Fechamento:</span>
                                <span className="font-bold text-right">${candle.close.toFixed(2)}</span>
                            </div>
                        </div>
                    )
                    }
                    return null;
                }}
            />
            <Bar dataKey="close" shape={<CustomCandle />} barSize={5} />
        </BarChart>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">Carregando dados do gráfico em tempo real...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center text-center p-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }
  
  const isCandleView = chartType === 'Candle' && timePeriod !== '1m';

  return (
    <div className="h-[400px] w-full relative">
        {loading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <p className="text-muted-foreground">Atualizando gráfico...</p>
            </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
            {isCandleView ? renderCandleChart() : renderAreaChart()}
        </ResponsiveContainer>
    </div>
  );
}
