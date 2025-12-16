
"use client";

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

const timePeriodToSeconds: Record<TimePeriod, number> = {
  '1m': 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '8h': 8 * 60 * 60,
  '1d': 24 * 60 * 60,
};

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    const seconds = timePeriodToSeconds[timePeriod];
    if (seconds <= 30 * 60) return 60; // 1-minute candles for 30m or less
    if (seconds <= 8 * 3600) return 300; // 5-minute candles for 8h or less
    return 3600; // 1-hour candles for 1d
}


function CustomCandle({ x, y, width, height, low, high, open, close }: any) {
  const isBullish = close >= open;
  const color = isBullish ? "hsl(var(--primary))" : "hsl(var(--destructive))";
  const bodyHeight = Math.abs(open - close);
  const bodyY = isBullish ? y + (high - close) : y + (high - open);

  return (
    <g>
      {/* Wick */}
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth="1" />
      {/* Body */}
      <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={color} />
    </g>
  );
};


export function MarketChart({ symbol, timePeriod, chartType }: MarketChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setData([]);
    setLoading(true);
    setError(null);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;

    ws.onopen = () => {
        const request = chartType === 'Area' ? {
            "ticks_history": symbol,
            "end": "latest",
            "start": Math.floor(Date.now() / 1000) - timePeriodToSeconds[timePeriod],
            "style": "ticks",
            "count": 5000,
        } : {
            "ticks_history": symbol,
            "end": "latest",
            "start": Math.floor(Date.now() / 1000) - timePeriodToSeconds[timePeriod],
            "style": "candles",
            "granularity": getGranularityForTimePeriod(timePeriod),
        };
        ws.send(JSON.stringify(request));
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
        }));
      }
      
      if (initialData.length > 0) {
        setData(initialData);
        setLoading(false);
        // Subscription is not straightforward for candles, so we will rely on re-fetching for now.
        // For ticks, we subscribe.
        if (chartType === 'Area') {
            ws.send(JSON.stringify({ "ticks": symbol, "subscribe": 1 }));
        }
      }

      if (response.msg_type === 'tick' && chartType === 'Area') {
        const tick = response.tick;
        const newTickData: TickData = { epoch: tick.epoch, price: tick.quote };
        setData(currentData => [...currentData, newTickData]);
      }
    };
    
    ws.onerror = (event) => {
        console.error("WebSocket connection error:", event);
        setError("Não foi possível conectar ao servidor de dados em tempo real. Verifique sua conexão com a internet ou a configuração do app_id.");
        setLoading(false);
    }

    ws.onclose = (event) => {
        console.log(`[Deriv WS] Connection closed: Code=${event.code}, Reason=${event.reason.toString()}`);
        if (!event.wasClean && !error) {
            setError(`A conexão foi perdida inesperadamente (Código: ${event.code}). Por favor, atualize a página.`);
        }
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
         wsRef.current.send(JSON.stringify({ "forget_all": "ticks" }));
         wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [symbol, timePeriod, chartType]);
  
  const getDomain = () => {
    if (data.length < 2) return ['dataMin', 'dataMax'];
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const periodInSeconds = timePeriodToSeconds[timePeriod];
    const dataMin = nowInSeconds - periodInSeconds;
    return [dataMin, nowInSeconds];
  }


  if (loading) {
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

  return (
    <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
        { chartType === 'Area' ? (
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                dataKey="epoch"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                type="number"
                domain={getDomain()}
                allowDataOverflow={true}
                />
                <YAxis
                dataKey="price"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 1', 'dataMax + 1']}
                tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                allowDataOverflow
                width={60}
                />
                <Tooltip
                    formatter={(value: number, name, props: any) => [`$${(props.payload as TickData).price.toFixed(2)}`, "Preço"]}
                    labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    animationDuration={200}
                    position={{ y: 0 }}
                />
                <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                />
            </LineChart>
        ) : (
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                    dataKey="epoch"
                    tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                    width={60}
                />
                <Tooltip
                     cursor={{fill: "hsl(var(--muted))"}}
                     content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                        const candle = payload[0].payload as CandleData;
                        return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Data
                                    </span>
                                    <span className="font-bold text-muted-foreground">
                                        {new Date(label * 1000).toLocaleString('pt-BR')}
                                    </span>
                                    </div>
                                    <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Abertura
                                    </span>
                                    <span className="font-bold text-green-500">
                                        ${candle.open.toFixed(2)}
                                    </span>
                                    </div>
                                    <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Máxima
                                    </span>
                                    <span className="font-bold text-green-500">
                                        ${candle.high.toFixed(2)}
                                    </span>
                                    </div>
                                    <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Mínima
                                    </span>
                                    <span className="font-bold text-red-500">
                                        ${candle.low.toFixed(2)}
                                    </span>
                                    </div>
                                    <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Fechamento
                                    </span>
                                    <span className="font-bold text-red-500">
                                        ${candle.close.toFixed(2)}
                                    </span>
                                    </div>
                                </div>
                            </div>
                        )
                        }
                        return null;
                    }}
                />
                <Bar dataKey="close" shape={<CustomCandle />} />
            </BarChart>
        )}
        </ResponsiveContainer>
    </div>
  );
}
