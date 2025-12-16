
"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TimePeriod } from "@/app/deriv-trader/page";

type ChartData = {
  epoch: number;
  price: number;
};

interface MarketChartProps {
  symbol: string;
  timePeriod: TimePeriod;
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

// Request slightly more data than needed for a smoother chart
const timePeriodToCount: Record<TimePeriod, number> = {
  '1m': 100,
  '15m': 1000,
  '30m': 2000,
  '1h': 4000,
  '8h': 5000, // Max for many symbols
  '1d': 5000, // Max for many symbols
};


export function MarketChart({ symbol, timePeriod }: MarketChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData([]);
    setLoading(true);
    setError(null);

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    const tickCount = timePeriodToCount[timePeriod];

    ws.onopen = () => {
      ws.send(JSON.stringify({
        "ticks_history": symbol,
        "adjust_start_time": 1,
        "count": tickCount,
        "end": "latest",
        "start": 1,
        "style": "ticks"
      }));
    };

    let historyLoaded = false;

    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);

      if (response.error) {
        console.error("Deriv API error:", response.error.message);
        setError(response.error.message);
        setLoading(false);
        ws.close();
        return;
      }
      
      if (response.msg_type === 'history' && response.history) {
        const historyData = response.history.times.map((time: number, index: number) => ({
          epoch: time,
          price: response.history.prices[index],
        }));
        setData(historyData);
        historyLoaded = true;
        setLoading(false);
        
        ws.send(JSON.stringify({
            "ticks": symbol,
            "subscribe": 1
        }));
      }

      if (response.msg_type === 'tick') {
        if (!historyLoaded) return;

        const tick = response.tick;
        const newTickData: ChartData = {
          epoch: tick.epoch,
          price: tick.quote,
        };
        
        setData(currentData => {
            const newData = [...currentData, newTickData];
            if (newData.length > tickCount + 100) { // Keep a slightly larger buffer
                return newData.slice(newData.length - (tickCount + 100));
            }
            return newData;
        });
      }
    };
    
    ws.onerror = (event) => {
        console.error("WebSocket connection error:", event);
        setError("Não foi possível conectar ao servidor de dados em tempo real. Verifique sua conexão com a internet ou a configuração do app_id.");
        setLoading(false);
    }

    ws.onclose = (event) => {
        console.log(`[Deriv WS] Connection closed: Code=${event.code}, Reason=${event.reason}`);
        if (!event.wasClean && !error) { // Don't show this error if we already have a specific error
            setError(`A conexão foi perdida inesperadamente (Código: ${event.code}). Por favor, atualize a página.`);
        }
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify({ "forget_all": "ticks" }));
         ws.close();
      }
    };

  }, [symbol, timePeriod]);
  
  const getDomain = () => {
    if (data.length < 2) return [0, 1];
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const periodInSeconds = timePeriodToSeconds[timePeriod];
    const dataMin = nowInSeconds - periodInSeconds;
    return [dataMin, 'dataMax'];
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
        <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="epoch"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(epoch: number) => {
                  const date = new Date(epoch * 1000);
                  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit'});
              }}
              type="number"
              domain={getDomain()}
              allowDataOverflow={true}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
            />
            <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Preço"]}
                labelFormatter={(epoch: number) => new Date(epoch * 1000).toLocaleString('pt-BR')}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                }}
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
