
'use client'

import React from 'react'
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
  Bar,
} from 'recharts'
import { Flag, Settings } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme';
import type {
  ChartData,
  CandleData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
import { CustomTooltip } from './chart-parts/custom-tooltip'
import { CandleShape } from './chart-parts/candle-shape'
import { THEMES } from './chart-parts/themes'
import type { Operation } from '@/components/trading/operations-log.types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '../ui/button'


const EntryMarker = (props: any) => {
  const { cx, cy, payload } = props
  
  if (!cx || !cy || !payload) return null

  const direction = payload.direction
  const status = payload.status
  
  let ENTRY_COLOR = '#3b82f6' // Blue for pending
  if (status === 'won') {
    ENTRY_COLOR = '#22c55e' // Green for win
  } else if (status === 'lost') {
    ENTRY_COLOR = '#ef4444' // Red for loss
  }

  return (
    <g transform={`translate(${cx}, ${cy})`}>
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
  
  if (!cx || !cy || !payload) return null

  const status = payload.status
  const isWin = status === 'won'
  const flagColor = isWin ? '#22c55e' : '#ef4444'

  return (
    <g transform={`translate(${cx - 10}, ${cy - 22})`}>
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
  indicators: {
    sma: (number | null)[];
    ema: (number | null)[];
    vwap: (number | null)[];
    bollingerBands: ({ upper: number; middle: number; lower: number } | null)[];
  }
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
  indicators,
}: MarketChartProps) {
  const { theme: appTheme } = useTheme();
  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>(appTheme.includes('dark') ? 'dark' : 'light');
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [showIndicators, setShowIndicators] = React.useState({
    sma: false,
    ema: false,
    vwap: false,
    bollingerBands: false,
  });

  const colors = THEMES[chartTheme];
  const latestPrice = rawData.length > 0 ? rawData[rawData.length - 1]!.price : 0
  const prevPrice = rawData.length > 1 ? rawData[rawData.length - 2]!.price : latestPrice
  
  const yDomain = React.useMemo(() => {
    if (rawData.length === 0) return ['auto', 'auto'];

    const prices = rawData.map(d => 'high' in d ? [d.high, d.low] : d.price).flat();
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.15;
    return [minPrice - padding, maxPrice + padding];
  }, [rawData]);

  const visibleOperations = React.useMemo(() => {
    if (!Array.isArray(operations)) return []
    return operations
  }, [operations])

  const { entryPoints, exitPoints, operationLines } = React.useMemo(() => {
    const entries: any[] = []
    const exits: any[] = []
    const lines: any[] = []

    visibleOperations.forEach(op => {
      if (!op.timestamp) return

      const entryEpoch = Math.floor(new Date(op.timestamp).getTime() / 1000)
      
      let entryPrice = op.entryPrice
      if (!entryPrice && rawData.length > 0) {
        const closestPoint = rawData.reduce((prev, curr) => {
          const prevDiff = Math.abs(prev.epoch - entryEpoch)
          const currDiff = Math.abs(curr.epoch - entryEpoch)
          return currDiff < prevDiff ? curr : prev
        })
        if (Math.abs(closestPoint.epoch - entryEpoch) <= 10) {
          entryPrice = closestPoint.price
        }
      }
      
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

      entries.push({
        x: entryEpoch,
        y: entryPrice,
        direction: op.direction,
        status: op.status,
        id: op.id,
      })

      const isPending = op.status === 'pending'
      
      if (isPending) {
        const currentPoint = rawData.length > 0 ? rawData[rawData.length - 1] : null
        if (currentPoint) {
          const currentEpoch = Math.min(exitEpoch, currentPoint.epoch)
          const currentPrice = currentPoint.price

          lines.push({
            id: op.id,
            isPending: true,
            segment: [
              { x: entryEpoch, y: entryPrice },
              { x: currentEpoch, y: currentPrice },
            ],
          })
        }
      } else if (op.exitPrice && op.exitPrice > 0) {
        lines.push({
          id: op.id,
          isPending: false,
          status: op.status,
          segment: [
            { x: entryEpoch, y: entryPrice },
            { x: exitEpoch, y: op.exitPrice },
          ],
        })

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
  }, [visibleOperations, rawData]);

  const augmentedData = React.useMemo(() => {
    return rawData.map((d, i) => ({
      ...d,
      sma: indicators.sma[i],
      ema: indicators.ema[i],
      vwap: indicators.vwap[i],
      bb: indicators.bollingerBands[i],
    }));
  }, [rawData, indicators]);

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
      
      <div className="mb-2 flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Settings size={14} /> Indicadores
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Indicadores Técnicos</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={showIndicators.sma}
              onCheckedChange={(checked) => setShowIndicators(s => ({ ...s, sma: checked }))}
            >
              Média Móvel Simples (SMA)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showIndicators.ema}
              onCheckedChange={(checked) => setShowIndicators(s => ({ ...s, ema: checked }))}
            >
              Média Móvel Exponencial (EMA)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showIndicators.vwap}
              onCheckedChange={(checked) => setShowIndicators(s => ({ ...s, vwap: checked }))}
            >
              Preço Médio Ponderado por Volume (VWAP)
            </DropdownMenuCheckboxItem>
             <DropdownMenuCheckboxItem
              checked={showIndicators.bollingerBands}
              onCheckedChange={(checked) => setShowIndicators(s => ({ ...s, bollingerBands: checked }))}
            >
              Bandas de Bollinger
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ResponsiveContainer width="100%" height="80%">
        <ComposedChart
          data={augmentedData}
          margin={{ top: 5, right: 50, left: 0, bottom: 20 }}
          onMouseMove={e => e?.activeLabel && setCursor(e.activeLabel)}
          onMouseLeave={() => setCursor(null)}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />

          <XAxis
            dataKey="epoch"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={time => new Date(time * 1000).toLocaleTimeString()}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
          />

          <YAxis
            yAxisId="price"
            orientation="right"
            domain={yDomain}
            stroke={colors.text}
            tick={{ fontSize: 10 }}
            tickFormatter={val => typeof val === 'number' ? val.toFixed(4) : ''}
          />
          
          <Tooltip
            content={<CustomTooltip colors={colors} />}
            cursor={{ stroke: colors.crosshair, strokeDasharray: '3 3' }}
          />

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
            />
          ))}

          {chartType === 'Area' && (
            <>
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
                activeDot={{ r: 4, fill: colors.line }}
                isAnimationActive={false}
              />
            </>
          )}

          {chartType === 'Candle' && (
            <Bar
              yAxisId="price"
              dataKey="price"
              isAnimationActive={false}
              shape={<CandleShape colors={colors} />}
            />
          )}

          {cursor && (
            <ReferenceLine
              x={cursor as any}
              stroke={colors.crosshair}
              strokeDasharray="3 3"
              yAxisId="price"
            />
          )}

          {entryPoints.length > 0 && (
            <Scatter
              yAxisId="price"
              dataKey="y"
              data={entryPoints}
              shape={<EntryMarker />}
              isAnimationActive={false}
              fill="transparent"
            />
          )}

          {exitPoints.length > 0 && (
            <Scatter
              yAxisId="price"
              dataKey="y"
              data={exitPoints}
              shape={<ExitMarker />}
              isAnimationActive={false}
              fill="transparent"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
