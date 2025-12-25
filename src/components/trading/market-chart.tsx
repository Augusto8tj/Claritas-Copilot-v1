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
import { Flag, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type {
  ChartData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
import { CustomTooltip } from './chart-parts/custom-tooltip'
import { THEMES } from './chart-parts/themes'
import type { Operation } from '@/components/trading/operations-log.types'

const INITIAL_WINDOW_SECONDS = 120

/* =========================================================
   MARKER COMPONENTS (Shapes Visuais)
   Correção: Acessa props.payload.direction diretamente
========================================================= */
const EntryMarker = (props: any) => {
  const { cx, cy, payload } = props
  
  // Se o ponto estiver fora da área visível, cx/cy podem ser nulos
  if (!cx || !cy) return null

  // NOTA: payload aqui contém o objeto inteiro que passamos no array entryPoints ({ x, y, direction... })
  const direction = payload.direction 
  const ENTRY_COLOR = '#3b82f6'

  return (
    <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
      <circle r={8} fill={ENTRY_COLOR} stroke="#ffffff" strokeWidth={2.5} />
      <circle r={3.5} fill="#ffffff" />
      {direction === 'rise' ? (
        <path
          d="M -3,-6 L 0,-9 L 3,-6"
          stroke="#ffffff"
          strokeWidth={1.5}
          fill="none"
        />
      ) : (
        <path
          d="M -3,6 L 0,9 L 3,6"
          stroke="#ffffff"
          strokeWidth={1.5}
          fill="none"
        />
      )}
    </g>
  )
}

const ExitMarker = (props: any) => {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null

  const status = payload.status
  const isWin = status === 'won'
  const flagColor = isWin ? '#22c55e' : '#ef4444'

  return (
    <g
      transform={`translate(${cx - 5}, ${cy - 22})`}
      style={{ pointerEvents: 'none' }}
    >
      <Flag
        fill={flagColor}
        stroke="#ffffff"
        strokeWidth={2.5}
        size={24}
      />
    </g>
  )
}

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

  const latestPrice =
    rawData.length > 0 ? rawData[rawData.length - 1]!.price : 0
  const prevPrice =
    rawData.length > 1 ? rawData[rawData.length - 2]!.price : latestPrice

  // 1. Gerenciar Domínio X (Tempo)
  React.useEffect(() => {
    if (rawData.length > 0) {
      const lastEpoch = rawData[rawData.length - 1].epoch
      const firstEpoch = lastEpoch - windowSize
      setXDomain([firstEpoch, lastEpoch])
    }
  }, [rawData, windowSize])

  const handleZoomIn = () => setWindowSize(prev => Math.max(30, prev - 30))
  const handleZoomOut = () => setWindowSize(prev => Math.min(600, prev + 30))
  const handleResetZoom = () => setWindowSize(INITIAL_WINDOW_SECONDS)

  // 2. Calcular Domínio Y (Preço) Manualmente
  const yDomain = React.useMemo(() => {
    if (!xDomain) return ['auto', 'auto']
    const [minX, maxX] = xDomain
    const visibleData = rawData.filter(d => d.epoch >= minX && d.epoch <= maxX)

    if (visibleData.length === 0) return ['auto', 'auto']

    let minPrice = Infinity
    let maxPrice = -Infinity

    visibleData.forEach(d => {
      if (d.price < minPrice) minPrice = d.price
      if (d.price > maxPrice) maxPrice = d.price
    })

    if (minPrice === Infinity || maxPrice === -Infinity) return ['auto', 'auto']

    const padding = (maxPrice - minPrice) * 0.1
    return [minPrice - padding, maxPrice + padding]
  }, [rawData, xDomain])

  // 3. Filtrar Operações
  const visibleOperations = React.useMemo(() => {
    if (!Array.isArray(operations)) return []
    return operations
  }, [operations])

  // 4. Preparar Dados (CORRIGIDO ESTRUTURA DOS OBJETOS)
  const { entryPoints, exitPoints, operationLines } = React.useMemo(() => {
    const entries: any[] = []
    const exits: any[] = []
    const lines: any[] = []
    const lastChartData = rawData.length > 0 ? rawData[rawData.length - 1] : null
    const lastChartPrice = lastChartData ? lastChartData.price : 0

    visibleOperations.forEach(op => {
      if (!op.timestamp) return

      const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000)
      
      // Fallback seguro para entryPrice
      const entryPrice = op.entryPrice || lastChartPrice
      if (!entryPrice || entryPrice <= 0) return

      let durationInSeconds = 0
      switch (op.durationUnit) {
        case 't': durationInSeconds = op.duration * 2; break
        case 's': durationInSeconds = op.duration; break
        case 'm': durationInSeconds = op.duration * 60; break
        case 'h': durationInSeconds = op.duration * 3600; break
        case 'd': durationInSeconds = op.duration * 86400; break
      }
      const exitEpoch = entryEpoch + durationInSeconds

      // === 1. PONTO DE ENTRADA ===
      entries.push({
        x: entryEpoch,
        y: entryPrice,
        direction: op.direction, 
        id: op.id,
      })

      // === 2. LINHA DE CONEXÃO ===
      const isPending = op.status === 'pending'
      
      const targetEpoch = isPending && lastChartData 
        ? Math.min(exitEpoch, lastChartData.epoch) 
        : exitEpoch;

      const targetPrice = isPending && lastChartData
        ? lastChartData.price 
        : (op.exitPrice || entryPrice);

      if (targetPrice > 0) {
         lines.push({
          id: op.id,
          isPending,
          status: op.status,
          segment: [
            { x: entryEpoch, y: entryPrice },
            { x: targetEpoch, y: targetPrice },
          ],
        });
      }

      // === 3. PONTO DE SAÍDA ===
      if (!isPending && op.exitPrice && op.exitPrice > 0) {
        exits.push({
          x: exitEpoch,
          y: op.exitPrice,
          status: op.status,
          id: op.id,
        })
      }
    })

    return {
      entryPoints: entries,
      exitPoints: exits,
      operationLines: lines,
    }
  }, [visibleOperations, rawData])

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

      <div className="mb-2 flex items-center justify-between">
        {/* INFO DAS OPERAÇÕES */}
        {visibleOperations.length > 0 && (
          <div className="text-xs text-gray-400">
             📊 {visibleOperations.length} ops • 
             ⏳ {visibleOperations.filter(op => op.status === 'pending').length} • 
             🟢 {visibleOperations.filter(op => op.status === 'won').length} • 
             🔴 {visibleOperations.filter(op => op.status === 'lost').length}
          </div>
        )}
        
        {/* CONTROLES ZOOM */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">{windowSize}s</span>
          <button onClick={handleZoomIn} className="p-1 rounded hover:bg-gray-700">
            <ZoomIn size={16} stroke={colors.text} />
          </button>
          <button onClick={handleZoomOut} className="p-1 rounded hover:bg-gray-700">
            <ZoomOut size={16} stroke={colors.text} />
          </button>
          <button onClick={handleResetZoom} className="p-1 rounded hover:bg-gray-700">
            <Maximize2 size={16} stroke={colors.text} />
          </button>
        </div>
      </div>

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
            tickFormatter={time => new Date(time * 1000).toLocaleTimeString()}
            stroke={colors.text}
            allowDataOverflow={true}
            tick={{ fontSize: 10 }}
          />

          <YAxis
            yAxisId="price"
            orientation="right"
            domain={yDomain}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
            allowDataOverflow={false}
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

          {/* CROSSHAIR */}
          {cursor && (
            <ReferenceLine
              x={cursor as any}
              stroke={colors.crosshair}
              strokeDasharray="3 3"
              yAxisId="price"
            />
          )}

          {/* === 1. LINHAS CONECTORAS === */}
          {operationLines.map(line => (
            <ReferenceLine
              key={`line-${line.id}`}
              yAxisId="price"
              segment={line.segment}
              stroke={
                line.isPending
                  ? '#f59e0b'
                  : line.status === 'won'
                  ? '#22c55e'
                  : '#ef4444'
              }
              strokeDasharray={line.isPending ? '5 5' : '4 4'}
              strokeWidth={2}
              ifOverflow="visible"
              isFront={true}
            />
          ))}

          {/* === 2. PONTOS DE ENTRADA (SCATTER) === */}
          <Scatter
            yAxisId="price"
            data={entryPoints}
            shape={<EntryMarker />}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
          />

          {/* === 3. PONTOS DE SAÍDA (SCATTER) === */}
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
