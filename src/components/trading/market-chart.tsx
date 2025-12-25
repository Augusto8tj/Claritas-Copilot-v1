
'use client'

import * as React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Line,
  Area,
  Scatter,
} from 'recharts'
import { Flag } from 'lucide-react'

import type {
  ChartData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
import { CustomTooltip } from './chart-parts/custom-tooltip'
import { THEMES } from './chart-parts/themes'
import type { Operation } from '@/components/trading/operations-log.types';


/* =========================================================
   MARCADORES CUSTOMIZADOS (SHAPES)
========================================================= */
const EntryMarker = (props: any) => {
  const { cx, cy, payload } = props;
  // Proteção: se o Recharts ainda não calculou a posição, não renderiza
  if (!cx || !cy) return null;
  
  const direction = payload.direction; // Vem do dado do Scatter
  const ENTRY_COLOR = '#3b82f6';
  
  return (
    <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
      <circle r={8} fill={ENTRY_COLOR} stroke="#ffffff" strokeWidth={2.5} />
      <circle r={3.5} fill="#ffffff" />
      {direction === 'rise' ? (
        <path d="M -3,-6 L 0,-9 L 3,-6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
      ) : (
        <path d="M -3,6 L 0,9 L 3,6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
      )}
    </g>
  );
};

const ExitMarker = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;

  const status = payload.status;
  const isWin = status === 'won';
  const flagColor = isWin ? '#22c55e' : '#ef4444';

  return (
    <g transform={`translate(${cx - 5}, ${cy - 22})`} style={{ pointerEvents: 'none' }}>
      <Flag fill={flagColor} stroke="#ffffff" strokeWidth={2.5} size={24} />
    </g>
  );
};


/* =========================================================
   MAIN CHART COMPONENT
========================================================= */

interface MarketChartProps {
  activeSymbol: string
  chartData: ChartData[]
  isChartLoading: boolean
  chartError: string | null
  chartType: ChartType
  setChartType: (type: ChartType) => void
  timePeriod: TimePeriod
  setTimePeriod: (period: TimePeriod) => void
  operations: Operation[]
}

const INITIAL_WINDOW_SECONDS = 120 // Começar com 2 minutos visíveis

export function MarketChart({
  activeSymbol,
  chartData: rawData,
  isChartLoading,
  chartError,
  chartType,
  setChartType,
  timePeriod,
  setTimePeriod,
  operations,
}: MarketChartProps) {
  // --- STATE & THEME ---
  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>('dark')
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [windowSize, setWindowSize] = React.useState(INITIAL_WINDOW_SECONDS)
  const [xDomain, setXDomain] = React.useState<[number, number] | null>(null)
  const colors = THEMES[chartTheme]
  
  const latestPrice = rawData.length > 0 ? rawData[rawData.length - 1]!.price : 0
  const prevPrice = rawData.length > 1 ? rawData[rawData.length - 2]!.price : latestPrice
  
  // Gerenciar domínio do gráfico para criar efeito de tela deslizante
  React.useEffect(() => {
    if (rawData.length > 0) {
      const lastEpoch = rawData[rawData.length - 1].epoch
      const firstEpoch = lastEpoch - windowSize
      setXDomain([firstEpoch, lastEpoch])
    }
  }, [rawData, windowSize])
  
  // Calcular o domínio do eixo Y manualmente para evitar desalinhamento
  const yDomain = React.useMemo(() => {
      if (!xDomain) return ['auto', 'auto'];
      
      const [minX, maxX] = xDomain;
      
      const visibleData = rawData.filter(d => d.epoch >= minX && d.epoch <= maxX);
      if (visibleData.length === 0) return ['auto', 'auto'];

      let minPrice = Infinity;
      let maxPrice = -Infinity;
      
      visibleData.forEach(d => {
          if (d.price < minPrice) minPrice = d.price;
          if (d.price > maxPrice) maxPrice = d.price;
      });

      if (minPrice === Infinity) return ['auto', 'auto'];

      const padding = (maxPrice - minPrice) * 0.1; // 10% de folga
      return [minPrice - padding, maxPrice + padding];

  }, [rawData, xDomain]);

  // Filtrar operações visíveis
  const visibleOperations = React.useMemo(() => {
    if (!Array.isArray(operations)) {
        console.warn("MarketChart received 'operations' prop that is not an array:", operations);
        return [];
    }
    return operations
  }, [operations])

  // === PREPARAÇÃO DOS DADOS PARA O SCATTER ===
  // Separa os pontos de entrada e saída em arrays dedicados
  const { entryPoints, exitPoints } = React.useMemo(() => {
    const entries: any[] = [];
    const exits: any[] = [];

    visibleOperations.forEach(op => {
      // Calcular Timestamp (X)
      const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000);
      
      let durationInSeconds = 0;
      switch (op.durationUnit) {
        case 't': durationInSeconds = op.duration * 2; break;
        case 's': durationInSeconds = op.duration; break;
        case 'm': durationInSeconds = op.duration * 60; break;
        case 'h': durationInSeconds = op.duration * 3600; break;
        case 'd': durationInSeconds = op.duration * 86400; break;
      }
      const exitEpoch = entryEpoch + durationInSeconds;

      // Calcular Preço (Y)
      // Se não tiver entryPrice, usa o último conhecido do rawData (fallback)
      const entryPrice = op.entryPrice || (rawData.length > 0 ? rawData[rawData.length-1].price : 0);

      if (entryPrice) {
        // Adiciona Ponto de Entrada
        entries.push({
          x: entryEpoch,
          y: entryPrice,
          direction: op.direction,
          id: op.id
        });

        // Adiciona Ponto de Saída (apenas se finalizado e com preço)
        if (op.status !== 'pending' && op.exitPrice) {
          exits.push({
            x: exitEpoch,
            y: op.exitPrice,
            status: op.status,
            id: op.id
          });
        }
      }
    });

    return { entryPoints: entries, exitPoints: exits };
  }, [visibleOperations, rawData]);

  // --- LOADING & ERROR STATES ---
  if (isChartLoading && rawData.length === 0) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center bg-zinc-900 text-white">
        Carregando dados do mercado...
      </div>
    )
  }
  if (chartError) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center text-red-500 bg-zinc-900">
        {chartError}
      </div>
    )
  }

  // === RENDER =============================================
  return (
    <div
      className="h-[520px] w-full rounded-xl p-4"
      style={{ backgroundColor: colors.bg }}
    >
      <HeaderInfo
        symbol={activeSymbol}
        latestPrice={latestPrice}
        prevPrice={prevPrice}
        colors={colors}
        chartType={chartType}
        setChartType={setChartType}
        timePeriod={timePeriod}
        setTimePeriod={setTimePeriod}
        chartTheme={chartTheme}
        setChartTheme={setChartTheme}
      />
      
      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart
          data={rawData}
          margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
          onMouseMove={e => e?.activeLabel && setCursor(e.activeLabel)}
          onMouseLeave={() => setCursor(null)}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.areaTop} />
              <stop offset="100%" stopColor={colors.areaBottom} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          
          <XAxis 
            dataKey="epoch"
            type="number"
            domain={xDomain || ['dataMin', 'dataMax']}
            tickFormatter={(time) => new Date(time * 1000).toLocaleTimeString()} 
            stroke={colors.text} 
            allowDataOverflow
            tick={{ fontSize: 10 }}
          />
          
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={yDomain}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
          />
          
          <Tooltip content={<CustomTooltip colors={colors} />} cursor={{ stroke: colors.crosshair, strokeDasharray: '3 3' }} />

          {/* 1. GRÁFICO DE ÁREA/LINHA (BACKGROUND) */}
          <Area
            yAxisId="price"
            dataKey="price"
            fill="url(#areaGrad)"
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            yAxisId="price"
            dataKey="price"
            stroke={colors.line}
            strokeWidth={2}
            dot={false} // IMPORTANTE: Desativado
            activeDot={{ r: 4, fill: colors.line }}
            isAnimationActive={false}
          />

          {/* 2. LINHAS DE OPERAÇÃO (CONECTORES) */}
          {visibleOperations.map(op => {
            const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000);
            
            // Recálculo da duração apenas para a linha
            let durationInSeconds = 0;
            switch (op.durationUnit) {
              case 't': durationInSeconds = op.duration * 2; break;
              case 's': durationInSeconds = op.duration; break;
              case 'm': durationInSeconds = op.duration * 60; break;
              case 'h': durationInSeconds = op.duration * 3600; break;
              case 'd': durationInSeconds = op.duration * 86400; break;
            }
            const exitEpoch = entryEpoch + durationInSeconds;
            const entryPrice = op.entryPrice || (rawData.length > 0 ? rawData[rawData.length-1].price : 0);

            // Determinar o ponto final da linha (alvo ou atual se pendente)
            const isPending = op.status === 'pending';
            const lastChartPoint = rawData.length > 0 ? rawData[rawData.length - 1] : null;
            
            const targetEpoch = isPending && lastChartPoint ? Math.min(exitEpoch, lastChartPoint.epoch) : exitEpoch;
            const targetPrice = isPending && lastChartPoint ? lastChartPoint.price : (op.exitPrice || entryPrice);

            if (!entryPrice) return null;

            return (
              <ReferenceLine
                key={`line-${op.id}`}
                yAxisId="price"
                segment={[
                  { x: entryEpoch, y: entryPrice },
                  { x: targetEpoch, y: targetPrice }
                ]}
                stroke={isPending ? '#f59e0b' : (op.status === 'won' ? '#22c55e' : '#ef4444')}
                strokeDasharray={isPending ? "5 5" : "4 4"}
                strokeWidth={2}
                ifOverflow="visible" // Garante que a linha apareça mesmo se sair um pouco
                isFront={true} // Força renderizar na frente da área
              />
            )
          })}

          {/* 3. PONTOS DE ENTRADA (SCATTER - Layer Superior) */}
          <Scatter 
            yAxisId="price"
            data={entryPoints}
            shape={<EntryMarker />}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
            dataKey="x"
            domain={{ y: yDomain }}
          />

          {/* 4. PONTOS DE SAÍDA (SCATTER - Layer Superior) */}
          <Scatter 
            yAxisId="price"
            data={exitPoints}
            shape={<ExitMarker />}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
            dataKey="x"
            domain={{ y: yDomain }}
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
