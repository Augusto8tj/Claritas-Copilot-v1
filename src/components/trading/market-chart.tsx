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
  const validValues = values
    .map(Number)
    .filter(v => !isNaN(v) && isFinite(v) && v > 0);
  
  if (validValues.length === 0) return ['auto', 'auto'] as any;

  if (validValues.every(v => v === validValues[0])) {
      const val = validValues[0];
      return [val * 0.999, val * 1.001];
  }
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || (max * 0.01);

  return [
    Math.max(0, min - range * padding),
    max + range * padding,
  ];
};

/* =====================================================
   CANVAS CANDLE LAYER — MODERN & PRO
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
    
    if (width <= 0 || height <= 0) return;

    // Configura canvas para alta resolução (Retina display ready)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const xScale = xAxisMap[0]?.scale;
    const yScale = yAxisMap[0]?.scale;

    if (!xScale || !yScale) return;

    // --- 1. RESOLUÇÃO DE CORES DO TEMA ---
    // Pega as cores exatas do CSS (Tailwind/Shadcn variables)
    const computedStyle = getComputedStyle(document.documentElement);
    
    // Cor de ALTA (Bullish) - Geralmente Verde ou Laranja (no seu caso --chart-2)
    const rawBullish = computedStyle.getPropertyValue('--chart-2').trim() || '142 76% 36%'; 
    const colorBullish = rawBullish.startsWith('hsl') ? rawBullish : `hsl(${rawBullish})`;

    // Cor de BAIXA (Bearish) - Vermelho (--destructive)
    const rawBearish = computedStyle.getPropertyValue('--destructive').trim() || '0 84% 60%';
    const colorBearish = rawBearish.startsWith('hsl') ? rawBearish : `hsl(${rawBearish})`;

    // --- 2. CÁLCULO DE LARGURA DINÂMICA ---
    // Calcula a largura da barra baseada no zoom.
    // Deixa 20% de espaço (gap) entre as velas para visual limpo
    const availableWidth = width / data.length;
    const gap = Math.max(1, availableWidth * 0.2); 
    const barWidth = Math.max(2, availableWidth - gap);
    const halfBarWidth = barWidth / 2;

    data.forEach(d => {
      if (!d.open || !d.close || d.open <= 0) return;

      const x = xScale(d.epoch);
      if (x === undefined || x < 0 || x > width) return;

      const openY = yScale(d.open);
      const closeY = yScale(d.close);
      const highY = yScale(d.high);
      const lowY = yScale(d.low);
      
      const isBullish = d.close >= d.open;
      
      // Define a cor
      const color = isBullish ? colorBullish : colorBearish;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      // --- 3. DESENHO DO PAVIO (WICK) ---
      // Linha fina centralizada
      ctx.lineWidth = 1; 
      ctx.beginPath();
      // O '+ 0.5' ajuda a alinhar pixels para evitar blur em telas normais
      const xPixel = Math.floor(x) + 0.5; 
      ctx.moveTo(xPixel, Math.floor(highY));
      ctx.lineTo(xPixel, Math.floor(lowY));
      ctx.stroke();

      // --- 4. DESENHO DO CORPO (BODY) ---
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(openY - closeY));
      
      // Preenche o corpo
      ctx.fillRect(
          Math.floor(x - halfBarWidth), 
          Math.floor(bodyTop), 
          Math.floor(barWidth), 
          Math.floor(bodyHeight)
      );
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

  // Filtra dados para evitar sujeira
  const visibleData = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

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

  // CHAVE MESTRA: Reseta o gráfico na troca de ativo
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

  if (visibleData.length === 0) {
     return <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground">Aguardando dados...</div>;
  }

  /* =======================================================
     TICKS (Área / Line) - Mantido igual, foco nas candles abaixo
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
              allowDataOverflow={false}
            />
            <Tooltip
              labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
              formatter={(value: number) => [priceFormatter(value), "Preço"]}
              contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
              isAnimationActive={false}
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
              <ReferenceLine y={latestPrice} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
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
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* =======================================================
     CANDLES (Canvas) - AGORA COM DESIGN MODERNO
  ======================================================= */
  const candleData = visibleData as CandleData[];
  const allValues = candleData.flatMap(d => [d.high, d.low, d.bollingerUpper, d.bollingerLower]);
  const yDomain = getStableYDomain(allValues.filter(v => v !== undefined) as number[]);

  return (
    <div key={componentKey} className="h-[400px] w-full relative">
       {/* 
           Usamos ComposedChart apenas para desenhar eixos, grid e tooltips.
           Não passamos 'Line' ou 'Bar' aqui dentro, o desenho é todo no CanvasCandles
       */}
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
                    cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
                />

                {showBollingerBands && (
                    <>
                        <Area dataKey="bollingerUpper" stackId="bollinger" stroke="none" fill="hsl(var(--primary) / 0.05)" isAnimationActive={false} />
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
        
        {/* Camada de Canvas desenha as velas com as cores corretas e nitidez */}
        <CanvasCandles data={candleData} chartRef={chartRef} />
    </div>
  );
}