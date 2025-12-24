
'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  Line,
  Label,
  ReferenceDot,
} from 'recharts';
import { Loader2 } from "lucide-react";
import type { CandleData, ChartData, ActiveContract, TimePeriod, ChartType, TickData } from '@/hooks/use-market-data';

/* =========================================================
   UTIL — Domínio Y estável, robusto e profissional
========================================================= */
const getStableYDomain = (values: number[], padding = 0.06): [number, number] => {
  // Filtra apenas números válidos e positivos antes de calcular
  const validValues = values.filter(v => typeof v === 'number' && isFinite(v) && v > 0);
  
  if (validValues.length === 0) return ['auto', 'auto'] as any;

  if (validValues.every(v => v === validValues[0])) {
      const val = validValues[0];
      return [val * 0.999, val * 1.001]; // Cria um pequeno respiro artificial
  }
  
  if (validValues.length < 2) return ['auto', 'auto'] as any;

  const sorted = [...validValues].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.02)];
  const high = sorted[Math.floor(sorted.length * 0.98)];

  if (low === undefined || high === undefined) {
    return ['auto', 'auto'] as any;
  }

  const range = high - low || high * 0.01;

  return [
    Math.max(0, low - range * padding), // Garante que o gráfico não mostre negativo
    high + range * padding,
  ];
};


/* =====================================================
   CANVAS CANDLE LAYER — RESPONSIVO REAL
===================================================== */
function CanvasCandles({
  data,
  chartRef,
}: {
  data: CandleData[];
  chartRef: React.RefObject<any>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  const draw = React.useCallback(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !chart || !chart.state.offset || !chart.props.data) return;
    
    const { offset, xAxisMap, yAxisMap } = chart.state;
    const ctx = canvas.getContext('2d');
    if (!ctx || !xAxisMap || !yAxisMap) return;

    const { width, height } = offset;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const xScale = xAxisMap[0]?.scale;
    const yScale = yAxisMap[0]?.scale;

    if (!xScale || !yScale) return;
    
    const candleWidth = Math.max(3, (width / data.length) * 0.7);

    data.forEach(d => {
      const x = xScale(d.epoch);
      if (x === undefined || x < 0 || x > width) return;

      const openY = yScale(d.open);
      const closeY = yScale(d.close);
      const highY = yScale(d.high);
      const lowY = yScale(d.low);
      
      const bullish = d.close >= d.open;
      ctx.strokeStyle = bullish ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))';
      ctx.fillStyle = ctx.strokeStyle;

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(openY - closeY));

      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

  }, [data, chartRef]);

  React.useEffect(() => {
    draw();
  }, [draw]);
  
  // Re-draw on animation frame for smoothness during resizes
  React.useEffect(() => {
      let animationFrameId: number;
      const handleResize = () => {
          animationFrameId = requestAnimationFrame(draw);
      };
      
      const chart = chartRef.current;
      if (chart?.container) {
          const resizeObserver = new ResizeObserver(handleResize);
          resizeObserver.observe(chart.container);
          return () => resizeObserver.disconnect();
      }

      return () => cancelAnimationFrame(animationFrameId);
  }, [draw, chartRef]);


  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }} />;
}


/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
interface MarketChartProps {
  activeSymbol: string;
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
  activeSymbol,
  activeContracts,
  zoomLevel,
  chartData,
  isChartLoading,
  chartError,
  chartType,
  timePeriod,
  showBollingerBands,
}: MarketChartProps) {

  const chartRef = React.useRef<any>(null);

  const visibleData = React.useMemo(() => {
    if (!chartData) return [];

    // 1. FILTRAGEM DE DADOS SUJOS
    // Removemos qualquer dado onde o preço/close seja <= 0 ou inválido
    const cleanData = chartData.filter((d) => {
        const value = 'price' in d ? (d as TickData).price : (d as CandleData).close;
        return typeof value === 'number' && isFinite(value) && value > 0;
    });

    // 2. Lógica de Zoom
    if (cleanData.length > zoomLevel) {
        return cleanData.slice(cleanData.length - zoomLevel);
    }
    return cleanData;
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
      
  const chartKey = `${activeSymbol}-${chartType}-${timePeriod}`;

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
     TICKS (Área)
  ======================================================= */
  if (chartType === 'Area') {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div key={chartKey} className="h-[400px] w-full relative group">
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
              type="monotone"
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
     CANDLES (Canvas)
  ======================================================= */
  const candleData = visibleData as CandleData[];
  const yDomain = getStableYDomain(
    candleData.flatMap(d => [d.high, d.low, d.bollingerUpper, d.bollingerLower].filter(v => v !== undefined) as number[])
  );

  return (
    <div key={chartKey} className="h-[400px] w-full relative">
       <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candleData} ref={chartRef} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

                <XAxis
                    dataKey="epoch"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
                        <Area dataKey="bollingerUpper" stackId="bollinger" stroke="transparent" fill="hsl(var(--primary) / 0.1)" isAnimationActive={false} />
                        <Area dataKey="bollingerLower" stackId="bollinger" stroke="transparent" fill="hsl(var(--background))" isAnimationActive={false} />
                    </>
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
                    ifOverflow="visible"
                  />
                ))}

                {latestPrice && (
                    <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4" ifOverflow="visible">
                        <Label value={priceFormatter(latestPrice)} position="right" fill="hsl(var(--primary))" fontSize={12} />
                    </ReferenceLine>
                )}
            </ComposedChart>
        </ResponsiveContainer>
        <CanvasCandles data={candleData} chartRef={chartRef} />
    </div>
  );
}
