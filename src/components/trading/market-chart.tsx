
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
const MIN_CANDLE_WIDTH = 1
const MAX_CANDLE_WIDTH = 20

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

  // FIX: Usar state para forçar re-render quando brush muda
  const [brushWindow, setBrushWindow] = React.useState({
    min: 0,
    max: 1,
  })

  const isDraggingRef = React.useRef(false)
  const brushRef = React.useRef({
    isBrushing: false,
    isDragging: false,
    startX: 0,
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

  // FIX: Agora dataWindow reage às mudanças do brushWindow state
  const dataWindow = React.useMemo(() => {
    const start = Math.floor(rawData.length * brushWindow.min)
    const end = Math.ceil(rawData.length * brushWindow.max)
    return { start, end }
  }, [rawData.length, brushWindow.min, brushWindow.max])

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
  }, [indicators, dataWindow])

  const drawLineIndicator = React.useCallback(
    (
      ctx: CanvasRenderingContext2D,
      indicatorData: (number | null)[],
      color: string,
      getY: (price: number) => number,
      getX: (index: number) => number
    ) => {
      ctx.beginPath()
      let firstPoint = true
      indicatorData.forEach((val, i) => {
        if (val === null) return
        const x = getX(i)
        const y = getY(val)
        if (firstPoint) {
          ctx.moveTo(x, y)
          firstPoint = false
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.stroke()
    },
    []
  )

  // FIX: Bollinger Bands - algoritmo corrigido
  const drawBollingerBands = React.useCallback(
    (
      ctx: CanvasRenderingContext2D,
      bbData: ({ upper: number; middle: number; lower: number } | null)[],
      color: string,
      getY: (price: number) => number,
      getX: (index: number) => number
    ) => {
      // Desenhar linha do meio
      ctx.beginPath()
      let firstMiddle = true
      bbData.forEach((d, i) => {
        if (!d) return
        const x = getX(i)
        const y = getY(d.middle)
        if (firstMiddle) {
          ctx.moveTo(x, y)
          firstMiddle = false
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.setLineDash([4, 2])
      ctx.stroke()
      ctx.setLineDash([])

      // Desenhar bandas superior e inferior
      const upperPath = new Path2D()
      const lowerPath = new Path2D()
      let firstUpper = true
      let firstLower = true

      bbData.forEach((d, i) => {
        if (!d) return
        const x = getX(i)
        if (firstUpper) {
          upperPath.moveTo(x, getY(d.upper))
          firstUpper = false
        } else {
          upperPath.lineTo(x, getY(d.upper))
        }

        if (firstLower) {
          lowerPath.moveTo(x, getY(d.lower))
          firstLower = false
        } else {
          lowerPath.lineTo(x, getY(d.lower))
        }
      })

      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.stroke(upperPath)
      ctx.stroke(lowerPath)

      // FIX: Criar área preenchida corretamente
      const fillPath = new Path2D()
      let firstFill = true

      // Desenhar banda superior da esquerda para direita
      bbData.forEach((d, i) => {
        if (!d) return
        const x = getX(i)
        const y = getY(d.upper)
        if (firstFill) {
          fillPath.moveTo(x, y)
          firstFill = false
        } else {
          fillPath.lineTo(x, y)
        }
      })

      // Desenhar banda inferior da direita para esquerda
      for (let i = bbData.length - 1; i >= 0; i--) {
        const d = bbData[i]
        if (!d) continue
        const x = getX(i)
        const y = getY(d.lower)
        fillPath.lineTo(x, y)
      }

      fillPath.closePath()
      ctx.fillStyle = colors.bbFill
      ctx.fill(fillPath)
    },
    [colors.bbFill]
  )

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

    // Calcular min/max price incluindo indicadores
    let minPrice = Infinity
    let maxPrice = -Infinity
    visibleData.forEach((d, i) => {
      const pricePoints: (number | null)[] = []
      if (isCandle(d)) {
        pricePoints.push(d.low, d.high)
      } else {
        pricePoints.push(d.price)
      }
      if (visibleIndicators.sma && slicedIndicators.sma[i])
        pricePoints.push(slicedIndicators.sma[i])
      if (visibleIndicators.ema && slicedIndicators.ema[i])
        pricePoints.push(slicedIndicators.ema[i])
      if (visibleIndicators.vwap && slicedIndicators.vwap[i])
        pricePoints.push(slicedIndicators.vwap[i])
      if (visibleIndicators.bb && slicedIndicators.bollingerBands[i]) {
        pricePoints.push(
          slicedIndicators.bollingerBands[i]!.upper,
          slicedIndicators.bollingerBands[i]!.lower
        )
      }

      const validPrices = pricePoints.filter(p => p !== null) as number[]
      minPrice = Math.min(minPrice, ...validPrices)
      maxPrice = Math.max(maxPrice, ...validPrices)
    })

    const priceRange = maxPrice - minPrice || 1
    const pricePadding = priceRange * 0.1
    minPrice -= pricePadding
    maxPrice += pricePadding

    const getY = (price: number) =>
      PADDING.top +
      chartHeight -
      ((price - minPrice) / (maxPrice - minPrice)) * chartHeight

    const getX = (index: number) => {
      if (visibleData.length === 1) return width / 2
      return (
        PADDING.left +
        (index / (visibleData.length - 1)) *
          (width - PADDING.left - PADDING.right)
      )
    }

    // Desenhar grid
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

    // Desenhar labels de tempo
    const labelCount = Math.floor((width - PADDING.left - PADDING.right) / 100)
    const labelInterval = Math.max(
      1,
      Math.floor(visibleData.length / labelCount)
    )
    for (let i = 0; i < visibleData.length; i += labelInterval) {
      const x = getX(i)
      const date = new Date(visibleData[i].epoch * 1000)
      const timeString = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
      ctx.fillText(timeString, x, height - PADDING.bottom + 15)
    }

    // FIX: Melhor cálculo da largura das velas
    if (chartType === 'Candle') {
      const availableWidth = width - PADDING.left - PADDING.right
      const spacing = availableWidth / Math.max(1, visibleData.length)
      const candleWidth = Math.max(
        MIN_CANDLE_WIDTH,
        Math.min(MAX_CANDLE_WIDTH, spacing * 0.7)
      )

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

        // Desenhar pavio
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, highY)
        ctx.lineTo(x, lowY)
        ctx.stroke()

        // Desenhar corpo
        const bodyHeight = Math.max(1, Math.abs(openY - closeY))
        ctx.fillRect(
          x - candleWidth / 2,
          Math.min(openY, closeY),
          candleWidth,
          bodyHeight
        )
      })
    } else {
      // Area Chart
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

      // Área com gradiente
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

    // Desenhar Indicadores
    if (visibleIndicators.bb)
      drawBollingerBands(ctx, slicedIndicators.bollingerBands, colors.line, getY, getX)
    if (visibleIndicators.sma)
      drawLineIndicator(ctx, slicedIndicators.sma, colors.sma, getY, getX)
    if (visibleIndicators.ema)
      drawLineIndicator(ctx, slicedIndicators.ema, colors.ema, getY, getX)
    if (visibleIndicators.vwap)
      drawLineIndicator(ctx, slicedIndicators.vwap, colors.vwap, getY, getX)

    // Desenhar operações
    operations.forEach(op => {
      if (!op.entryPrice) return
      const entryEpoch = new Date(op.timestamp).getTime() / 1000

      if (
        visibleData.length > 0 &&
        (entryEpoch < visibleData[0]?.epoch ||
          entryEpoch > visibleData[visibleData.length - 1]?.epoch)
      ) {
        return
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

      let statusColor = '#3b82f6'
      if (op.status === 'won') statusColor = colors.bull
      else if (op.status === 'lost') statusColor = colors.bear

      // Desenhar círculo de entrada
      ctx.beginPath()
      ctx.arc(entryX, entryY, 6, 0, 2 * Math.PI)
      ctx.fillStyle = statusColor
      ctx.fill()
      ctx.strokeStyle = colors.bg
      ctx.lineWidth = 2
      ctx.stroke()

      // Desenhar linha até saída
      if (op.exitPrice && op.status !== 'pending') {
        let durationInSeconds = 0
        switch (op.durationUnit) {
          case 't':
            durationInSeconds = op.duration * 2
            break
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
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.stroke()
          ctx.setLineDash([])

          // Desenhar círculo de saída
          ctx.beginPath()
          ctx.arc(exitX, exitY, 4, 0, 2 * Math.PI)
          ctx.fillStyle = statusColor
          ctx.fill()
          ctx.strokeStyle = colors.bg
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    })
  }, [
    visibleData,
    colors,
    chartType,
    operations,
    drawLineIndicator,
    drawBollingerBands,
    slicedIndicators,
    visibleIndicators,
  ])

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
      if (isCandle(d)) {
        minPrice = Math.min(minPrice, d.low)
        maxPrice = Math.max(maxPrice, d.high)
      } else {
        minPrice = Math.min(minPrice, d.price)
        maxPrice = Math.max(maxPrice, d.price)
      }
    })

    const priceRange = maxPrice - minPrice || 1
    const getY = (price: number) =>
      height - ((price - minPrice) / priceRange) * height
    const getX = (index: number) => (index / (rawData.length - 1)) * width

    // Desenhar linha de preços
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

    // Desenhar janela de seleção
    const brushMinX = width * brushWindow.min
    const brushMaxX = width * brushWindow.max
    
    // Área escurecida fora da seleção
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, brushMinX, height)
    ctx.fillRect(brushMaxX, 0, width - brushMaxX, height)
    
    // Área selecionada
    ctx.fillStyle = 'rgba(100, 150, 250, 0.1)'
    ctx.fillRect(brushMinX, 0, brushMaxX - brushMinX, height)
    
    // Bordas da seleção
    ctx.strokeStyle = colors.line
    ctx.lineWidth = 2
    ctx.strokeRect(brushMinX, 0, brushMaxX - brushMinX, height)
    
    // Handles (alças) para arrastar
    const handleWidth = 8
    ctx.fillStyle = colors.line
    ctx.fillRect(brushMinX - handleWidth / 2, height / 2 - 15, handleWidth, 30)
    ctx.fillRect(brushMaxX - handleWidth / 2, height / 2 - 15, handleWidth, 30)
  }, [rawData, colors, brushWindow, isCandle])

  // Reset ao mudar contexto
  React.useEffect(() => {
    setBrushWindow({ min: 0, max: 1 })
    const mainChartAF = requestAnimationFrame(drawMainChart)
    const brushChartAF = requestAnimationFrame(drawBrushChart)
    return () => {
      cancelAnimationFrame(mainChartAF)
      cancelAnimationFrame(brushChartAF)
    }
  }, [activeSymbol, timePeriod, chartType, drawMainChart, drawBrushChart])

  // Redesenhar quando dados mudam
  React.useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(drawMainChart)
      requestAnimationFrame(drawBrushChart)
    }
    window.addEventListener('resize', handleResize)

    const mainChartAF = requestAnimationFrame(drawMainChart)
    const brushChartAF = requestAnimationFrame(drawBrushChart)

    return () => {
      cancelAnimationFrame(mainChartAF)
      cancelAnimationFrame(brushChartAF)
      window.removeEventListener('resize', handleResize)
    }
  }, [rawData, visibleIndicators, drawMainChart, drawBrushChart])

  // FIX: Throttle para o brush
  const throttleTimeoutRef = React.useRef<NodeJS.Timeout>()

  const handleBrushMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pos = x / rect.width

    const handleMargin = 10 / rect.width
    const minPos = brushWindow.min
    const maxPos = brushWindow.max

    // Verificar se clicou nas alças
    if (Math.abs(pos - minPos) < handleMargin) {
      brushRef.current.isBrushing = true
      brushRef.current.isDragging = false
      brushRef.current.startX = maxPos // anchor is the opposite handle
    } else if (Math.abs(pos - maxPos) < handleMargin) {
      brushRef.current.isBrushing = true
      brushRef.current.isDragging = false
      brushRef.current.startX = minPos // anchor is the opposite handle
    } else if (pos > minPos && pos < maxPos) {
      brushRef.current.isDragging = true
      brushRef.current.isBrushing = false
      brushRef.current.startX = pos
    } else {
       brushRef.current.isBrushing = true
       brushRef.current.isDragging = false
       brushRef.current.startX = pos
    }
  }

  const handleBrushMouseMove = (e: React.MouseEvent) => {
    if (!brushRef.current.isBrushing && !brushRef.current.isDragging) return

    if (throttleTimeoutRef.current) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pos = Math.max(0, Math.min(1, x / rect.width))

    if (brushRef.current.isDragging) {
        const delta = pos - brushRef.current.startX;
        const currentWidth = brushWindow.max - brushWindow.min;
        let newMin = brushWindow.min + delta;
        let newMax = brushWindow.max + delta;

        if (newMin < 0) {
            newMin = 0;
            newMax = currentWidth;
        }
        if (newMax > 1) {
            newMax = 1;
            newMin = 1 - currentWidth;
        }
        setBrushWindow({ min: newMin, max: newMax });
    } else {
      const newMin = Math.min(pos, brushRef.current.startX)
      const newMax = Math.max(pos, brushRef.current.startX)
      setBrushWindow({ min: newMin, max: newMax })
    }
    
    // We don't update startX when brushing, only when dragging.
    if(brushRef.current.isDragging) {
        brushRef.current.startX = pos
    }

    throttleTimeoutRef.current = setTimeout(() => {
      throttleTimeoutRef.current = undefined
    }, 16)
  }

  const handleBrushMouseUp = () => {
    brushRef.current.isBrushing = false
    brushRef.current.isDragging = false
  }

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
              {isPositive ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
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
                onCheckedChange={() =>
                  setVisibleIndicators(p => ({ ...p, sma: !p.sma }))
                }
              >
                SMA (Média Móvel Simples)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleIndicators.ema}
                onCheckedChange={() =>
                  setVisibleIndicators(p => ({ ...p, ema: !p.ema }))
                }
              >
                EMA (Média Móvel Exponencial)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleIndicators.vwap}
                onCheckedChange={() =>
                  setVisibleIndicators(p => ({ ...p, vwap: !p.vwap }))
                }
              >
                VWAP (Preço Médio Ponderado por Volume)
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Bandas</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={visibleIndicators.bb}
                onCheckedChange={() =>
                  setVisibleIndicators(p => ({ ...p, bb: !p.bb }))
                }
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
