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
  }
  
  const exitEpoch = entryEpoch + durationInSeconds

  // Buscar o entryPrice da operação ou do gráfico
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

  // Cores mais vibrantes
  const ENTRY_COLOR = '#3b82f6' // Azul vibrante para entrada
  const WIN_COLOR = '#22c55e' // Verde vibrante
  const LOSS_COLOR = '#ef4444' // Vermelho vibrante

  // 🎯 PONTO DE ENTRADA (Marcador de compra)
  const entryMarker = (
    <ReferenceDot
      key={`entry-${operation.id}`}
      x={entryEpoch}
      y={entryPrice}
      yAxisId="price"
      ifOverflow="visible"
    >
      {/* Círculo externo com borda */}
      <circle r={8} fill={ENTRY_COLOR} stroke="#ffffff" strokeWidth={2.5} />
      {/* Círculo interno para destaque */}
      <circle r={3.5} fill="#ffffff" />
      {/* Seta indicando direção */}
      {operation.direction === 'rise' ? (
        <path d="M -3,-6 L 0,-9 L 3,-6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
      ) : (
        <path d="M -3,6 L 0,9 L 3,6" stroke="#ffffff" strokeWidth={1.5} fill="none" />
      )}
    </ReferenceDot>
  )

  // 📊 SE A OPERAÇÃO ESTÁ FINALIZADA (won ou lost)
  if (operation.status !== 'pending' && operation.exitPrice) {
    const isWin = operation.status === 'won'
    const resultColor = isWin ? WIN_COLOR : LOSS_COLOR

    return (
      <>
        {entryMarker}
        
        {/* LINHA CONECTANDO ENTRADA → SAÍDA */}
        <ReferenceLine
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
        
        {/* 🚩 BANDEIRA DE RESULTADO (Verde ou Vermelha) */}
        <ReferenceDot
          key={`exit-${operation.id}`}
          x={exitEpoch}
          y={operation.exitPrice}
          yAxisId="price"
          ifOverflow="visible"
        >
          <g transform="translate(-10, -22)">
            <Flag 
              fill={resultColor} 
              stroke="#ffffff" 
              strokeWidth={2.5} 
              size={24}
            />
          </g>
        </ReferenceDot>
      </>
    )
  }

  // ⏳ SE ESTÁ PENDENTE (operação em andamento)
  if (chartData.length > 0) {
    const currentPoint = chartData[chartData.length - 1]
    const currentPrice = currentPoint?.price || entryPrice
    const currentEpoch = currentPoint?.epoch || exitEpoch
    const PENDING_COLOR = '#f59e0b' // Laranja para pendente

    return (
      <>
        {entryMarker}
        
        {/* Linha tracejada até o ponto atual */}
        <ReferenceLine
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
        
        {/* Indicador de operação em andamento */}
        <ReferenceDot
          key={`pending-${operation.id}`}
          x={Math.min(exitEpoch, currentEpoch)}
          y={currentPrice}
          yAxisId="price"
          ifOverflow="visible"
        >
          <circle r={6} fill={PENDING_COLOR} stroke="#ffffff" strokeWidth={2} opacity={0.9}>
            <animate attributeName="r" values="6;8;6" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </ReferenceDot>
      </>
    )
  }

  return entryMarker
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
    if (operations.length > 0) {
      console.log('📊 Operations on chart:', operations.length)
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

  // Filtrar operações visíveis
  const visibleOperations = React.useMemo(() => {
    // Mostrar todas as operações (podemos otimizar depois se necessário)
    return operations
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

      {/* Status das operações */}
      {visibleOperations.length > 0 && (
        <div className="text-xs text-gray-400 mb-1">
          📊 {visibleOperations.length} operação(ões) • 
          {visibleOperations.filter(op => op.status === 'pending').length > 0 && 
            ` ⏳ ${visibleOperations.filter(op => op.status === 'pending').length} em andamento`}
          {visibleOperations.filter(op => op.status === 'won').length > 0 && 
            ` 🟢 ${visibleOperations.filter(op => op.status === 'won').length} vencidas`}
          {visibleOperations.filter(op => op.status === 'lost').length > 0 && 
            ` 🔴 ${visibleOperations.filter(op => op.status === 'lost').length} perdidas`}
        </div>
      )}

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

    