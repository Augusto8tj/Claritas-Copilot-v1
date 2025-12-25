
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
import { Flag, TrendingUp, TrendingDown } from 'lucide-react'
import type { Operation } from '@/components/trading/operations-log.types'

/* =========================================================
   TRADE MARKER COMPONENT (MARCADORES DE OPERAÇÃO)
========================================================= */
interface OperationMarkerProps {
  operation: Operation
  chartData: ChartData[]
  colors: typeof THEMES.dark
}

const OperationMarker = ({ operation, chartData, colors }: OperationMarkerProps) => {
  // Debug: Log para verificar se está recebendo a operação
  console.log('Rendering operation marker:', operation)

  // Converter timestamp ISO para epoch
  const entryEpoch = Math.floor(new Date(operation.timestamp).getTime() / 1000)
  
  // Calcular o epoch de saída baseado na duração
  let durationInSeconds = 0
  switch (operation.durationUnit) {
    case 't':
      durationInSeconds = operation.duration * 2 // Aproximação: 1 tick ≈ 2 segundos
      break
    case 's':
      durationInSeconds = operation.duration
      break
    case 'm':
      durationInSeconds = operation.duration * 60
      break
    case 'h':
      durationInSeconds = operation.duration * 3600
      break
    case 'd':
        durationInSeconds = operation.duration * 86400
        break;
  }
  
  const exitEpoch = entryEpoch + durationInSeconds

  console.log('Entry epoch:', entryEpoch, 'Exit epoch:', exitEpoch)
  console.log('Chart data range:', chartData.length > 0 ? [chartData[0].epoch, chartData[chartData.length - 1].epoch] : 'no data')

  // Usar o entryPrice da operação ou encontrar no gráfico
  let entryPrice = operation.entryPrice
  
  // Se não tem entryPrice, SEMPRE buscar no gráfico
  if (!entryPrice && chartData.length > 0) {
    // Encontrar o ponto mais próximo no gráfico (dentro de 10 segundos de tolerância)
    const closestPoint = chartData.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.epoch - entryEpoch)
      const currDiff = Math.abs(curr.epoch - entryEpoch)
      return currDiff < prevDiff ? curr : prev
    })
    
    // Só usar se estiver dentro de 10 segundos
    if (Math.abs(closestPoint.epoch - entryEpoch) <= 10) {
      entryPrice = closestPoint.price
      console.log('✅ Found entry price from chart:', entryPrice, 'at epoch:', closestPoint.epoch)
    }
  }
  
  if (!entryPrice) {
    console.warn('⚠️ No entry price found for operation:', operation.id, 'Entry epoch:', entryEpoch)
    return null
  }

  // Cor baseada na direção da operação
  const directionColor = operation.direction === 'rise' ? colors.bull : colors.bear

  // Ponto de Entrada (bolinha marcando o início)
  const entryDot = (
    <ReferenceDot
      key={`entry-${operation.id}`}
      x={entryEpoch}
      y={entryPrice}
      yAxisId="price"
      ifOverflow="visible"
    >
      <circle r={7} fill={directionColor} stroke={colors.bg} strokeWidth={2.5} />
      <circle r={3} fill={colors.bg} />
    </ReferenceDot>
  )

  // Se a operação está finalizada (won ou lost)
  if (operation.status !== 'pending' && operation.exitPrice) {
    const isWin = operation.status === 'won'
    const flagColor = isWin ? '#22c55e' : '#ef4444' // green-500 : red-500

    console.log('Rendering completed operation:', operation.id, 'Status:', operation.status)

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
          strokeWidth={2.5}
          ifOverflow="visible"
        />
        {/* Bandeira de resultado */}
        <ReferenceDot
          key={`exit-${operation.id}`}
          x={exitEpoch}
          y={operation.exitPrice}
          yAxisId="price"
          ifOverflow="visible"
        >
          <g transform="translate(-10, -20)">
            <Flag 
              fill={flagColor} 
              stroke={colors.bg} 
              strokeWidth={2} 
              size={20}
            />
          </g>
        </ReferenceDot>
      </>
    )
  }

  // Se está pendente, mostra apenas o ponto de entrada e uma linha tracejada
  if (chartData.length > 0) {
    const currentPoint = chartData[chartData.length - 1]
    const currentPrice = currentPoint?.price || entryPrice
    const currentEpoch = currentPoint?.epoch || exitEpoch

    console.log('Rendering pending operation:', operation.id)

    return (
      <>
        {entryDot}
        {/* Linha tracejada indicando operação em andamento */}
        <ReferenceLine
          yAxisId="price"
          segment={[
            { x: entryEpoch, y: entryPrice },
            { x: Math.min(exitEpoch, currentEpoch), y: currentPrice },
          ]}
          stroke={directionColor}
          strokeDasharray="5 5"
          strokeWidth={2}
          strokeOpacity={0.7}
          ifOverflow="visible"
        />
        {/* Ícone indicando direção */}
        <ReferenceDot
          key={`pending-${operation.id}`}
          x={Math.min(exitEpoch, currentEpoch)}
          y={currentPrice}
          yAxisId="price"
          ifOverflow="visible"
        >
          {operation.direction === 'rise' ? (
            <TrendingUp size={16} stroke={directionColor} strokeWidth={2} />
          ) : (
            <TrendingDown size={16} stroke={directionColor} strokeWidth={2} />
          )}
        </ReferenceDot>
      </>
    )
  }

  return entryDot
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

  // Debug: Log das operações recebidas
  React.useEffect(() => {
    console.log('=== MarketChart Debug ===')
    // Correct way to check for array
    if (!Array.isArray(operations)) {
      console.error('CRITICAL: `operations` prop is not an array!', operations);
      return;
    }
    console.log('Total operations:', operations.length)
    if (operations.length > 0) {
      console.log('First operation details:', {
        id: operations[0].id,
        timestamp: operations[0].timestamp,
        entryPrice: operations[0].entryPrice,
        exitPrice: operations[0].exitPrice,
        status: operations[0].status,
        asset: operations[0].asset
      })
    }
    console.log('Chart data points:', rawData.length)
    if (rawData.length > 0) {
      console.log('Chart time range:', {
        start: new Date(rawData[0].epoch * 1000).toISOString(),
        end: new Date(rawData[rawData.length - 1].epoch * 1000).toISOString(),
        startEpoch: rawData[0].epoch,
        endEpoch: rawData[rawData.length - 1].epoch
      })
    }
  }, [operations, rawData])
      
  // Gerenciar janela de scroll
  React.useEffect(() => {
    if (rawData.length > 1) {
      const lastEpoch = (rawData[rawData.length - 1]!).epoch
      // Aumentar a janela para mostrar mais histórico
      const firstEpoch = lastEpoch - (SCROLLING_WINDOW_SECONDS * 10) // 10 minutos
      setXDomain([firstEpoch, lastEpoch])
    }
  }, [rawData])

  // Filtrar operações - MOSTRAR TODAS PARA DEBUG
  const visibleOperations = React.useMemo(() => {
    console.log('🔍 Filtering operations...', 'Total:', Array.isArray(operations) ? operations.length : 'not an array')
    
    if (!Array.isArray(operations)) {
        return [];
    }
    
    // Temporariamente mostrar todas as operações
    if (operations.length > 0) {
      console.log('✅ Showing all operations:', operations.length)
      console.log('📍 Operations data:', operations.map(op => ({
        id: op.id,
        timestamp: op.timestamp,
        entryPrice: op.entryPrice,
        status: op.status
      })))
      return operations
    }
    
    console.log('❌ No operations to show')
    return []
  }, [operations])

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

      {/* Debug info */}
      <div className="text-xs text-gray-400 mb-2">
        Operações: {visibleOperations.length} | Pontos no gráfico: {rawData.length}
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
              key={`op-${operation.id}`}
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
