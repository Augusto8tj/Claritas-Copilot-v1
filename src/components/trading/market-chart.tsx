
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
import type { ActiveContract } from '@/hooks/use-deriv-api'
import { Flag } from 'lucide-react'

/* =========================================================
   TRADE MARKER COMPONENT (A CAMADA DE SOBREPOSIÇÃO)
========================================================= */
interface TradeMarkerProps {
  contract: ActiveContract
  colors: typeof THEMES.dark
}

const TradeMarker = ({ contract, colors }: TradeMarkerProps) => {
  if (!contract.entryTime || !contract.entryTick) return null

  // Ponto de Entrada (A "bolinha" que marca o início)
  const entryDot = (
    <ReferenceDot
      key={`entry-${contract.contractId}`}
      x={contract.entryTime}
      y={contract.entryTick}
      yAxisId="price"
      ifOverflow="extendDomain"
    >
      <circle r={5} fill={colors.line} stroke={colors.bg} strokeWidth={2} />
    </ReferenceDot>
  )

  // Se o contrato está fechado (lucro ou prejuízo), desenha a linha e a bandeira final
  if (
    (contract.status === 'won' || contract.status === 'lost') &&
    contract.exitTime &&
    contract.exitTick
  ) {
    const isWin = contract.status === 'won'
    const flagColor = isWin ? colors.bull : colors.bear

    return (
      <>
        {entryDot}
        {/* A linha que liga o início ao fim */}
        <ReferenceLine
          yAxisId="price"
          segment={[
            { x: contract.entryTime, y: contract.entryTick },
            { x: contract.exitTime, y: contract.exitTick },
          ]}
          stroke={flagColor}
          strokeDasharray="3 3"
          strokeWidth={2}
          ifOverflow="extendDomain"
        />
        {/* A bandeira de resultado final */}
        <ReferenceDot
          key={`exit-${contract.contractId}`}
          x={contract.exitTime}
          y={contract.exitTick}
          yAxisId="price"
          ifOverflow="extendDomain"
          shape={<Flag fill={flagColor} stroke={colors.bg} strokeWidth={1} size={20} style={{ transform: 'translateY(-10px)' }} />}
        />
      </>
    )
  }

  // Se o contrato ainda está aberto, mostra apenas a "bolinha" de entrada
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
  activeContracts: ActiveContract[]
}

const SCROLLING_WINDOW_SECONDS = 60; // Show last 1 minute

export function MarketChart({
  activeSymbol,
  chartData: rawData,
  isChartLoading,
  chartError,
  chartType,
  setChartType,
  timePeriod,
  setTimePeriod,
  activeContracts,
}: MarketChartProps) {
  // --- STATE & THEME ---
  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>('dark')
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [xDomain, setXDomain] = React.useState<[number, number] | null>(null);
  const colors = THEMES[chartTheme]
  
  const latestPrice = rawData.length > 0 ? (rawData[rawData.length - 1]!).price : 0;
  const prevPrice = rawData.length > 1 ? (rawData[rawData.length - 2]!).price : latestPrice;
      
  // Effect to manage the scrolling window domain
  React.useEffect(() => {
    if (rawData.length > 1) {
      const lastEpoch = rawData[rawData.length - 1].epoch;
      const firstEpoch = lastEpoch - SCROLLING_WINDOW_SECONDS;
      setXDomain([firstEpoch, lastEpoch]);
    }
  }, [rawData]);


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

          {/* ÁREA E LINHA DO PREÇO (O GRÁFICO PRINCIPAL) */}
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
          
          {/* A CAMADA DE SOBREPOSIÇÃO: Renderiza os marcadores de negociação */}
           {activeContracts.map(contract => (
             <TradeMarker key={contract.contractId} contract={contract} colors={colors} />
           ))}
        
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
