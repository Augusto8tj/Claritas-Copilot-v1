
"use client";

import * as React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Label, BarChart, Bar } from "recharts";
import type { TimePeriod, ChartType } from "@/app/deriv-trader/page";
import { useDerivApi, type ActiveContract } from "@/hooks/use-deriv-api";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Loader2 } from "lucide-react";

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
  activeContracts: ActiveContract[];
}

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";

const getHistoryDurationForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 60; // 1 minute of data for the live chart
        case '15m': return 15 * 60; 
        case '30m': return 30 * 60; 
        case '1h': return 60 * 60;
        case '8h': return 8 * 60 * 60;
        case '1d': return 24 * 60 * 60;
        default: return 60;
    }
}

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '15m': return 60; // 1-minute candles
        case '30m': return 120; // 2-minute candles
        case '1h': return 300; // 5-minute candles
        case '8h': return 1800; // 30-minute candles
        case '1d': return 3600; // 1-hour candles
        default: return 0; // default for ticks
    }
}


const Candlestick = (props: any) => {
    const { x, y, width, height, payload } = props;
    
    if ([x, y, width, height].some(val => val === undefined || isNaN(val)) || !payload) {
        return null; // Don't render if any value is invalid
    }
    
    const { open, close } = payload;
     if ([open, close].some(val => val === undefined || isNaN(val))) {
        return null;
    }

    const isBullish = close > open;
    const color = isBullish ? 'hsl(142.1 76.2% 41.2%)' : 'hsl(0 84.2% 60.2%)';

    const bodyY = isBullish ? y + (height * (payload.high - close) / (payload.high - payload.low)) : y + (height * (payload.high - open) / (payload.high - payload.low));
    const bodyHeight = Math.abs((height * (open - close)) / (payload.high - payload.low));

    return (
        <g>
            <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth="1" />
            <rect x={x} y={bodyY} width={width} height={Math.max(bodyHeight, 1)} fill={color} />
        </g>
    );
};


export function MarketChart({ symbol, timePeriod, chartType, activeContracts }: MarketChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(getHistoryDurationForTimePeriod(timePeriod));
  const { ws: wsFromContext, priceTicks, addPriceTick } = useDerivApi();
  const wsRef = useRef<WebSocket | null>(null);
  const currentSymbolRef = useRef<string | null>(null);

  useEffect(() => {
    // Only use the ticks from the context for the live area chart
    if (chartType === 'Area') {
        const tickData = priceTicks.map(tick => ({ epoch: tick.epoch, price: tick.price }));
        setData(tickData);
    }
  }, [priceTicks, chartType]);


  const fetchData = useCallback(() => {
    if (!symbol || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    // Only fetch historical data for candle charts, as ticks are now streamed from context
    if (chartType === 'Area') {
        setLoading(false);
        setError(null);
        return;
    }

    setData([]); 
    setLoading(true);
    setError(null);
    
    wsRef.current.send(JSON.stringify({ "forget_all": "candles" }));

    const granularity = getGranularityForTimePeriod(timePeriod);
    const request = {
        ticks_history: symbol,
        start: Math.floor(Date.now() / 1000) - duration,
        end: "latest",
        style: 'candles',
        granularity: granularity,
        adjust_start_time: 1,
        count: 5000,
    };

    wsRef.current.send(JSON.stringify(request));

  }, [symbol, chartType, timePeriod, duration]);

  useEffect(() => {
    // Use the WebSocket instance from context if available
    if (wsFromContext && wsFromContext.readyState === WebSocket.OPEN) {
        wsRef.current = wsFromContext;
    } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        // This fallback might be less common now with the central provider
        wsRef.current = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    }

    const ws = wsRef.current;
    
    const forgetPreviousSubscription = () => {
        if (ws.readyState === WebSocket.OPEN && currentSymbolRef.current) {
            ws.send(JSON.stringify({ "forget_all": "ticks" }));
        }
    };

    const subscribeToSymbol = () => {
         if (ws.readyState === WebSocket.OPEN && symbol !== currentSymbolRef.current) {
            forgetPreviousSubscription();
            console.log(`[MarketChart] Subscribing to ${symbol}`);
            ws.send(JSON.stringify({ "ticks": symbol, "subscribe": 1 }));
            currentSymbolRef.current = symbol;
            fetchData();
        } else if (ws.readyState === WebSocket.OPEN) {
            fetchData();
        }
    }

    const handleOpen = () => {
      console.log("[MarketChart] WS Connection is open.");
      subscribeToSymbol();
    };
    
    const handleMessage = (event: MessageEvent) => {
       const response = JSON.parse(event.data);

      if (response.error) {
        if (response.error.code !== 'AlreadySubscribed') {
            console.error("Deriv API error (MarketChart):", response.error.message);
            setError(response.error.message);
        }
        setLoading(false);
        return;
      }
      
      if (response.msg_type === 'candles') {
          const candleData: CandleData[] = response.candles.map((candle: any) => ({
                epoch: candle.epoch,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }));
          setData(candleData);
          setLoading(false);
      }
    }
    
    const handleError = (event: Event) => {
        if ('message' in event) {
            console.error("WebSocket connection error:", event);
            setError("Não foi possível conectar ao servidor de dados em tempo real.");
            setLoading(false);
        }
    }

    if (ws.readyState === WebSocket.OPEN) {
        handleOpen();
    } else {
        ws.addEventListener('open', handleOpen);
    }
    
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('error', handleError);


    return () => {
       ws.removeEventListener('open', handleOpen);
       ws.removeEventListener('message', handleMessage);
       ws.removeEventListener('error', handleError);
       // We don't close the websocket as it's managed by the provider
    };
  }, [symbol, duration, fetchData, wsFromContext]);


  useEffect(() => {
    setDuration(getHistoryDurationForTimePeriod(timePeriod));
    // When time period changes, we might need to refetch candle data
    if (chartType === 'Candle') {
        fetchData();
    }
  }, [timePeriod, chartType, fetchData]);
  
  const handleZoom = (factor: number) => {
    setDuration(currentDuration => {
      const newDuration = Math.round(currentDuration * factor);
      const minDuration = 60;
      const maxDuration = 90 * 24 * 60 * 60;
      
      if (newDuration < minDuration) return minDuration;
      if (newDuration > maxDuration) return maxDuration;
      
      return newDuration;
    });
  };

  const renderChart = () => {
     if (chartType === 'Candle' && data.length > 0 && 'open' in data[0]) {
        const candleData = data as CandleData[];
        const yDomain = [
            Math.min(...candleData.map(d => d.low)) * 0.999,
            Math.max(...candleData.map(d => d.high)) * 1.001,
        ];
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
                        (typeof contract.entryTick === 'number') && (
                        <ReferenceLine
                        key={contract.contractId}
                        y={contract.entryTick}
                        stroke="hsl(var(--accent))"
                        strokeDasharray="3 3"
                        strokeWidth={2}
                        >
                        <Label 
                            value={`Entrada: ${contract.entryTick.toFixed(4)}`}
                            position="right"
                            fill="hsl(var(--accent))"
                            fontSize={12}
                            className="font-semibold"
                        />
                        </ReferenceLine>
                        )
                    ))}
                </BarChart>
            </ResponsiveContainer>
        );
     }
     
     // Default to Line Chart
     return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data as TickData[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                    dataKey="epoch"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleTimeString('pt-BR')}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    allowDataOverflow={true}
                />
                <YAxis
                    dataKey="price"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 0.0005', 'dataMax + 0.0005']}
                    tickFormatter={(value) => Number(value).toFixed(4)}
                    allowDataOverflow
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
                    (typeof contract.entryTick === 'number') && (
                    <ReferenceLine
                        key={contract.contractId}
                        y={contract.entryTick}
                        stroke="hsl(var(--accent))"
                        strokeDasharray="3 3"
                        strokeWidth={2}
                    >
                        <Label 
                            value={`Entrada: ${contract.entryTick.toFixed(4)}`}
                            position="right"
                            fill="hsl(var(--accent))"
                            fontSize={12}
                            className="font-semibold"
                        />
                    </ReferenceLine>
                    )
                ))}
            </LineChart>
        </ResponsiveContainer>
     )
  }

  if (loading && data.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-3">Carregando dados do gráfico...</p>
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
    <div className="h-[400px] w-full relative group">
       <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleZoom(1.5)}>
          <Minus className="h-4 w-4" />
          <span className="sr-only">Reduzir zoom</span>
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleZoom(0.5)}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">Ampliar zoom</span>
        </Button>
      </div>
      {renderChart()}
    </div>
  );
}
