
'use client'

import React from 'react'
import {
  Flag,
  Settings,
  Loader2,
  TrendingUp,
  TrendingDown,
  AreaChart,
  CandlestickChart,
  Clock,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme as useAppTheme } from '@/hooks/use-theme'
import type {
  ChartData,
  CandleData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
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
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

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
    sma: (number | null)[]
    ema: (number | null)[]
    vwap: (number | null)[]
    bollingerBands: ({ upper: number; middle: number; lower: number } | null)[]
  }
}

const Y_AXIS_WIDTH = 80
const PADDING = { top: 20, right: Y_AXIS_WIDTH, bottom: 40, left: 10 }
const BRUSH_HEIGHT = 60

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
  const { theme: appTheme } = useAppTheme()
  const mainCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const brushCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>(
    appTheme.includes('dark') ? 'dark' : 'light'
  )
  const colors = THEMES[chartTheme]

  const [visibleIndicators, setVisibleIndicators] = React.useState({
    sma: false,
    ema: false,
    vwap: false,
    bb: false,
  })

  // State Refs for interactivity
  const isDraggingRef = React.useRef(false)
  const brushRef = React.useRef({
    isBrushing: false,
    isDragging: false,
    startX: 0,
    currentMin: 0, // in %
    currentMax: 1, // in %
  })

  const isCandle = (d: ChartData): d is CandleData =>
    'open' in d && d.open !== undefined

  const timePeriods: TimePeriod[] = [
    '1m',
    '2m',
    '3m',
    '5m',
    '10m',
    '15m',
    '30m',
    '1h',
    '8h',
    '1d',
  ]

  const change =
    rawData.length > 1
      ? rawData[rawData.length - 1]!.price - rawData[rawData.length - 2]!.price
      : 0
  const prevPrice =
    rawData.length > 1 ? rawData[rawData.length - 2]!.price : 1
  const changePercent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0
  const isPositive = change >= 0

  // Memoize data window calculation
  const dataWindow = React.useMemo(() => {
    const start = Math.floor(rawData.length * brushRef.current.currentMin)
    const end = Math.ceil(rawData.length * brushRef.current.currentMax)
    return { start, end }
  }, [rawData.length, brushRef.current.currentMin, brushRef.current.currentMax])

  const visibleData = React.useMemo(
    () => rawData.slice(dataWindow.start, dataWindow.end),
    [rawData, dataWindow]
  )
  const slicedIndicators = React.useMemo(() => {
    return {
        sma: indicators.sma.slice(dataWindow.start, dataWindow.end),
        ema: indicators.ema.slice(dataWindow.start, dataWindow.end),
        vwap: indicators.vwap.slice(dataWindow.start, dataWindow.end),
        bollingerBands: indicators.bollingerBands.slice(dataWindow.start, dataWindow.end),
    }
  }, [indicators, dataWindow]);


  const drawLineIndicator = React.useCallback((ctx: CanvasRenderingContext2D, indicatorData: (number | null)[], color: string, getY: (price: number) => number, getX: (index: number) => number) => {
    ctx.beginPath();
    let firstPoint = true;
    indicatorData.forEach((val, i) => {
        if (val === null) return;
        const x = getX(i);
        const y = getY(val);
        if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }, []);

  const drawBollingerBands = React.useCallback((ctx: CanvasRenderingContext2D, bbData: ({ upper: number; middle: number; lower: number } | null)[], color: string, getY: (price: number) => number, getX: (index: number) => number) => {
      const pathUpper = new Path2D();
      const pathLower = new Path2D();
      let firstUpper = true, firstLower = true;
      
      bbData.forEach((d, i) => {
          if (!d) return;
          const x = getX(i);
          if (firstUpper) { pathUpper.moveTo(x, getY(d.upper)); firstUpper = false; }
          else { pathUpper.lineTo(x, getY(d.upper)); }
          
          if (firstLower) { pathLower.moveTo(x, getY(d.lower)); firstLower = false; }
          else { pathLower.lineTo(x, getY(d.lower)); }
      });
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke(pathUpper);
      ctx.stroke(pathLower);
      
      // Create the fill path
      const fillPath = new Path2D(pathUpper);
      const reversedLower = [...bbData].reverse();
      const reversedIndices = [...Array(bbData.length).keys()].reverse();

      for(let i = 0; i < reversedLower.length; i++) {
          const d = reversedLower[i];
          const index = reversedIndices[i];
          if(d) {
              fillPath.lineTo(getX(index), getY(d.lower));
          }
      }
      fillPath.closePath();
      
      ctx.fillStyle = colors.bbFill;
      ctx.fill(fillPath);

  }, [colors.bbFill]);

  const drawMainChart = React.useCallback(() => {
    const canvas = mainCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container || visibleData.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    const width = rect.width
    const height = rect.height
    const chartHeight = height - PADDING.top - PADDING.bottom

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    let minPrice = Infinity
    let maxPrice = -Infinity
    visibleData.forEach((d, i) => {
      const pricePoints: (number | null)[] = [];
      if (isCandle(d)) {
        pricePoints.push(d.low, d.high);
      } else {
        pricePoints.push(d.price);
      }
      if (slicedIndicators.sma[i]) pricePoints.push(slicedIndicators.sma[i]);
      if (slicedIndicators.ema[i]) pricePoints.push(slicedIndicators.ema[i]);
      if (slicedIndicators.vwap[i]) pricePoints.push(slicedIndicators.vwap[i]);
      if (slicedIndicators.bollingerBands[i]) pricePoints.push(slicedIndicators.bollingerBands[i]!.upper, slicedIndicators.bollingerBands[i]!.lower);
      
      minPrice = Math.min(minPrice, ...pricePoints.filter(p => p !== null) as number[]);
      maxPrice = Math.max(maxPrice, ...pricePoints.filter(p => p !== null) as number[]);
    })

    const priceRange = maxPrice - minPrice || 1
    const pricePadding = priceRange * 0.1
    minPrice -= pricePadding
    maxPrice += pricePadding

    const getY = (price: number) =>
      PADDING.top +
      chartHeight -
      ((price - minPrice) / (maxPrice - minPrice)) * chartHeight
    const getX = (index: number) =>
      PADDING.left + (index / (visibleData.length - 1)) * (width - PADDING.left - PADDING.right);

    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 0.5
    ctx.font = '10px sans-serif'
    ctx.fillStyle = colors.text
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = PADDING.top + (chartHeight / gridLines) * i
      ctx.beginPath()
      ctx.moveTo(PADDING.left, y)
      ctx.lineTo(width - PADDING.right, y)
      ctx.stroke()
      const price = maxPrice - (i / gridLines) * (maxPrice - minPrice)
      ctx.fillText(price.toFixed(4), width - PADDING.right + 5, y + 3)
    }

    const labelCount = Math.floor((width - PADDING.left - PADDING.right) / 100)
    const labelInterval = Math.max(1, Math.floor(visibleData.length / labelCount))
    for (let i = 0; i < visibleData.length; i += labelInterval) {
      const x = getX(i)
      const date = new Date(visibleData[i].epoch * 1000)
      const timeString = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
      ctx.fillText(timeString, x, height - PADDING.bottom + 15)
    }

    // Draw Chart Data
    if (chartType === 'Candle') {
      const candleWidth =
        Math.max(2, (width - PADDING.left - PADDING.right) / visibleData.length) * 0.7
      visibleData.forEach((d, i) => {
        if (!isCandle(d)) return
        const x = getX(i)
        const openY = getY(d.open)
        const closeY = getY(d.close)
        const highY = getY(d.high)
        const lowY = getY(d.low)

        const isBullish = d.close >= d.open
        ctx.strokeStyle = isBullish ? colors.bull : colors.bear
        ctx.fillStyle = isBullish ? colors.bull : colors.bear

        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, highY)
        ctx.lineTo(x, lowY)
        ctx.stroke()

        const bodyHeight = Math.max(1, Math.abs(openY - closeY))
        ctx.fillRect(
          x - candleWidth / 2,
          Math.min(openY, closeY),
          candleWidth,
          bodyHeight
        )
      })
    } else {
      // Area
      ctx.beginPath()
      visibleData.forEach((d, i) => {
        const x = getX(i)
        const y = getY(d.price)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 2
      ctx.stroke()

      const gradient = ctx.createLinearGradient(
        0,
        PADDING.top,
        0,
        height - PADDING.bottom
      )
      gradient.addColorStop(0, colors.areaTop)
      gradient.addColorStop(1, colors.areaBottom)
      ctx.fillStyle = gradient
      ctx.lineTo(getX(visibleData.length - 1), height - PADDING.bottom)
      ctx.lineTo(getX(0), height - PADDING.bottom)
      ctx.closePath()
      ctx.fill()
    }
    
    // Draw Indicators
    if (visibleIndicators.sma) drawLineIndicator(ctx, slicedIndicators.sma, colors.sma, getY, getX);
    if (visibleIndicators.ema) drawLineIndicator(ctx, slicedIndicators.ema, colors.ema, getY, getX);
    if (visibleIndicators.vwap) drawLineIndicator(ctx, slicedIndicators.vwap, colors.vwap, getY, getX);
    if (visibleIndicators.bb) drawBollingerBands(ctx, slicedIndicators.bollingerBands, colors.line, getY, getX);


    // Draw operations
    operations.forEach(op => {
      if (!op.entryPrice) return
      const entryEpoch = new Date(op.timestamp).getTime() / 1000

      if (
        entryEpoch < visibleData[0]?.epoch ||
        entryEpoch > visibleData[visibleData.length - 1]?.epoch
      ) {
        return // Don't draw operations outside the visible window
      }

      let entryDataIndex = -1
      let minDiff = Infinity
      visibleData.forEach((d, i) => {
        const diff = Math.abs(d.epoch - entryEpoch)
        if (diff < minDiff) {
          minDiff = diff
          entryDataIndex = i
        }
      })

      if (entryDataIndex === -1) return

      const entryX = getX(entryDataIndex)
      const entryY = getY(op.entryPrice)

      let statusColor = '#3b82f6' // Blue for pending
      if (op.status === 'won') statusColor = colors.bull
      else if (op.status === 'lost') statusColor = colors.bear

      ctx.beginPath()
      ctx.arc(entryX, entryY, 6, 0, 2 * Math.PI)
      ctx.fillStyle = statusColor
      ctx.fill()
      ctx.strokeStyle = colors.bg
      ctx.lineWidth = 2
      ctx.stroke()

      if (op.exitPrice && op.status !== 'pending') {
        let durationInSeconds = 0
        switch (op.durationUnit) {
          case 't':
            durationInSeconds = op.duration * 2
            break // Approximate
          case 's':
            durationInSeconds = op.duration
            break
          case 'm':
            durationInSeconds = op.duration * 60
            break
          case 'h':
            durationInSeconds = op.duration * 3600
            break
          case 'd':
            durationInSeconds = op.duration * 86400
            break
        }
        const exitEpoch = entryEpoch + durationInSeconds

        let exitDataIndex = -1
        let minExitDiff = Infinity
        visibleData.forEach((d, i) => {
          const diff = Math.abs(d.epoch - exitEpoch)
          if (diff < minExitDiff) {
            minExitDiff = diff
            exitDataIndex = i
          }
        })

        if (exitDataIndex !== -1 && exitDataIndex < visibleData.length) {
          const exitX = getX(exitDataIndex)
          const exitY = getY(op.exitPrice)

          ctx.beginPath()
          ctx.moveTo(entryX, entryY)
          ctx.lineTo(exitX, exitY)
          ctx.strokeStyle = statusColor
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    })
  }, [visibleData, colors, chartType, operations, drawLineIndicator, drawBollingerBands, slicedIndicators, visibleIndicators])

  const drawBrushChart = React.useCallback(() => {
    const canvas = brushCanvasRef.current
    if (!canvas || rawData.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    const width = rect.width
    const height = rect.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    let minPrice = Infinity
    let maxPrice = -Infinity
    rawData.forEach(d => {
      minPrice = Math.min(minPrice, d.price)
      maxPrice = Math.max(maxPrice, d.price)
    })

    const priceRange = maxPrice - minPrice || 1
    const getY = (price: number) =>
      height - ((price - minPrice) / priceRange) * height
    const getX = (index: number) => (index / (rawData.length - 1)) * width

    ctx.beginPath()
    rawData.forEach((d, i) => {
      const x = getX(i)
      const y = getY(d.price)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    // Draw brush window
    const brushMinX = width * brushRef.current.currentMin
    const brushMaxX = width * brushRef.current.currentMax
    ctx.fillStyle = 'rgba(100, 120, 150, 0.2)'
    ctx.fillRect(brushMinX, 0, brushMaxX - brushMinX, height)
    ctx.strokeStyle = 'rgba(150, 180, 220, 0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(brushMinX, 0, brushMaxX - brushMinX, height)
  }, [rawData, colors])

  // Reset pan/zoom on context change
  React.useEffect(() => {
    brushRef.current = {
      isBrushing: false, isDragging: false, startX: 0,
      currentMin: 0, currentMax: 1,
    };
    const mainChartAF = requestAnimationFrame(drawMainChart);
    const brushChartAF = requestAnimationFrame(drawBrushChart);
    return () => {
      cancelAnimationFrame(mainChartAF);
      cancelAnimationFrame(brushChartAF);
    }
  }, [activeSymbol, timePeriod, chartType, drawMainChart, drawBrushChart]);

  // Redraw charts when data or dependencies change.
  React.useEffect(() => {
    const handleResize = () => {
        requestAnimationFrame(drawMainChart);
        requestAnimationFrame(drawBrushChart);
    };
    window.addEventListener('resize', handleResize);

    const mainChartAF = requestAnimationFrame(drawMainChart);
    const brushChartAF = requestAnimationFrame(drawBrushChart);

    return () => {
        cancelAnimationFrame(mainChartAF);
        cancelAnimationFrame(brushChartAF);
        window.removeEventListener('resize', handleResize);
    }
  }, [rawData, colors, drawMainChart, drawBrushChart]);


  const handleBrushMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pos = x / rect.width

    const handleWidth = 10 / rect.width
    const minHandleX = rect.width * brushRef.current.currentMin
    const maxHandleX = rect.width * brushRef.current.currentMax

    if (x > minHandleX + 5 && x < maxHandleX - 5) {
      brushRef.current.isDragging = true
    } else {
      brushRef.current.isBrushing = true
    }
    brushRef.current.startX = pos
  }

  const handleBrushMouseMove = (e: React.MouseEvent) => {
    if (!brushRef.current.isBrushing && !brushRef.current.isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pos = Math.max(0, Math.min(1, x / rect.width))

    if (brushRef.current.isDragging) {
      const delta = pos - brushRef.current.startX
      const width =
        brushRef.current.currentMax - brushRef.current.currentMin
      brushRef.current.currentMin = Math.max(
        0,
        brushRef.current.currentMin + delta
      )
      brushRef.current.currentMax = Math.min(
        1,
        brushRef.current.currentMin + width
      )
      if (brushRef.current.currentMin + width > 1) {
        brushRef.current.currentMin = 1 - width
      }
    } else {
      brushRef.current.currentMin = Math.min(pos, brushRef.current.startX)
      brushRef.current.currentMax = Math.max(pos, brushRef.current.startX)
    }

    brushRef.current.startX = pos
    requestAnimationFrame(drawBrushChart)
    requestAnimationFrame(drawMainChart)
  }

  const handleBrushMouseUp = () => {
    brushRef.current.isBrushing = false
    brushRef.current.isDragging = false
  }
  
  const clearOperations = () => {
      // This is a placeholder. The actual implementation is in deriv-trader page.
      // This button is just for UI. The logic is passed via props.
  };

  return (
    <div
      className="h-[520px] w-full rounded-xl p-4 relative flex flex-col"
      style={{ backgroundColor: colors.bg }}
      ref={containerRef}
    >
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ color: colors.text }}>
            {activeSymbol}
          </h2>
          <div
            className="flex items-center gap-2"
            style={{ color: isPositive ? colors.bull : colors.bear }}
          >
            <span className="font-semibold text-lg">
              {rawData.length > 0
                ? rawData[rawData.length - 1]!.price.toFixed(4)
                : '...'}
            </span>
            <div className="text-xs font-mono flex items-center">
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>
                {change.toFixed(4)} ({changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Settings size={14} /> Indicadores
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Médias Móveis</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={visibleIndicators.sma}
                onCheckedChange={() => setVisibleIndicators(p => ({...p, sma: !p.sma}))}
              >
                SMA
              </DropdownMenuCheckboxItem>
               <DropdownMenuCheckboxItem
                checked={visibleIndicators.ema}
                onCheckedChange={() => setVisibleIndicators(p => ({...p, ema: !p.ema}))}
              >
                EMA
              </DropdownMenuCheckboxItem>
               <DropdownMenuCheckboxItem
                checked={visibleIndicators.vwap}
                onCheckedChange={() => setVisibleIndicators(p => ({...p, vwap: !p.vwap}))}
              >
                VWAP
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
               <DropdownMenuLabel>Bandas</DropdownMenuLabel>
               <DropdownMenuCheckboxItem
                checked={visibleIndicators.bb}
                onCheckedChange={() => setVisibleIndicators(p => ({...p, bb: !p.bb}))}
              >
                Bandas de Bollinger
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToggleGroup
            type="single"
            value={chartType}
            onValueChange={(value: ChartType) => value && setChartType(value)}
            aria-label="Tipo de Gráfico"
          >
            <ToggleGroupItem value="Area" aria-label="Gráfico de Área">
              <AreaChart size={16} />
            </ToggleGroupItem>
            <ToggleGroupItem value="Candle" aria-label="Gráfico de Velas">
              <CandlestickChart size={16} />
            </ToggleGroupItem>
          </ToggleGroup>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-[70px] text-xs flex items-center gap-1"
              >
                <Clock size={14} />
                {timePeriod.toUpperCase()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1">
              <div className="grid grid-cols-5 gap-1">
                {timePeriods.map(period => (
                  <Button
                    key={period}
                    variant={timePeriod === period ? 'default' : 'ghost'}
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setTimePeriod(period)}
                  >
                    {period.toUpperCase()}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() =>
              setChartTheme(chartTheme === 'dark' ? 'light' : 'dark')
            }
          >
            {chartTheme === 'dark' ? (
              <Sun size={16} />
            ) : (
              <Moon size={16} />
            )}
          </Button>
        </div>
      </div>

      <div
        className="w-full flex-1 relative"
        style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
      >
        {isChartLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
        {chartError && !isChartLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 z-10 text-white p-4 text-center">
            {chartError}
          </div>
        )}
        <canvas
          ref={mainCanvasRef}
          className="w-full h-full"
          onMouseDown={e => {
            isDraggingRef.current = true
          }}
          onMouseMove={e => {
            if (!isDraggingRef.current) return
            // Pan logic can be added here if desired, using panOffsetRef
          }}
          onMouseUp={() => (isDraggingRef.current = false)}
          onMouseLeave={() => (isDraggingRef.current = false)}
        />
      </div>
      <div className="w-full h-[60px] mt-2">
        <canvas
          ref={brushCanvasRef}
          className="w-full h-full cursor-ew-resize"
          onMouseDown={handleBrushMouseDown}
          onMouseMove={handleBrushMouseMove}
          onMouseUp={handleBrushMouseUp}
          onMouseLeave={handleBrushMouseUp}
        />
      </div>
    </div>
  )
}
