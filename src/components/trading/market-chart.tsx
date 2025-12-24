'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  Line,
  Label,
  ReferenceDot,
  LineChart
} from 'recharts';
import { Loader2 } from "lucide-react";
import type { CandleData, ChartData, ActiveContract, TimePeriod, ChartType, TickData } from '@/hooks/use-market-data';

/* =========================================================
   1. UTILITÁRIOS E CONFIGURAÇÕES DE COR
========================================================= */

// Cores Padrão da Indústria (TradingView Style)
const COLORS = {
  BULLISH: '#26a69a', // Verde Profissional
  BEARISH: '#ef5350', // Vermelho Profissional
  WICK: '#000000',    // (Opcional) Se quiser pavios pretos, mas usaremos a cor da vela
  TEXT: '#333333',
  GRID: '#e0e0e0',
};

const getStableYDomain = (values: number[], padding = 0.15): [number, number] => {
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

  // Um padding um pouco maior (0.15) ajuda a vela não colar no topo/fundo
  return [
    Math.max(0, min - range * padding),
    max + range * padding,
  ];
};

/* =====================================================
   2. CANVAS CANDLE LAYER (MOTOR GRÁFICO OTIMIZADO)
===================================================== */
function CanvasCandles({ data, chartRef }: { data: CandleData[]; chartRef: React.RefObject<any>; }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  const draw = React.useCallback(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    
    // Verificações de segurança
    if (!canvas || !chart || !chart.state || !chart.state.offset || !data) return;
    
    const { offset, xAxisMap, yAxisMap } = chart.state;
    // Se o gráfico ainda não calculou as escalas, aborta
    if (!xAxisMap || !yAxisMap || !xAxisMap[0] || !yAxisMap[0]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = offset;
    const dpr = window.devicePixelRatio || 1;
    
    // Se dimensão inválida, aborta
    if (width <= 0 || height <= 0) return;

    // Configura High-DPI (Retina)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    // Limpa tela anterior
    ctx.clearRect(0, 0, width, height);

    const xScale = xAxisMap[0].scale;
    const yScale = yAxisMap[0].scale;

    // Cálculo da largura da vela
    // Subtrai um "gap" fixo de 20% ou mínimo de 1px
    const dataLength = data.length;
    const slotWidth = width / dataLength;
    const gap = Math.max(1, slotWidth * 0.3); 
    const barWidth = Math.max(1, slotWidth - gap);
    
    // Otimização: pré-define largura da linha
    ctx.lineWidth = 1;

    data.forEach((d) => {
        // Ignora dados inválidos
        if (!d.open || !d.close) return;

        const x = xScale(d.epoch);
        // Se x estiver fora da tela, pula
        if (x === undefined || x < -barWidth || x > width + barWidth) return;

        // Coordenadas Y
        const openY = Math.floor(yScale(d.open));
        const closeY = Math.floor(yScale(d.close));
        const highY = Math.floor(yScale(d.high));
        const lowY = Math.floor(yScale(d.low));

        // Define cor e direção
        const isBullish = d.close >= d.open;
        const color = isBullish ? COLORS.BULLISH : COLORS.BEARISH;
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        // Centraliza perfeitamente no slot do eixo X
        // Math.floor + 0.5 garante linhas nítidas (crisp edges) no Canvas
        const centerX = Math.floor(x) + 0.5;

        // 1. DESENHAR PAVIO (WICK)
        // Linha única do High ao Low passando pelo centro
        ctx.beginPath();
        ctx.moveTo(centerX, highY);
        ctx.lineTo(centerX, lowY);
        ctx.stroke();

        // 2. DESENHAR CORPO (BODY)
        // O corpo deve cobrir o pavio na parte central
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(openY - closeY)); // Mínimo 1px para Dojis
        
        const bodyLeft = Math.floor(x - (barWidth / 2));
        
        ctx.fillRect(bodyLeft, bodyTop, Math.floor(barWidth), bodyHeight);
    });

  }, [data, chartRef]);

  // Redesenha sempre que os dados ou o resize mudarem
  React.useEffect(() => { draw(); }, [draw]);
  
  // Sincroniza com animações de resize do navegador
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

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }} />;
}

/* =========================================================
   3. COMPONENTE PRINCIPAL
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

  // Filtro de Dados
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

  const componentKey = `${activeSymbol}-${chartType}-${timePeriod}`;

  if (isChartLoading && visibleData.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-3">A carregar gráfico...</p>
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

  /* --------------------------------------------------------
     MODO TICKS (Linha)
  -------------------------------------------------------- */
  if (chartType === 'Area') {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div key={componentKey} className="h-[400px] w-full relative group bg-white dark:bg-neutral-950">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ right: 0, left: 0, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={true} />
            <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR')}
              stroke="#888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={priceFormatter}
              orientation="right"
              width={60}
              stroke="#888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDataOverflow={false}
            />
            <Tooltip
              labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
              formatter={(value: number) => [priceFormatter(value), "Preço"]}
              contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#007bff"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {latestPrice && (
              <ReferenceLine y={latestPrice} stroke="#007bff" strokeDasharray="3 3">
                  <Label value={priceFormatter(latestPrice)} position="right" fill="#fff" offset={5} className="bg-blue-600 px-1 text-xs" />
              </ReferenceLine>
            )}
            {activeContracts.map(contract => (
              contract.entryTick > 0 && (
                <ReferenceDot
                    key={contract.contractId}
                    x={contract.entryTime}
                    y={contract.entryTick}
                    r={4}
                    fill="#ff9800"
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

  /* --------------------------------------------------------
     MODO CANDLES (Canvas Profissional)
  -------------------------------------------------------- */
  const candleData = visibleData as CandleData[];
  const allValues = candleData.flatMap(d => [d.high, d.low, d.bollingerUpper, d.bollingerLower]);
  const yDomain = getStableYDomain(allValues.filter(v => v !== undefined) as number[]);

  return (
    <div key={componentKey} className="h-[400px] w-full relative bg-white dark:bg-neutral-950">
       <ResponsiveContainer width="100%" height="100%">
            {/* 
                Usamos o ComposedChart apenas para desenhar Grid, Eixos e Tooltip.
                O 'data' aqui serve apenas para o Recharts calcular as escalas X/Y.
            */}
            <ComposedChart data={candleData} ref={chartRef} margin={{ top: 10, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="1 0" stroke="#f0f0f0" vertical={true} horizontal={true} />

                <XAxis
                    dataKey="epoch"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    stroke="#888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={40}
                />

                <YAxis
                    domain={yDomain}
                    tickFormatter={priceFormatter}
                    orientation="right"
                    width={60}
                    stroke="#888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                />

                <Tooltip
                    labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    isAnimationActive={false}
                    cursor={{ stroke: '#666', strokeWidth: 1, strokeDasharray: '4 4' }}
                />

                {showBollingerBands && (
                    <>
                        <Area dataKey="bollingerUpper" stackId="bollinger" stroke="none" fill="rgba(0, 123, 255, 0.05)" isAnimationActive={false} />
                        <Area dataKey="bollingerLower" stackId="bollinger" stroke="none" fill="rgba(255, 255, 255, 0)" isAnimationActive={false} />
                    </>
                )}

                {/* Reference Dots de Contratos */}
                {activeContracts.map(contract => (
                  contract.entryTick > 0 && (
                    <ReferenceDot
                        key={contract.contractId}
                        x={contract.entryTime}
                        y={contract.entryTick}
                        r={4}
                        fill="#ff9800"
                        stroke="white"
                        strokeWidth={2}
                        ifOverflow="visible"
                    />
                  )
                ))}

                {/* Linha de Preço Atual com Badge */}
                {latestPrice && (
                    <ReferenceLine y={latestPrice} stroke={COLORS.TEXT} strokeDasharray="2 2" ifOverflow="visible" strokeOpacity={0.5}>
                         <Label 
                            value={priceFormatter(latestPrice)} 
                            position="right"
                            fill="#fff"
                            className="text-xs font-bold"
                            offset={0}
                            // O Recharts não suporta estilo CSS complexo no Label facilmente, 
                            // mas o badge azul da referência é desenhado pelo 'viewBox' customizado ou CSS externo.
                            // Para simplicidade, mantemos texto simples aqui.
                         />
                         {/* Badge simulado com Dot se necessário, mas o Label acima é o padrão */}
                         <ReferenceDot x={candleData[candleData.length-1]?.epoch} y={latestPrice} r={3} fill={COLORS.TEXT} stroke="none" />
                    </ReferenceLine>
                )}
            </ComposedChart>
        </ResponsiveContainer>
        
        {/* A Camada Canvas que desenha as velas REAIS */}
        <CanvasCandles data={candleData} chartRef={chartRef} />
    </div>
  );
}
