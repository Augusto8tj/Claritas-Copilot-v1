
'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  Label,
  ReferenceDot,
  LineChart,
} from 'recharts';
import { Loader2, ArrowUp, ArrowDown, AreaChart, CandlestickChart, Clock, Moon, Sun, Plus, Minus, Waves } from "lucide-react";
import type { CandleData, ChartData, ActiveContract, TimePeriod, ChartType, TickData } from '@/hooks/use-market-data';
import { useMarketData } from '@/hooks/use-market-data';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';


const timePeriods: TimePeriod[] = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '8h', '1d'];

/* =========================================================
   1. CONFIGURAÇÕES DE COR E ESTILO PREMIUM
========================================================= */

const THEMES = {
  dark: {
    BACKGROUND: '#0d1117',
    GRID: '#2a2e39',
    BULLISH: '#26a69a',
    BEARISH: '#ef5350',
    WICK: '#636e72',
    TEXT: '#c9d1d9',
    BORDER: '#30363d',
    HIGHLIGHT: '#484f58',
    SHADOW: 'rgba(0, 0, 0, 0.5)',
  },
  light: {
    BACKGROUND: '#ffffff',
    GRID: '#e0e3eb',
    BULLISH: '#26a69a',
    BEARISH: '#ef5350',
    WICK: '#6c757d',
    TEXT: '#495057',
    BORDER: '#dee2e6',
    HIGHLIGHT: '#f1f3f5',
    SHADOW: 'rgba(0, 0, 0, 0.1)',
  }
};


const getStableYDomain = (values: number[], padding = 0.15): [number, number] => {
  const validValues = values
    .map(Number)
    .filter(v => !isNaN(v) && isFinite(v) && v > 0);
  
  if (validValues.length === 0) return ['auto', 'auto'] as any;

  if (validValues.every(v => v === validValues[0])) {
      const val = validValues[0];
      return [val * 0.999, val * 1.001];
  }
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || (max * 0.01);

  return [
    Math.max(0, min - range * padding),
    max + range * padding,
  ];
};

/* =====================================================
   2. CANVAS CANDLE LAYER OTIMIZADO COM HOVER & CROSSHAIR
===================================================== */
function CanvasCandles({
  data,
  chartRef,
  onHoverChange,
  hoveredIndex,
  crosshairX,
  colors
}: {
  data: CandleData[];
  chartRef: React.RefObject<any>;
  onHoverChange: (index: number | null) => void;
  hoveredIndex: number | null;
  crosshairX: number | null;
  colors: typeof THEMES.dark;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hoveredCandle, setHoveredCandle] = React.useState<CandleData | null>(null);

  const draw = React.useCallback(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    
    if (!canvas || !chart || !chart.state || !chart.state.offset || !data) return;
    
    const { offset, xAxisMap, yAxisMap } = chart.state;
    if (!xAxisMap || !yAxisMap || !xAxisMap[0] || !yAxisMap[0]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = offset;
    const dpr = window.devicePixelRatio || 1;
    
    if (width <= 0 || height <= 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const xScale = xAxisMap[0].scale;
    const yScale = yAxisMap[0].scale;

    const dataLength = data.length;
    const slotWidth = width / dataLength;
    const gap = Math.max(1, slotWidth * 0.3); 
    const barWidth = Math.max(1, slotWidth - gap);
    ctx.lineWidth = 1;

    let closestCandleIndex = -1;
    let minDistance = Infinity;

    data.forEach((d, i) => {
        if (!d.open || !d.close) return;

        const x = xScale(d.epoch);
        if (x === undefined || x < -barWidth || x > width + barWidth) return;

        const openY = yScale(d.open);
        const closeY = yScale(d.close);
        const highY = yScale(d.high);
        const lowY = yScale(d.low);

        const isBullish = d.close >= d.open;
        const color = isBullish ? colors.BULLISH : colors.BEARISH;

        // Calcular distância do cursor ao centro da vela
        if (crosshairX !== null) {
          const distance = Math.abs(x - crosshairX);
          if (distance < minDistance) {
            minDistance = distance;
            closestCandleIndex = i;
          }
        }

        // Desenhar pavio
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.strokeStyle = colors.WICK;
        ctx.stroke();

        // Desenhar corpo
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(openY - closeY));
        const bodyLeft = x - barWidth / 2;

        if (isBullish) {
          // Hollow (borda)
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(bodyLeft, bodyTop, barWidth, bodyHeight);
          ctx.lineWidth = 1;
        } else {
          // Preenchido
          ctx.fillStyle = color;
          ctx.fillRect(bodyLeft, bodyTop, barWidth, bodyHeight);
        }

        // Efeito hover
        if (hoveredIndex === i) {
          ctx.save();
          ctx.shadowColor = colors.SHADOW;
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = colors.HIGHLIGHT;
          ctx.lineWidth = 2;
          ctx.strokeRect(bodyLeft, bodyTop, barWidth, bodyHeight);
          ctx.restore();
          setHoveredCandle(d);
        }
    });

    // Atualiza o índice hover se houver um novo mais próximo
    if (closestCandleIndex >= 0 && hoveredIndex !== closestCandleIndex) {
      onHoverChange(closestCandleIndex);
    }

  }, [data, chartRef, hoveredIndex, crosshairX, onHoverChange, colors]);

  React.useEffect(() => { draw(); }, [draw]);
  
  React.useEffect(() => {
      let animationFrameId: number;
      const handleResize = () => { animationFrameId = requestAnimationFrame(draw); };
      const chart = chartRef.current;
      
      if (chart?.container) {
          const resizeObserver = new ResizeObserver(handleResize);
          resizeObserver.observe(chart.container);
          return () => resizeObserver.disconnect();
      }
      return () => cancelAnimationFrame(animationFrameId);
  }, [draw, chartRef]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }} />;
}

/* =========================================================
   3. TOOLTIP PROFISSIONAL NO ESTILO TRADINGVIEW
========================================================= */
const CustomTooltip = ({ active, payload, hoveredCandle, colors }: any) => {
  if (!active || !payload || !hoveredCandle) return null;

  const { open, high, low, close, epoch } = hoveredCandle;
  const changeAbs = parseFloat((close - open).toFixed(4));
  const changePct = parseFloat(((changeAbs / open) * 100).toFixed(2));
  const isBullish = changeAbs >= 0;

  const trendIcon = isBullish ? (
    <ArrowUp className="w-4 h-4 text-green-500" />
  ) : (
    <ArrowDown className="w-4 h-4 text-red-500" />
  );

  return (
    <div
      className="border rounded-lg p-3 text-sm font-mono shadow-xl"
      style={{
        backgroundColor: `${colors.BACKGROUND}e6`, // com alpha
        borderColor: colors.BORDER,
        backdropFilter: 'blur(8px)',
        boxShadow: `0 4px 20px ${colors.SHADOW}`,
      }}
    >
      <div className="text-xs mb-1" style={{ color: colors.TEXT }}>
        {new Date(epoch * 1000).toLocaleString('pt-BR')}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: colors.TEXT }}>
        <span>Open:</span>
        <span className="text-right">{open.toFixed(2)}</span>
        <span>High:</span>
        <span className="text-right">{high.toFixed(2)}</span>
        <span>Low:</span>
        <span className="text-right">{low.toFixed(2)}</span>
        <span>Close:</span>
        <span className={`text-right ${isBullish ? 'text-green-500' : 'text-red-500'}`}>
          {close.toFixed(2)}
        </span>
        <span>Δ:</span>
        <span className={`text-right flex items-center gap-1 ${isBullish ? 'text-green-500' : 'text-red-500'}`}>
          {trendIcon}
          {changeAbs >= 0 ? '+' : ''}{changeAbs.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   4. PRICE BADGE FLUTUANTE
========================================================= */
const PriceBadge = ({ price, isPositive, colors }: { price: number; isPositive: boolean, colors: typeof THEMES.dark }) => {
  const badgeColor = isPositive ? colors.BULLISH : colors.BEARISH;
  return (
    <div
      className="absolute right-0 top-1/2 transform -translate-y-1/2 px-2 py-1 rounded-md text-xs font-mono font-bold text-white shadow-lg"
      style={{
        backgroundColor: badgeColor,
        boxShadow: `0 4px 12px ${colors.SHADOW}`,
      }}
    >
      {price.toFixed(2)}
    </div>
  );
};

/* =========================================================
   5. HEADER INFORMATIVO DINÂMICO
========================================================= */
const HeaderInfo = ({
  symbol,
  latestPrice,
  prevPrice,
  colors
}: {
  symbol: string;
  latestPrice: number;
  prevPrice: number;
  colors: typeof THEMES.dark
}) => {
  const changeAbs = parseFloat((latestPrice - prevPrice).toFixed(4));
  const changePct = parseFloat(((changeAbs / prevPrice) * 100).toFixed(2));
  const isPositive = changeAbs >= 0;

  const badgeColor = isPositive ? colors.BULLISH : colors.BEARISH;

  return (
    <div className="absolute top-2 left-2 rounded-md px-3 py-1.5 text-sm flex items-center gap-2" style={{ backgroundColor: `${colors.BACKGROUND}e6` }}>
      <span className="font-bold" style={{ color: colors.TEXT }}>{symbol}</span>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
          isPositive ? 'text-green-500' : 'text-red-500'
        }`}
        style={{ backgroundColor: `${badgeColor}20` }}
      >
        {isPositive ? '+' : ''}{changeAbs.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
      </div>
    </div>
  );
};

/* =========================================================
   6. COMPONENTE PRINCIPAL — MARKET CHART PREMIUM
========================================================= */
interface MarketChartProps {
  activeSymbol: string;
  activeContracts: ActiveContract[];
}

export function MarketChart({
  activeSymbol,
  activeContracts,
}: MarketChartProps) {

  const [zoomLevel, setZoomLevel] = React.useState(100);
  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>('dark');
  
  const { 
    chartData, 
    isChartLoading, 
    chartError, 
    chartType, 
    setChartType, 
    timePeriod, 
    setTimePeriod, 
    showBollingerBands, 
    setShowBollingerBands 
  } = useMarketData(activeSymbol);

  const colors = THEMES[chartTheme];

  const chartRef = React.useRef<any>(null);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [crosshairX, setCrosshairX] = React.useState<number | null>(null);

  const visibleData = React.useMemo(() => {
    if (chartData.length > zoomLevel) {
        return chartData.slice(chartData.length - zoomLevel);
    }
    return chartData;
  }, [chartData, zoomLevel]);

  const priceFormatter = (v: number) => {
    if (!v || isNaN(v)) return "";
    if (v > 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v < 10) return v.toFixed(4);
    return v.toFixed(2);
  };

  const latestPrice = React.useMemo(() => {
    if (visibleData.length === 0) return null;
    const last = visibleData[visibleData.length - 1];
    return 'price' in last ? (last as TickData).price : (last as CandleData).close;
  }, [visibleData]);

  const prevPrice = React.useMemo(() => {
    if (visibleData.length < 2) return latestPrice || 0;
    const secondLast = visibleData[visibleData.length - 2];
    return 'price' in secondLast ? (secondLast as TickData).price : (secondLast as CandleData).close;
  }, [visibleData, latestPrice]);

  const componentKey = `${activeSymbol}-${chartType}-${timePeriod}`;

  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prevZoom => {
        let newZoom;
        if (direction === 'in') {
            newZoom = Math.max(20, prevZoom - 20);
        } else {
            newZoom = Math.min(500, prevZoom + 20);
        }
        return newZoom;
    });
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const direction = e.deltaY < 0 ? 'in' : 'out';
        handleZoom(direction);
    }
  };

  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-4 h-4" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChart className="w-4 h-4" />, disabled: ['1m', '2m', '3m'].includes(timePeriod) },
  ];

  if (isChartLoading && visibleData.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center" style={{backgroundColor: colors.BACKGROUND}}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="ml-3" style={{color: colors.TEXT}}>A carregar gráfico...</p>
      </div>
    );
  }

  if (chartError) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center text-center p-4" style={{backgroundColor: colors.BACKGROUND}}>
        <p className="text-destructive">{chartError}</p>
      </div>
    );
  }

  if (visibleData.length === 0) {
     return <div className="h-[400px] w-full flex items-center justify-center" style={{backgroundColor: colors.BACKGROUND, color: colors.TEXT}}>Aguardando dados...</div>;
  }

  /* --------------------------------------------------------
     MODO TICKS (Área com Gradiente Azul)
  -------------------------------------------------------- */
  if (chartType === 'Area') {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div key={componentKey} className="h-[400px] w-full relative group" style={{ backgroundColor: colors.BACKGROUND }} onWheel={handleWheelZoom}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ right: 0, left: 0, top: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.GRID} vertical={true} />
            <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR')}
              stroke={colors.TEXT}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={priceFormatter}
              orientation="right"
              width={60}
              stroke={colors.TEXT}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDataOverflow={false}
            />
            <Tooltip
              labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
              formatter={(value: number) => [priceFormatter(value), "Preço"]}
              contentStyle={{
                backgroundColor: `${colors.BACKGROUND}e6`,
                borderRadius: '8px',
                border: `1px solid ${colors.BORDER}`,
                fontSize: '12px',
                color: colors.TEXT,
                boxShadow: `0 4px 12px ${colors.SHADOW}`
              }}
              isAnimationActive={false}
            />
            <defs>
              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2962ff" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#2962ff" stopOpacity="0.1"/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="price"
              stroke="none"
              fill="url(#blueGradient)"
              isAnimationActive={false}
            />
            
            {latestPrice && (
              <ReferenceLine y={latestPrice} stroke={colors.TEXT} strokeDasharray="3 3">
                  <Label value={priceFormatter(latestPrice)} position="right" fill={colors.TEXT} offset={10} className="text-xs" />
              </ReferenceLine>
            )}
            {activeContracts.map(contract => (
              contract.entryTick > 0 && (
                <ReferenceDot
                    key={contract.contractId}
                    x={contract.entryTime}
                    y={contract.entryTick}
                    r={4}
                    fill={colors.BULLISH}
                    stroke={colors.BACKGROUND}
                    strokeWidth={2}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
        {/* Header e Controles */}
        <FloatingControls 
            activeSymbol={activeSymbol} 
            latestPrice={latestPrice} 
            prevPrice={prevPrice} 
            colors={colors} 
            chartType={chartType} 
            setChartType={setChartType} 
            chartTypes={chartTypes} 
            timePeriod={timePeriod} 
            setTimePeriod={setTimePeriod} 
            showBollingerBands={showBollingerBands} 
            setShowBollingerBands={setShowBollingerBands} 
            chartTheme={chartTheme} 
            setChartTheme={setChartTheme} 
            handleZoom={handleZoom} 
        />
      </div>
    );
  }

  /* --------------------------------------------------------
     MODO CANDLES (Canvas Premium com Hover & Crosshair)
  -------------------------------------------------------- */
  const candleData = visibleData as CandleData[];
  const allValues = candleData.flatMap(d => [d.high, d.low, d.bollingerUpper, d.bollingerLower]);
  const yDomain = getStableYDomain(allValues.filter(v => v !== undefined) as number[]);

  // Detecta mouse move para crosshair
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!chartRef.current || !chartRef.current.state) return;
    const { offset } = chartRef.current.state;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - offset.left;
    setCrosshairX(x);
  };

  const handleMouseLeave = () => {
    setCrosshairX(null);
    setHoveredIndex(null);
  };

  return (
    <div
      key={componentKey}
      className="h-[400px] w-full relative"
      style={{ backgroundColor: colors.BACKGROUND }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheelZoom}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={candleData}
          ref={chartRef}
          margin={{ top: 40, right: 0, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="1 0" stroke={colors.GRID} vertical={true} horizontal={true} />

          <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              stroke={colors.TEXT}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
          />

          <YAxis
              domain={yDomain}
              tickFormatter={priceFormatter}
              orientation="right"
              width={60}
              stroke={colors.TEXT}
              fontSize={11}
              tickLine={false}
              axisLine={false}
          />

          <Tooltip
              content={<CustomTooltip hoveredCandle={hoveredIndex !== null ? candleData[hoveredIndex] : null} colors={colors}/>}
              isAnimationActive={false}
              cursor={false} // Desabilitamos o cursor padrão
          />

          {showBollingerBands && (
              <>
                  <Area dataKey="bollingerUpper" stackId="bollinger" stroke="none" fill="hsl(var(--primary) / 0.05)" isAnimationActive={false} />
                  <Area dataKey="bollingerLower" stackId="bollinger" stroke="none" fill="transparent" isAnimationActive={false} />
              </>
          )}

          {activeContracts.map(contract => (
            contract.entryTick > 0 && (
              <ReferenceDot
                  key={contract.contractId}
                  x={contract.entryTime}
                  y={contract.entryTick}
                  r={4}
                  fill={colors.BULLISH}
                  stroke={colors.BACKGROUND}
                  strokeWidth={2}
                  ifOverflow="visible"
              />
            )
          ))}

          {latestPrice && (
              <ReferenceLine y={latestPrice} stroke={colors.TEXT} strokeDasharray="2 2" ifOverflow="visible" strokeOpacity={0.5}>
                   <Label 
                      value={priceFormatter(latestPrice)} 
                      position="right"
                      fill={colors.TEXT}
                      className="text-xs font-bold"
                      style={{ transform: 'translateX(5px)'}}
                      content={({ viewBox }) => (
                          <g transform={`translate(${viewBox.x}, ${viewBox.y})`}>
                              <rect x={5} y={-8} width={50} height={16} fill={colors.BULLISH} rx={4} />
                              <text x={30} y={4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                                  {priceFormatter(latestPrice)}
                              </text>
                          </g>
                      )}
                   />
              </ReferenceLine>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Camada Canvas das Velas */}
      <CanvasCandles
        data={candleData}
        chartRef={chartRef}
        onHoverChange={setHoveredIndex}
        hoveredIndex={hoveredIndex}
        crosshairX={crosshairX}
        colors={colors}
      />
      
      {/* Controles Flutuantes */}
      <FloatingControls 
          activeSymbol={activeSymbol} 
          latestPrice={latestPrice} 
          prevPrice={prevPrice} 
          colors={colors} 
          chartType={chartType} 
          setChartType={setChartType} 
          chartTypes={chartTypes} 
          timePeriod={timePeriod} 
          setTimePeriod={setTimePeriod} 
          showBollingerBands={showBollingerBands} 
          setShowBollingerBands={setShowBollingerBands} 
          chartTheme={chartTheme} 
          setChartTheme={setChartTheme} 
          handleZoom={handleZoom} 
      />

    </div>
  );
}


/* =========================================================
   7. COMPONENTE DE CONTROLES FLUTUANTES
========================================================= */

interface FloatingControlsProps {
    activeSymbol: string;
    latestPrice: number | null;
    prevPrice: number | null;
    colors: typeof THEMES.dark;
    chartType: ChartType;
    setChartType: (type: ChartType) => void;
    chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[];
    timePeriod: TimePeriod;
    setTimePeriod: (period: TimePeriod) => void;
    showBollingerBands: boolean;
    setShowBollingerBands: (show: boolean) => void;
    chartTheme: 'light' | 'dark';
    setChartTheme: (theme: 'light' | 'dark') => void;
    handleZoom: (direction: 'in' | 'out') => void;
}

const FloatingControls: React.FC<FloatingControlsProps> = ({
    activeSymbol,
    latestPrice,
    prevPrice,
    colors,
    chartType,
    setChartType,
    chartTypes,
    timePeriod,
    setTimePeriod,
    showBollingerBands,
    setShowBollingerBands,
    chartTheme,
    setChartTheme,
    handleZoom
}) => {

    const chartButtonClass = "h-8 w-8 p-0 bg-transparent hover:bg-white/10 border-white/20 border text-white/80 hover:text-white"

    return (
        <>
            {/* Header Info */}
            {latestPrice && prevPrice && (
                <HeaderInfo symbol={activeSymbol} latestPrice={latestPrice} prevPrice={prevPrice} colors={colors} />
            )}

            {/* Price Badge */}
            {latestPrice && prevPrice && (
                <PriceBadge price={latestPrice} isPositive={latestPrice >= prevPrice} colors={colors} />
            )}

            {/* Floating Controls */}
            <div className="absolute top-2 right-2 flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(chartButtonClass, showBollingerBands && "bg-white/20")}
                    onClick={() => setShowBollingerBands(!showBollingerBands)}
                    disabled={chartType !== 'Candle'}
                    aria-label="Toggle Bollinger Bands"
                >
                    <Waves className="h-4 w-4" />
                </Button>
                 <Button
                    variant="outline"
                    size="icon"
                    className={chartButtonClass}
                    onClick={() => setChartTheme(chartTheme === 'dark' ? 'light' : 'dark')}
                >
                    {chartTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn(chartButtonClass, "w-auto px-2")}>
                            {chartType === 'Area' ? <AreaChart className="w-4 h-4" /> : <CandlestickChart className="w-4 h-4" />}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 bg-black/50 backdrop-blur-sm border-white/20">
                        <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as ChartType)} className="grid grid-cols-2 gap-2">
                        {chartTypes.map(type => (
                            <ToggleGroupItem value={type.label} key={type.label} disabled={type.disabled} className="flex flex-col h-auto p-2 border-white/20 text-white/80 data-[state=on]:bg-white/20">
                                {type.icon}
                                <span className="text-xs mt-1">{type.label}</span>
                            </ToggleGroupItem>
                        ))}
                        </ToggleGroup>
                    </PopoverContent>
                </Popover>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn(chartButtonClass, "w-[70px]")}>
                            <Clock className="w-3 h-3 mr-1.5" />
                            <span className="text-xs">{timePeriod.toUpperCase()}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 bg-black/50 backdrop-blur-sm border-white/20">
                        <div className="grid grid-cols-4 gap-2">
                            {timePeriods.map(period => (
                                <Button
                                    key={period}
                                    variant={timePeriod === period ? "default" : "ghost"}
                                    onClick={() => setTimePeriod(period)}
                                    className={cn("w-full h-8 text-xs", timePeriod !== period && "text-white/80 hover:bg-white/10 hover:text-white")}
                                >
                                    {period.toUpperCase()}
                                </Button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" className={chartButtonClass} onClick={() => handleZoom('in')} disabled={zoomLevel <= 20}>
                    <Plus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className={chartButtonClass} onClick={() => handleZoom('out')} disabled={zoomLevel >= 500}>
                    <Minus className="h-4 w-4" />
                </Button>
            </div>
        </>
    );
};
