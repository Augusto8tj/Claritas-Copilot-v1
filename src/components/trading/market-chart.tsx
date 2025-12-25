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
  Brush,
  BarChart,
  Bar,
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
   TRADE MARKER COMPONENT
========================================================= */
interface TradeMarkerProps {
  contract: ActiveContract
  colors: typeof THEMES.dark
}

const TradeMarker = ({ contract, colors }: TradeMarkerProps) => {
  if (!contract.entryTime || !contract.entryTick) return null

  // Entry Point
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

  // Exit Point & Line
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

  // If the contract is still open, just show the entry dot
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

const validateNumber = (val: any, fallback = 0): number => {
    const num = Number(val);
    return isFinite(num) ? num : fallback;
};

const SYNC_ID = 'market-chart-sync';

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
  const [zoomedData, setZoomedData] = React.useState<ChartData[] | null>(null);
  const colors = THEMES[chartTheme]
  
  const latestPrice =
    rawData.length > 0 && rawData[rawData.length - 1]
      ? validateNumber((rawData[rawData.length - 1]!).price, 0)
      : 0
  const prevPrice =
    rawData.length > 1 && rawData[rawData.length - 2]
      ? validateNumber((rawData[rawData.length - 2]!).price, 0)
      : latestPrice
      
  const chartDisplayData = zoomedData || rawData;

  const handleBrush = ({ startIndex, endIndex }: { startIndex?: number; endIndex?: number }) => {
    if (startIndex !== undefined && endIndex !== undefined) {
      const subset = rawData.slice(startIndex, endIndex + 1);
      setZoomedData(subset);
    } else {
      setZoomedData(null); // Reset zoom
    }
  };


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
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart
          data={chartDisplayData}
          margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
          onMouseMove={e => e?.activeLabel && setCursor(e.activeLabel)}
          onMouseLeave={() => setCursor(null)}
          syncId={SYNC_ID}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis 
            dataKey="epoch"
            type="number" 
            domain={['dataMin', 'dataMax']}
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

          {/* AREA / LINE CHART */}
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
          
           {activeContracts.map(contract => (
             <TradeMarker key={contract.contractId} contract={contract} colors={colors} />
           ))}
        
        </ComposedChart>
      </ResponsiveContainer>

       {/* --- BRUSH/ZOOM CHART --- */}
      <ResponsiveContainer width="100%" height="15%">
        <BarChart 
            data={rawData} 
            margin={{ top: 15, right: 0, left: 0, bottom: 0 }}
            syncId={SYNC_ID}
        >
          <XAxis hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip content={() => null} />
          <Bar dataKey="price" fill={colors.grid} isAnimationActive={false} />
          <Brush
            dataKey="epoch"
            height={30}
            stroke={colors.line}
            fill={`${colors.bg}80`}
            onChange={handleBrush as any}
            tickFormatter={(time) => new Date(time * 1000).toLocaleTimeString()}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
