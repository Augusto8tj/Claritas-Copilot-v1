
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
   UTIL — Domínio Y estável
========================================================= */
const getStableYDomain = (values: number[], padding = 0.1): [number, number] => {
  // Filtra lixo e zeros antes de calcular
  const validValues = values
    .map(Number) // Garante que é número
    .filter(v => !isNaN(v) && isFinite(v) && v > 0);
  
  if (validValues.length === 0) return ['auto', 'auto'] as any;

  // Se for uma linha reta (todos valores iguais)
  if (validValues.every(v => v === validValues[0])) {
      const val = validValues[0];
      return [val * 0.999, val * 1.001];
  }
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || (max * 0.01);

  return [
    Math.max(0, min - range * padding), // Garante chão em 0
    max + range * padding,
  ];
};

/* =====================================================
   CANVAS CANDLE LAYER
===================================================== */
function CanvasCandles({ data, chartRef }: { data: CandleData[]; chartRef: React.RefObject<any>; }) {
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
    
    // Evita redesenhar se as dimensões forem inválidas
    if (width <= 0 || height <= 0) return;

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
      // Proteção extra contra dados inválidos no Canvas
      if (!d.open || !d.close || d.open <= 0) return;

      const x = xScale(d.epoch);
      if (x === undefined || x < 0 || x > width) return;

      const openY = yScale(d.open);
      const closeY = yScale(d.close);
      const highY = yScale(d.high);
      const lowY = yScale(d.low);
      
      const bullish = d.close >= d.open;
      ctx.strokeStyle = bullish ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))';
      ctx.fillStyle = ctx.strokeStyle;

      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(openY - closeY));

      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

  }, [data, chartRef]);

  React.useEffect(() => { draw(); }, [draw]);
  
  React.useEffect(() => {
      let animationFrameId: number;
      const handleResize = () => { animationFrameId = requestAnimationFrame(draw); };
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

  // 1. DATA CLEANING & MEMOIZATION
  const visibleData = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    // Filtra dados inválidos, zeros, strings vazias
    const clean = chartData.filter((d) => {
        const val = 'price' in d ? (d as TickData).price : (d as CandleData).close;
        const num = Number(val);
        return !isNaN(num) && isFinite(num) && num > 0;
    });

    if (clean.length > zoomLevel) {
        return clean.slice(clean.length - zoomLevel);
    }
    return clean;
  }, [chartData, zoomLevel]);

  const priceFormatter = (v: number) => {
    if (!v || isNaN(v)) return "";
    if (v > 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v < 10) return v.toFixed(4);
    return v.toFixed(2);
  };

  const latestPrice = React.useMemo(() => {
    if (visibleData.length === 0) return null;
    const last = visibleData[visibleData.length - 1];
    return 'price' in last ? (last as TickData).price : (last as CandleData).close;
  }, [visibleData]);

  // CHAVE MESTRA: Força o React a recriar o componente se o ativo ou tipo mudar
  // Isso resolve o problema do "gráfico não se adapta aos novos valores"
  const componentKey = `${activeSymbol}-${chartType}-${timePeriod}`;

  if (isChartLoading && visibleData.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-3">Carregando dados...</p>
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

  // Se não tem dados válidos após o filtro, não tenta renderizar o gráfico
  if (visibleData.length === 0) {
     return <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground">Aguardando dados...</div>;
  }

  /* =======================================================
     TICKS (Área / Line)
  ======================================================= */
  if (chartType === 'Area') {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div key={componentKey} className="h-[400px] w-full relative group">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ right: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

            <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR')}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />

            <YAxis
              domain={yDomain}
              tickFormatter={priceFormatter}
              orientation="right"
              width={60}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDataOverflow={false} // Importante para não cortar dados válidos
            />

            <Tooltip
              labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
              formatter={(value: number) => [priceFormatter(value), "Preço"]}
              contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
              isAnimationActive={false} // Desativa animação do tooltip para performance
            />

            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false} // Remove a animação de "crescimento" que causa o bug na troca de ativo
            />

            {latestPrice && (
              <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
            )}
            
            {activeContracts.map(contract => (
              // Proteção: Só desenha o ponto se entryTick for válido e > 0
              contract.entryTick > 0 && (
                <ReferenceDot
                    key={contract.contractId}
                    x={contract.entryTime}
                    y={contract.entryTick}
                    r={4}
                    fill="hsl(var(--accent))"
                    stroke="white"
                    strokeWidth={2}
                />
              )
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
  const allValues = candleData.flatMap(d => [d.high, d.low, d.bollingerUpper, d.bollingerLower]);
  const yDomain = getStableYDomain(allValues.filter(v => v !== undefined) as number[]);

  return (
    <div key={componentKey} className="h-[400px] w-full relative">
       <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candleData} ref={chartRef} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

                <XAxis
                    dataKey="epoch"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                />

                <YAxis
                    domain={yDomain}
                    tickFormatter={priceFormatter}
                    orientation="right"
                    width={60}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                />

                <Tooltip
                    labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                    isAnimationActive={false}
                />

                {showBollingerBands && (
                    <>
                        <Area dataKey="bollingerUpper" stackId="bollinger" stroke="none" fill="hsl(var(--primary) / 0.1)" isAnimationActive={false} />
                        <Area dataKey="bollingerLower" stackId="bollinger" stroke="none" fill="hsl(var(--background))" isAnimationActive={false} />
                    </>
                )}

                {activeContracts.map(contract => (
                  contract.entryTick > 0 && (
                    <ReferenceDot
                        key={contract.contractId}
                        x={contract.entryTime}
                        y={contract.entryTick}
                        r={4}
                        fill="hsl(var(--accent))"
                        stroke="white"
                        strokeWidth={2}
                        ifOverflow="visible"
                    />
                  )
                ))}

                {latestPrice && (
                    <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4" ifOverflow="visible">
                         <Label value={priceFormatter(latestPrice)} position="insideRight" fill="hsl(var(--primary))" fontSize={11} />
                    </ReferenceLine>
                )}
            </ComposedChart>
        </ResponsiveContainer>
        <CanvasCandles data={candleData} chartRef={chartRef} />
    </div>
  );
}
