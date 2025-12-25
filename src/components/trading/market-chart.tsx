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
  Dot,
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
import type { Operation } from '@/components/trading/operations-log.types'

/* =========================================================
   CUSTOM DOT COMPONENTS (Para renderizar marcadores)
========================================================= */
interface CustomDotProps {
  cx?: number
  cy?: number
  payload?: any
  operations: Operation[]
  chartData: ChartData[]
}

const EntryDot = ({ cx, cy, payload, operations, chartData }: CustomDotProps) => {
  if (!cx || !cy || !payload) return null
  
  const currentEpoch = payload.epoch
  
  // Encontrar operações que começam neste ponto (±2 segundos de tolerância)
  const entriesAtPoint = operations.filter(op => {
    const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000)
    return Math.abs(entryEpoch - currentEpoch) <= 2
  })
  
  if (entriesAtPoint.length === 0) return null
  
  const ENTRY_COLOR = '#3b82f6'
  
  return (
    <g>
      {entriesAtPoint.map((op, idx) => (
        <g key={`entry-${op.id}`} transform={`translate(${cx}, ${cy + idx * 16})`}>
          {/* Círculo externo */}
          <circle r={8} fill={ENTRY_COLOR} stroke="#ffffff" strokeWidth={2.5} />
          {/* Círculo interno */}
          <circle r={3.5} fill="#ffffff" />
          {/* Seta de direção */}
          {op.direction === 'rise' ? (
            <path d="M -3,-6 L 0,-9 L 3,-6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
          ) : (
            <path d="M -3,6 L 0,9 L 3,6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
          )}
        </g>
      ))}
    </g>
  )
}

const ExitDot = ({ cx, cy, payload, operations }: CustomDotProps) => {
  if (!cx || !cy || !payload) return null
  
  const currentEpoch = payload.epoch
  
  // Encontrar operações finalizadas que terminam neste ponto
  const exitsAtPoint = operations.filter(op => {
    if (op.status === 'pending' || !op.exitPrice) return false
    
    const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000)
    let durationInSeconds = 0
    switch (op.durationUnit) {
      case 't': durationInSeconds = op.duration * 2; break
      case 's': durationInSeconds = op.duration; break
      case 'm': durationInSeconds = op.duration * 60; break
      case 'h': durationInSeconds = op.duration * 3600; break
    }
    const exitEpoch = entryEpoch + durationInSeconds
    
    return Math.abs(exitEpoch - currentEpoch) <= 2
  })
  
  if (exitsAtPoint.length === 0) return null
  
  return (
    <g>
      {exitsAtPoint.map((op, idx) => {
        const isWin = op.status === 'won'
        const flagColor = isWin ? '#22c55e' : '#ef4444'
        
        return (
          <g key={`exit-${op.id}`} transform={`translate(${cx - 10}, ${cy - 22 + idx * 26})`}>
            <Flag 
              fill={flagColor} 
              stroke="#ffffff" 
              strokeWidth={2.5} 
              size={24}
            />
          </g>
        )
      })}
    </g>
  )
}

/* =========================================================
   OPERATION LINES (Linhas conectando entrada/saída)
========================================================= */
interface OperationLinesProps {
  operations: Operation[]
  chartData: ChartData[]
  colors: typeof THEMES.dark
}

const OperationLines = ({ operations, chartData, colors }: OperationLinesProps) => {
  return (
    <>
      {operations.map(operation => {
        const entryEpoch = Math.floor(new Date(operation.timestamp).getTime() / 1000)
        
        let entryPrice = operation.entryPrice
        if (!entryPrice && chartData.length > 0) {
          const closestPoint = chartData.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev.epoch - entryEpoch)
            const currDiff = Math.abs(curr.epoch - entryEpoch)
            return currDiff < prevDiff ? curr : prev
          })
          if (Math.abs(closestPoint.epoch - entryEpoch) <= 10) {
            entryPrice = closestPoint.price
          }
        }
        
        if (!entryPrice) return null
        
        let durationInSeconds = 0
        switch (operation.durationUnit) {
          case 't': durationInSeconds = operation.duration * 2; break
          case 's': durationInSeconds = operation.duration; break
          case 'm': durationInSeconds = operation.duration * 60; break
          case 'h': durationInSeconds = operation.duration * 3600; break
        }
        const exitEpoch = entryEpoch + durationInSeconds
        
        // Operação finalizada
        if (operation.status !== 'pending' && operation.exitPrice) {
          const isWin = operation.status === 'won'
          const resultColor = isWin ? '#22c55e' : '#ef4444'
          
          return (
            <ReferenceLine
              key={`line-${operation.id}`}
              yAxisId="price"
              segment={[
                { x: entryEpoch, y: entryPrice },
                { x: exitEpoch, y: operation.exitPrice },
              ]}
              stroke={resultColor}
              strokeDasharray="4 4"
              strokeWidth={3}
              ifOverflow="visible"
            />
          )
        }
        
        // Operação pendente
        if (chartData.length > 0) {
          const currentPoint = chartData[chartData.length - 1]
          const currentPrice = currentPoint?.price || entryPrice
          const currentEpoch = currentPoint?.epoch || exitEpoch
          const PENDING_COLOR = '#f59e0b'
          
          return (
            <ReferenceLine
              key={`line-${operation.id}`}
              yAxisId="price"
              segment={[
                { x: entryEpoch, y: entryPrice },
                { x: Math.min(exitEpoch, currentEpoch), y: currentPrice },
              ]}
              stroke={PENDING_COLOR}
              strokeDasharray="5 5"
              strokeWidth={2.5}
              strokeOpacity={0.8}
              ifOverflow="visible"
            />
          )
        }
        
        return null
      })}
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
  
  // Gerenciar domínio do gráfico com dados completos desde o início
  React.useEffect(() => {
    if (rawData.length > 0) {
      const lastEpoch = rawData[rawData.length - 1].epoch
      const firstEpoch = Math.max(rawData[0].epoch, lastEpoch - windowSize)
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

          {/* LINHAS DAS OPERAÇÕES (Atrás do gráfico de preço) */}
          <OperationLines 
            operations={visibleOperations} 
            chartData={rawData} 
            colors={colors} 
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
            dot={(props: any) => (
              <>
                <EntryDot {...props} operations={visibleOperations} chartData={rawData} />
                <ExitDot {...props} operations={visibleOperations} chartData={rawData} />
              </>
            )}
            isAnimationActive={false}
          />
        
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
