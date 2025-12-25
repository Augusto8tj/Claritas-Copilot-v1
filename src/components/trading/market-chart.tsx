
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
  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>('dark')
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [windowSize, setWindowSize] = React.useState(INITIAL_WINDOW_SECONDS)
  const [xDomain, setXDomain] = React.useState<[number, number] | null>(null)
  const colors = THEMES[chartTheme]
  
  const latestPrice = rawData.length > 0 ? rawData[rawData.length - 1]!.price : 0
  const prevPrice = rawData.length > 1 ? rawData[rawData.length - 2]!.price : latestPrice
  
  // 1. Gerenciar Domínio X (Tempo)
  React.useEffect(() => {
    if (rawData.length > 0) {
      const lastEpoch = rawData[rawData.length - 1].epoch
      const firstEpoch = lastEpoch - windowSize
      setXDomain([firstEpoch, lastEpoch])
    }
  }, [rawData, windowSize])
  
  // 2. Calcular Domínio Y (Preço) Manualmente
  const yDomain = React.useMemo(() => {
      if (!xDomain) return ['auto', 'auto'];
      
      const [minX, maxX] = xDomain;
      
      // Filtra apenas os dados visíveis na janela atual
      const visibleData = rawData.filter(d => d.epoch >= minX && d.epoch <= maxX);
      
      if (visibleData.length === 0) {
        // Fallback seguro para não quebrar o gráfico se não tiver dados
        return ['auto', 'auto']; 
      }

      let minPrice = Infinity;
      let maxPrice = -Infinity;
      
      visibleData.forEach(d => {
          if (d.price < minPrice) minPrice = d.price;
          if (d.price > maxPrice) maxPrice = d.price;
      });

      // Proteção extra contra Infinity
      if (minPrice === Infinity || maxPrice === -Infinity) return ['auto', 'auto'];

      const padding = (maxPrice - minPrice) * 0.1; // 10% de margem
      
      // Arredondar para evitar números quebrados demais no eixo
      return [minPrice - padding, maxPrice + padding];

  }, [rawData, xDomain]);

  // 3. Filtrar Operações
  const visibleOperations = React.useMemo(() => {
    if (!Array.isArray(operations)) return [];
    return operations;
  }, [operations])

  // 4. Preparar Dados do Scatter (COM PROTEÇÃO CONTRA ZERO)
  const { entryPoints, exitPoints } = React.useMemo(() => {
    const entries: any[] = [];
    const exits: any[] = [];

    // Pegar o último preço válido do gráfico para usar de fallback seguro
    const lastChartPrice = rawData.length > 0 ? rawData[rawData.length-1].price : 0;

    visibleOperations.forEach(op => {
      // Validar Timestamp
      if (!op.timestamp) return;
      const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000);
      
      // Calcular Saída
      let durationInSeconds = 0;
      switch (op.durationUnit) {
        case 't': durationInSeconds = op.duration * 2; break;
        case 's': durationInSeconds = op.duration; break;
        case 'm': durationInSeconds = op.duration * 60; break;
        case 'h': durationInSeconds = op.duration * 3600; break;
        case 'd': durationInSeconds = op.duration * 86400; break;
      }
      const exitEpoch = entryEpoch + durationInSeconds;

      // === CORREÇÃO CRÍTICA AQUI ===
      // Se op.entryPrice for nulo ou 0, usamos lastChartPrice.
      // Se lastChartPrice TAMBÉM for 0, ignoramos a operação para não quebrar o eixo Y.
      const entryPrice = op.entryPrice || lastChartPrice;

      // Se o preço for inválido ou zero, PULA esta iteração.
      if (!entryPrice || entryPrice <= 0) return;

      // Adiciona Ponto de Entrada
      entries.push({
        x: entryEpoch,
        y: entryPrice,
        direction: op.direction,
        id: op.id
      });

      // Adiciona Ponto de Saída (apenas se tiver preço de saída válido)
      if (op.status !== 'pending' && op.exitPrice && op.exitPrice > 0) {
        exits.push({
          x: exitEpoch,
          y: op.exitPrice,
          status: op.status,
          id: op.id
        });
      }
    });

    return { entryPoints: entries, exitPoints: exits };
  }, [visibleOperations, rawData]);

  // --- LOADING STATES ---
  if (isChartLoading && rawData.length === 0) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center bg-zinc-900 text-white">
        Carregando...
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

  return (
    <div className="h-[520px] w-full rounded-xl p-4" style={{ backgroundColor: colors.bg }}>
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
            allowDataOverflow={true}
            tick={{ fontSize: 10 }}
          />
          
          {/* O DOMÍNIO É CONTROLADO AQUI E APENAS AQUI */}
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={yDomain} // Usa o cálculo protegido
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
            allowDataOverflow={false} // Deixa o eixo se ajustar levemente se necessário
          />
          
          <Tooltip 
            content={<CustomTooltip colors={colors} />} 
            cursor={{ stroke: colors.crosshair, strokeDasharray: '3 3' }} 
          />

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
            dot={false}
            activeDot={{ r: 4, fill: colors.line }}
            isAnimationActive={false}
          />

          {/* Reference Lines (Conectores) */}
          {visibleOperations.map(op => {
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
            
            // Proteção na linha também
            const lastData = rawData.length > 0 ? rawData[rawData.length-1] : null;
            const fallbackPrice = lastData ? lastData.price : 0;
            const entryPrice = op.entryPrice || fallbackPrice;

            if (!entryPrice || entryPrice <= 0) return null;

            const isPending = op.status === 'pending';
            const targetEpoch = isPending && lastData ? Math.min(exitEpoch, lastData.epoch) : exitEpoch;
            const targetPrice = isPending && lastData ? lastData.price : (op.exitPrice || entryPrice);

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
                ifOverflow="visible"
                isFront={true}
              />
            )
          })}

          {/* SCATTERS LIMPOS */}
          <Scatter 
            yAxisId="price"
            data={entryPoints}
            shape={<EntryMarker />}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
          />

          <Scatter 
            yAxisId="price"
            data={exitPoints}
            shape={<ExitMarker />}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

    