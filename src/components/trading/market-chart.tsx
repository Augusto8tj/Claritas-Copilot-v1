
"use client";

import * as React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Label } from "recharts";
import type { TimePeriod, ChartType } from "@/app/deriv-trader/page";
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

export type ActiveContract = {
  contractId: number;
  entryTick: number;
  entryTime: number;
  status: 'open' | 'won' | 'lost';
};

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


export function MarketChart({ symbol, timePeriod, chartType, activeContracts }: MarketChartProps) {
  const [data, setData] = useState<TickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(getHistoryDurationForTimePeriod(timePeriod));
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = useCallback((currentDuration: number) => {
    if (!symbol || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    setLoading(true);
    setError(null);
    
    // Unsubscribe from previous streams to avoid multiple streams
    wsRef.current.send(JSON.stringify({ "forget_all": "ticks" }));
    wsRef.current.send(JSON.stringify({ "forget_all": "candles" }));

    wsRef.current.send(
      JSON.stringify({
        ticks_history: symbol,
        start: Math.floor(Date.now() / 1000) - currentDuration,
        end: "latest",
        style: chartType === 'Area' ? 'ticks' : 'candles',
        adjust_start_time: 1,
        count: 5000,
      })
    );
  }, [symbol, chartType]);

  // Effect for WebSocket connection management
  useEffect(() => {
    if (!symbol) return;

    wsRef.current = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);

    wsRef.current.onopen = () => {
      console.log("[Deriv WS] Conexão estabelecida.");
      fetchData(duration);
    };

    wsRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);

      if (response.error) {
        console.error("Deriv API error:", response.error.message);
        setError(response.error.message);
        setLoading(false);
        return;
      }
      
      if (response.msg_type === 'history') {
        const historyData: TickData[] = response.history.times.map((time: number, index: number) => ({
          epoch: time,
          price: response.history.prices[index],
        }));
        setData(historyData);
        setLoading(false);
        // Subscribe to live ticks only if we are in the '1m' view
        if (timePeriod === '1m' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ "ticks": symbol, "subscribe": 1 }));
        }
      } else if (response.msg_type === 'candles') {
          const candleData: CandleData[] = response.candles.map((candle: any) => ({
                epoch: candle.epoch,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }));
          setData(candleData as any);
          setLoading(false);
      }


      if (response.msg_type === 'tick') {
        const tick = response.tick;
        const newTickData: TickData = { epoch: tick.epoch, price: tick.quote };
        setData(currentData => {
            // Add new tick and remove the oldest one to keep the window size
            const newData = [...currentData.slice(1), newTickData];
            return newData;
        });
      }
    };
    
    wsRef.current.onerror = (event) => {
        // This can sometimes fire with an empty event object in React's strict mode
        // due to the rapid connect/disconnect cycle. We only log/set an error if
        // there's a meaningful error message.
        if (event && 'message' in event) {
            console.error("WebSocket connection error:", event);
            setError("Não foi possível conectar ao servidor de dados em tempo real.");
            setLoading(false);
        }
    }

    wsRef.current.onclose = () => {
        console.log("[Deriv WS] A conexão foi fechada.");
    }

    // Cleanup function
    return () => {
      if (wsRef.current) {
         try {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ "forget_all": "ticks" }));
                 wsRef.current.send(JSON.stringify({ "forget_all": "candles" }));
            }
            wsRef.current.close();
            console.log("[Deriv WS] Conexão limpa e fechada.");
         } catch (e) {
            console.warn("[Deriv WS] WebSocket já fechado ou com erro na limpeza.");
         }
      }
    };
  }, [symbol, duration, fetchData, timePeriod]);


  // Effect for handling changes in timePeriod
  useEffect(() => {
    setDuration(getHistoryDurationForTimePeriod(timePeriod));
  }, [timePeriod]);
  
  const handleZoom = (factor: number) => {
    setDuration(currentDuration => {
      const newDuration = Math.round(currentDuration * factor);
      const minDuration = 60; // 1 minute
      const maxDuration = 90 * 24 * 60 * 60; // 90 days
      
      if (newDuration < minDuration) return minDuration;
      if (newDuration > maxDuration) return maxDuration;
      
      return newDuration;
    });
  };


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
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
            domain={['dataMin - 0.01', 'dataMax + 0.01']}
            tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
            allowDataOverflow
            width={80}
          />
          <Tooltip
            formatter={(value: number, name, props: any) => [`$${Number(value).toFixed(2)}`, "Preço"]}
            labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
            animationDuration={0} // Disable animation for smoother live updates
          />
          <Line
            isAnimationActive={false} // Important for performance with live data
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
           {activeContracts.map(contract => (
            <ReferenceLine
              key={contract.contractId}
              y={contract.entryTick}
              stroke="hsl(var(--accent))"
              strokeDasharray="3 3"
              strokeWidth={2}
            >
              <Label 
                value={`Entrada: ${contract.entryTick.toFixed(2)}`}
                position="right"
                style={{ fill: 'hsl(var(--accent-foreground))', fontSize: 12, background: 'hsl(var(--accent))', padding: '2px 4px', borderRadius: '3px' }} 
              />
            </ReferenceLine>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
