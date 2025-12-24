

'use client'

import * as React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceLine,
  Line,
  Area,
  Bar,
} from 'recharts'
import {
  AreaChart,
  CandlestickChart,
  Clock,
  Minus,
  Moon,
  Plus,
  Sun,
  Waves,
} from 'lucide-react'

import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { cn } from '@/lib/utils'
import type {
  CandleData,
  ChartData,
  ActiveContract,
  TimePeriod,
  ChartType,
  TickData,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
import { CandleShape } from './chart-parts/candle-shape'
import { CustomTooltip } from './chart-parts/custom-tooltip'
import { THEMES } from './chart-parts/themes'

/* =========================================================
   COMPONENTE PRINCIPAL — MARKET CHART
========================================================= */

interface MarketChartProps {
  activeSymbol: string
  activeContracts: ActiveContract[]
  chartData: ChartData[]
  isChartLoading: boolean
  chartError: string | null
  chartType: ChartType
  setChartType: (type: ChartType) => void
  timePeriod: TimePeriod
  setTimePeriod: (period: TimePeriod) => void
  showBollingerBands: boolean;
  setShowBollingerBands: (show: boolean) => void;
  showSMA: boolean;
  setShowSMA: (show: boolean) => void;
  showEMA: boolean;
  setShowEMA: (show: boolean) => void;
  showVWAP: boolean;
  setShowVWAP: (show: boolean) => void;
  handleZoom: (direction: 'in' | 'out') => void
  zoomLevel: number,
  indicators: any;
}

export function MarketChart({
  activeSymbol,
  activeContracts,
  chartData: rawData,
  isChartLoading,
  chartError,
  chartType,
  setChartType,
  timePeriod,
  setTimePeriod,
  showBollingerBands,
  setShowBollingerBands,
  showSMA,
  setShowSMA,
  showEMA,
  setShowEMA,
  showVWAP,
  setShowVWAP,
  handleZoom,
  zoomLevel,
  indicators,
}: MarketChartProps) {
  // --- STATE & THEME ---
  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>('dark')
  const [cursor, setCursor] = React.useState<string | null>(null)
  const colors = THEMES[chartTheme]

  // --- INDICATORS & DATA PROCESSING ---
  const processedData = React.useMemo(() => {
    if (!rawData || rawData.length === 0 || chartType === 'Area') {
      return rawData
    }
    const candles = rawData as CandleData[]

    return candles.map((d, i) => {
      if (!d) return null; // Safety check
      return {
        ...d,
        sma: indicators.sma?.[i],
        ema: indicators.ema?.[i],
        vwap: indicators.vwap?.[i],
        bb: indicators.bollingerBands?.[i],
        volume: d.volume || 0,
      }
    }).filter(Boolean) as CandleData[];
  }, [rawData, chartType, indicators])

  const visibleData = React.useMemo(() => {
    if (processedData.length > zoomLevel) {
      return processedData.slice(processedData.length - zoomLevel);
    }
    return processedData;
  }, [processedData, zoomLevel]);

  // --- DYNAMIC Y-AXIS DOMAIN ---
  const yDomain = React.useMemo(() => {
    if (!visibleData || visibleData.length === 0) return ['auto', 'auto']
    const dataSlice = visibleData.filter(d => d) as CandleData[]
    if (dataSlice.length === 0) return ['auto', 'auto']
    
    const lows = dataSlice.map(d => d.low).filter((v): v is number => v != null)
    const highs = dataSlice.map(d => d.high).filter((v): v is number => v != null)
    if (lows.length === 0 || highs.length === 0) return ['auto', 'auto']

    const min = Math.min(...lows)
    const max = Math.max(...highs)
    const pad = (max - min) * 0.1
    return [min - pad, max + pad]
  }, [visibleData])

  const latestPrice =
    rawData.length > 0 && rawData[rawData.length - 1]
      ? 'price' in rawData[rawData.length - 1]!
        ? ((rawData[rawData.length - 1]!) as TickData).price
        : ((rawData[rawData.length - 1]!) as CandleData).close
      : 0
  const prevPrice =
    rawData.length > 1 && rawData[rawData.length - 2]
      ? 'price' in rawData[rawData.length - 2]!
        ? ((rawData[rawData.length - 2]!) as TickData).price
        : ((rawData[rawData.length - 2]!) as CandleData).close
      : latestPrice

  // --- LOADING & ERROR STATES ---
  if (isChartLoading && visibleData.length === 0) {
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
        handleZoom={handleZoom}
        showBollingerBands={showBollingerBands}
        setShowBollingerBands={setShowBollingerBands}
        showSMA={showSMA}
        setShowSMA={setShowSMA}
        showEMA={showEMA}
        setShowEMA={setShowEMA}
        showVWAP={showVWAP}
        setShowVWAP={setShowVWAP}
      />

      {/* --- MAIN PRICE CHART --- */}
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart
          data={visibleData}
          margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
          onMouseMove={e => e?.activeLabel && setCursor(e.activeLabel)}
          onMouseLeave={() => setCursor(null)}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis dataKey="epoch" tickFormatter={(time) => new Date(time * 1000).toLocaleTimeString()} stroke={colors.text} tick={{ fontSize: 10 }} domain={['dataMin', 'dataMax']} />
          <YAxis
            orientation="right"
            domain={yDomain}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
          />
          <Tooltip content={<CustomTooltip colors={colors} />} />

          {/* CROSSHAIR */}
          {cursor && (
            <ReferenceLine x={cursor} stroke={colors.crosshair} strokeDasharray="3 3" />
          )}

          {/* AREA / LINE CHART MODE */}
          {chartType === 'Area' && (
            <>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.areaTop} />
                  <stop offset="100%" stopColor={colors.areaBottom} />
                </linearGradient>
              </defs>
              <Area
                dataKey="price"
                fill="url(#areaGrad)"
                stroke="none"
                isAnimationActive={false}
              />
              <Line
                dataKey="price"
                stroke={colors.line}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </>
          )}

          {/* CANDLE CHART MODE */}
          {chartType === 'Candle' && (
            <Line
              dataKey="close" // Needs a key but we won't draw it
              stroke="transparent"
              isAnimationActive={false}
              dot={<CandleShape yAxisId={0} colors={colors} />}
            />
          )}

          {/* INDICATORS */}
          {chartType === 'Candle' && showSMA && (
            <Line
              dataKey="sma"
              stroke={colors.sma}
              dot={false}
              strokeWidth={1}
              isAnimationActive={false}
            />
          )}
          {chartType === 'Candle' && showEMA && (
            <Line
              dataKey="ema"
              stroke={colors.ema}
              dot={false}
              strokeWidth={1}
              isAnimationActive={false}
            />
          )}
          {chartType === 'Candle' && showVWAP && (
            <Line
              dataKey="vwap"
              stroke={colors.vwap}
              dot={false}
              strokeWidth={1}
              strokeDasharray="2 2"
              isAnimationActive={false}
            />
          )}
          {chartType === 'Candle' && showBollingerBands && (
             <>
                <defs>
                    <linearGradient id="bb-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.bbFill} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={colors.bbFill} stopOpacity={0} />
                    </linearGradient>
                 </defs>
                <Area dataKey="bb.upper" fill="url(#bb-gradient)" stroke="none" stackId="bollinger" isAnimationActive={false} />
                <Area dataKey="bb.lower" fill={colors.bg} stroke="none" stackId="bollinger" isAnimationActive={false} />
             </>
          )}


          {/* ZOOM/PAN BRUSH */}
          <Brush
            dataKey="epoch"
            height={20}
            stroke={colors.line}
            fill={`${colors.bg}80`}
            travellerWidth={10}
            tickFormatter={(time) => new Date(time * 1000).toLocaleTimeString()}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* --- VOLUME CHART --- */}
      <ResponsiveContainer width="100%" height="25%">
        <ComposedChart data={visibleData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
           <XAxis dataKey="epoch" hide />
           <YAxis
            orientation="right"
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={vol =>
              typeof vol === 'number' && vol > 1000 ? `${(vol / 1000).toFixed(1)}k` : vol
            }
          />
           <Tooltip content={<CustomTooltip colors={colors} />} />
          <Bar
            dataKey="volume"
            isAnimationActive={false}
            shape={(props: any) => {
               if(!props.payload) return null;
               const { payload } = props;
               const color = payload.close >= payload.open ? colors.bull : colors.bear;
               return <rect {...props} fill={`${color}80`} />;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
