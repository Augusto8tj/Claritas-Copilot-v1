
"use client";

import * as React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TimePeriod, ChartType } from "@/app/deriv-trader/page";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

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


export function MarketChart({ symbol, timePeriod, chartType }: MarketChartProps) {
  const [data, setData] = useState<TickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(getHistoryDurationForTimePeriod(timePeriod));
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = useCallback((currentDuration: number) => {
    if (!symbol) {
      setLoading(false);
      setError("Nenhum ativo selecionado.");
      return;
    }
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[Deriv WS] WebSocket não está pronto. A requisição será adiada.");
      // Optional: Add a retry mechanism here
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);

    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - currentDuration;

    wsRef.current.send(
      JSON.stringify({
        ticks_history: symbol,
        start: startTime,
        end: "latest",
        style: "ticks",
        adjust_start_time: 1,
        count: 5000
      })
    );
  }, [symbol]);

  // Effect for WebSocket connection management
  useEffect(() => {
    if (!symbol) return;

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Deriv WS] Conexão estabelecida.");
      // Trigger initial data fetch once connected
      fetchData(duration);
    };

    ws.onmessage = (event) => {
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
        if (timePeriod === '1m') {
            ws.send(JSON.stringify({ "ticks": symbol, "subscribe": 1 }));
        }
      }

      if (response.msg_type === 'tick') {
        const tick = response.tick;
        const newTickData: TickData = { epoch: tick.epoch, price: tick.quote };
        setData(currentData => {
            const newData = [...currentData, newTickData];
            // Mantém a janela de dados rolando, removendo o ponto mais antigo
            if (newData.length > 1000) { // Limita o número de pontos no gráfico para performance
                return newData.slice(1);
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
        console.log(`[Deriv WS] A conexão foi fechada (Código: ${event.code}).`);
        if (!event.wasClean && !error) {
           console.warn(`[Deriv WS] A conexão foi perdida inesperadamente.`);
        }
    }

    // Cleanup function
    return () => {
      if (wsRef.current) {
         try {
            // Unsubscribe from all ticks before closing
            wsRef.current.send(JSON.stringify({ "forget_all": "ticks" }));
            wsRef.current.close();
            console.log("[Deriv WS] Conexão limpa e fechada.");
         } catch (e) {
            console.warn("[Deriv WS] WebSocket já fechado ou com erro na limpeza.");
         }
         wsRef.current = null;
      }
    };
    // This effect should only re-run when the symbol changes, managing the entire lifecycle.
  }, [symbol]);

  // Effect for handling changes in duration (from zoom or timePeriod)
  useEffect(() => {
    // Don't fetch if the symbol isn't set, the connection effect will handle the initial fetch
    if (!symbol || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    fetchData(duration);
  }, [duration, fetchData, symbol]);

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
        <p className="text-muted-foreground">Carregando dados do gráfico...</p>
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
            domain={['dataMin', 'dataMax']}
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
      </ResponsiveContainer>
    </div>
  );
}
