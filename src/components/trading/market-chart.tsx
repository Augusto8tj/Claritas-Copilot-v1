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
  ReferenceDot, // <--- IMPORTANTE
} from 'recharts'

import type {
  ChartData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
import { CustomTooltip } from './chart-parts/custom-tooltip'
import { THEMES } from './chart-parts/themes'
import { Flag, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { Operation } from '@/components/trading/operations-log.types';


/* =========================================================
   SHAPES PARA REFERENCE DOTS
========================================================= */
const EntryMarker = (props: any) => {
  const { cx, cy, payload } = props; // `payload` is passed by ReferenceDot
  if (!payload) return null;
  const { direction } = payload;
  const ENTRY_COLOR = '#3b82f6';
  
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Círculo externo */}
      <circle r={8} fill={ENTRY_COLOR} stroke="#ffffff" strokeWidth={2.5} />
      {/* Círculo interno */}
      <circle r={3.5} fill="#ffffff" />
      {/* Seta */}
      {direction === 'rise' ? (
        <path d="M -3,-6 L 0,-9 L 3,-6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
      ) : (
        <path d="M -3,6 L 0,9 L 3,6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
      )}
    </g>
  );
};

const ExitMarker = (props: any) => {
  const { cx, cy, payload } = props; // `payload` is passed by ReferenceDot
  if (!payload) return null;
  const { status } = payload;
  const isWin = status === 'won';
  const flagColor = isWin ? '#22c55e' : '#ef4444';

  return (
    <g transform={`translate(${cx - 5}, ${cy - 22})`}> 
      <Flag 
        fill={flagColor} 
        stroke="#ffffff" 
        strokeWidth={2.5} 
        size={24}
      />
    </g>
  );
};


/* =========================================================
   OPERATIONS LAYER (Renderiza Linhas e Pontos)
========================================================= */
const OperationsLayer = ({ operations, chartData }: { operations: Operation[], chartData: ChartData[] }) => {
  return (
    <>
      {operations.map((op) => {
        // Converter timestamp da operação para Epoch (segundos) para bater com o XAxis
        const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000);
        
        // Calcular Epoch de saída
        let durationInSeconds = 0;
        switch (op.durationUnit) {
          case 't': durationInSeconds = op.duration * 2; break; // Estimativa para ticks
          case 's': durationInSeconds = op.duration; break;
          case 'm': durationInSeconds = op.duration * 60; break;
          case 'h': durationInSeconds = op.duration * 3600; break;
          case 'd': durationInSeconds = op.duration * 86400; break;
        }
        const exitEpoch = entryEpoch + durationInSeconds;

        // Definir Preço de Entrada (use o da operação ou o ultimo conhecido se for null)
        const entryPrice = op.entryPrice || (chartData.length > 0 ? chartData[chartData.length-1].price : 0);
        
        // Definir Preço de Saída ou Alvo (para linha pendente)
        // Se estiver pendente, a linha vai até o ultimo ponto do gráfico
        const currentChartEpoch = chartData.length > 0 ? chartData[chartData.length - 1].epoch : entryEpoch;
        const currentChartPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : entryPrice;
        
        const isPending = op.status === 'pending';
        const targetEpoch = isPending ? Math.min(exitEpoch, currentChartEpoch) : exitEpoch;
        const targetPrice = isPending ? currentChartPrice : op.exitPrice;

        if (!entryPrice) return null;

        return (
          <React.Fragment key={op.id}>
            {/* 1. LINHA DE CONEXÃO (Renderizada primeiro para ficar atrás dos pontos) */}
            <ReferenceLine
              yAxisId="price"
              segment={[
                { x: entryEpoch, y: entryPrice },
                { x: targetEpoch, y: targetPrice || entryPrice } // Fallback para y
              ]}
              stroke={isPending ? '#f59e0b' : (op.status === 'won' ? '#22c55e' : '#ef4444')}
              strokeDasharray={isPending ? "5 5" : "4 4"}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />

            {/* 2. PONTO DE ENTRADA (Renderiza apenas 1 vez por operação) */}
            <ReferenceDot
              yAxisId="price"
              x={entryEpoch}
              y={entryPrice}
              shape={(props) => <EntryMarker {...props} payload={{direction: op.direction}} />}
              ifOverflow="extendDomain"
            />

            {/* 3. PONTO DE SAÍDA (Apenas se finalizado e tiver preço de saída) */}
            {!isPending && op.exitPrice && (
              <ReferenceDot
                yAxisId="price"
                x={exitEpoch}
                y={op.exitPrice}
                shape={(props) => <ExitMarker {...props} payload={{status: op.status}} />}
                ifOverflow="extendDomain"
              />
            )}
          </React.Fragment>
        );
      })}
    </>
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

  // Controles de Zoom
  const handleZoomIn = () => {
    setWindowSize(prev => Math.max(30, prev - 30)) // Mínimo 30 segundos
  }
  
  const handleZoomOut = () => {
    setWindowSize(prev => Math.min(600, prev + 30)) // Máximo 10 minutos
  }
  
  const handleResetZoom = () => {
    setWindowSize(INITIAL_WINDOW_SECONDS)
  }

  // Filtrar operações visíveis
  const visibleOperations = React.useMemo(() => {
    if (!Array.isArray(operations)) {
        console.warn("MarketChart received 'operations' prop that is not an array:", operations);
        return [];
    }
    return operations
  }, [operations])

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

      {/* Controles de Zoom e Status */}
      <div className="flex items-center justify-between mb-2">
        {/* Status das operações */}
        {visibleOperations.length > 0 && (
          <div className="text-xs text-gray-400">
            📊 {visibleOperations.length} operação(ões) • 
            {visibleOperations.filter(op => op.status === 'pending').length > 0 && 
              ` ⏳ ${visibleOperations.filter(op => op.status === 'pending').length} pendente`}
            {visibleOperations.filter(op => op.status === 'won').length > 0 && 
              ` 🟢 ${visibleOperations.filter(op => op.status === 'won').length} vitória`}
            {visibleOperations.filter(op => op.status === 'lost').length > 0 && 
              ` 🔴 ${visibleOperations.filter(op => op.status === 'lost').length} perda`}
          </div>
        )}
        
        {/* Controles de Zoom */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{windowSize}s</span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title="Diminuir zoom (ver menos tempo)"
          >
            <ZoomIn size={16} stroke={colors.text} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title="Aumentar zoom (ver mais tempo)"
          >
            <ZoomOut size={16} stroke={colors.text} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title="Resetar zoom"
          >
            <Maximize2 size={16} stroke={colors.text} />
          </button>
        </div>
      </div>

      {/* --- MAIN PRICE CHART --- */}
      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart
          data={rawData}
          margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
          onMouseMove={e => e?.activeLabel && setCursor(e.activeLabel)}
          onMouseLeave={() => setCursor(null)}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis 
            dataKey="epoch"
            type="number"
            domain={xDomain || ['dataMin', 'dataMax']}
            tickFormatter={(time) => new Date(time * 1000).toLocaleTimeString()} 
            stroke={colors.text} 
            tick={{ fontSize: 10 }}
            allowDataOverflow={true}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={['auto', 'auto']}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
          />
          <Tooltip content={<CustomTooltip colors={colors} />} />

          {/* CROSSHAIR */}
          {cursor && (
            <ReferenceLine x={cursor as any} stroke={colors.crosshair} strokeDasharray="3 3" yAxisId="price"/>
          )}

          {/* === NOVA CAMADA DE OPERAÇÕES === */}
          <OperationsLayer 
            operations={visibleOperations} 
            chartData={rawData} 
          />

          {/* ÁREA E LINHA DO PREÇO */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.areaTop} />
              <stop offset="100%" stopColor={colors.areaBottom} />
            </linearGradient>
          </defs>
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
            isAnimationActive={false}
          />
        
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
