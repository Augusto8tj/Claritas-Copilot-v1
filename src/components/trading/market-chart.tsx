
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
  ReferenceDot,
} from 'recharts'

import type {
  ChartData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
import { CustomTooltip } from './chart-parts/custom-tooltip'
import { THEMES } from './chart-parts/themes'
import { Flag } from 'lucide-react'
import type { Operation } from './operations-log.types' 

/* =========================================================
   TRADE MARKER COMPONENT (MARCADORES DE OPERAÇÃO)
========================================================= */
interface OperationMarkerProps {
  operation: Operation
  chartData: ChartData[]
  colors: typeof THEMES.dark
}

const OperationMarker = ({ operation, chartData, colors }: OperationMarkerProps) => {
  // Converter timestamp ISO para epoch
  const entryEpoch = Math.floor(new Date(operation.timestamp).getTime() / 1000)
  
  // Calcular o epoch de saída baseado na duração
  const durationInSeconds = operation.durationUnit === 't' 
    ? operation.duration * 2 // Aproximação: 1 tick ≈ 2 segundos
    : operation.durationUnit === 's'
    ? operation.duration
    : operation.durationUnit === 'm'
    ? operation.duration * 60
    : operation.duration * 3600 // hours
  
  const exitEpoch = entryEpoch + durationInSeconds

  // Encontrar o preço de entrada no gráfico (ponto mais próximo)
  const entryPoint = chartData.find(d => Math.abs(d.epoch - entryEpoch) < 5) || 
                     chartData.reduce((prev, curr) => 
                       Math.abs(curr.epoch - entryEpoch) < Math.abs(prev.epoch - entryEpoch) ? curr : prev
                     )
  
  const entryPrice = operation.entryPrice || entryPoint?.price
  
  if (!entryPrice) return null

  // Cor baseada na direção da operação
  const directionColor = operation.direction === 'rise' ? colors.bull : colors.bear

  // Ponto de Entrada (bolinha marcando o início)
  const entryDot = (
    <ReferenceDot
      key={`entry-${operation.id}`}
      x={entryEpoch}
      y={entryPrice}
      yAxisId="price"
      ifOverflow="extendDomain"
    >
      <circle r={6} fill={directionColor} stroke={colors.bg} strokeWidth={2} />
    </ReferenceDot>
  )

  // Se a operação está finalizada (won ou lost)
  if (operation.status !== 'pending' && operation.exitPrice) {
    const isWin = operation.status === 'won'
    const flagColor = isWin ? '#22c55e' : '#ef4444' // green-500 : red-500

    return (
      <>
        {entryDot}
        {/* Linha conectando entrada e saída */}
        <ReferenceLine
          yAxisId="price"
          segment={[
            { x: entryEpoch, y: entryPrice },
            { x: exitEpoch, y: operation.exitPrice },
          ]}
          stroke={flagColor}
          strokeDasharray="3 3"
          strokeWidth={2}
          ifOverflow="extendDomain"
        />
        {/* Bandeira de resultado */}
        <ReferenceDot
          key={`exit-${operation.id}`}
          x={exitEpoch}
          y={operation.exitPrice}
          yAxisId="price"
          ifOverflow="extendDomain"
        >
          <Flag 
            fill={flagColor} 
            stroke={colors.bg} 
            strokeWidth={1.5} 
            size={18}
            style={{ transform: 'translate(-9px, -18px)' }}
          />
        </ReferenceDot>
      </>
    )
  }

  // Se está pendente, mostra apenas o ponto de entrada e uma linha tracejada até o vencimento esperado
  const currentPoint = chartData[chartData.length - 1]
  const currentPrice = currentPoint?.price || entryPrice

  return (
    <>
      {entryDot}
      {/* Linha tracejada indicando operação em andamento */}
      <ReferenceLine
        yAxisId="price"
        segment={[
          { x: entryEpoch, y: entryPrice },
          { x: Math.min(exitEpoch, currentPoint?.epoch || exitEpoch), y: currentPrice },
        ]}
        stroke={directionColor}
        strokeDasharray="5 5"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        ifOverflow="extendDomain"
      />
    </>
  )
}

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
  operations: Operation[] // Mudança aqui: operations ao invés de activeContracts
}

const SCROLLING_WINDOW_SECONDS = 60

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
  const [xDomain, setXDomain] = React.useState<[number, number] | null>(null)
  const colors = THEMES[chartTheme]
  
  const latestPrice = rawData.length > 0 ? (rawData[rawData.length - 1]!).price : 0
  const prevPrice = rawData.length > 1 ? (rawData[rawData.length - 2]!).price : latestPrice
      
  // Gerenciar janela de scroll
  React.useEffect(() => {
    if (rawData.length > 1) {
      const lastEpoch = rawData[rawData.length - 1].epoch
      const firstEpoch = lastEpoch - SCROLLING_WINDOW_SECONDS
      setXDomain([firstEpoch, lastEpoch])
    }
  }, [rawData])

  // Filtrar operações visíveis na janela atual
  const visibleOperations = React.useMemo(() => {
    if (!xDomain || operations.length === 0) return operations
    
    return operations.filter(op => {
      const opEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000)
      return opEpoch >= xDomain[0] - 60 && opEpoch <= xDomain[1] + 60
    })
  }, [operations, xDomain])

  // --- LOADING & ERROR STATES ---
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

      {/* --- MAIN PRICE CHART --- */}
      <ResponsiveContainer width="100%" height="90%">
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
            domain={['dataMin - 0.0001', 'dataMax + 0.0001']}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
          />
          <Tooltip content={<CustomTooltip colors={colors} />} />

          {/* CROSSHAIR */}
          {cursor && (
            <ReferenceLine x={cursor as any} stroke={colors.crosshair} strokeDasharray="3 3" yAxisId="price"/>
          )}

          {/* ÁREA E LINHA DO PREÇO (GRÁFICO PRINCIPAL) */}
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
          
          {/* MARCADORES DE OPERAÇÕES */}
          {visibleOperations.map(operation => (
            <OperationMarker 
              key={operation.id} 
              operation={operation} 
              chartData={rawData}
              colors={colors} 
            />
          ))}
        
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
