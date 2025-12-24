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
  Line,
  Label,
  ReferenceDot,
  LineChart,
} from 'recharts';
import { Loader2, ArrowUp, ArrowDown, AreaChart, CandlestickChart, Clock, Moon, Sun, Plus, Minus, Waves } from "lucide-react";
import type { CandleData, ChartData, ActiveContract, TimePeriod, ChartType, TickData } from '@/hooks/use-market-data';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';


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
    LINE: '#2962ff',
    BUTTON_BG: 'bg-transparent hover:bg-white/10 border-white/20 text-white/80 hover:text-white',
  },
  light: {
    BACKGROUND: '#ffffff',
    GRID: '#e0e3eb',
    BULLISH: '#2e7d32',
    BEARISH: '#c62828',
    WICK: '#495057',
    TEXT: '#212529',
    BORDER: '#dee2e6',
    HIGHLIGHT: '#f1f3f5',
    SHADOW: 'rgba(0, 0, 0, 0.1)',
    LINE: '#2962ff',
    BUTTON_BG: 'bg-white/50 hover:bg-black/5 border-black/20 text-black/80 hover:text-black',
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
  hoveredIndex,
  onHoverChange,
  crosshairX,
  colors,
}: {
  data: CandleData[];
  chartRef: React.RefObject<any>;
  hoveredIndex: number | null;
  onHoverChange: (i: number | null) => void;
  crosshairX: number | null;
  colors: typeof THEMES.dark;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas || !data.length) return;

    const container = chart.container;
    const rect = container.getBoundingClientRect();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const xAxis = chart.state.xAxisMap?.[0];
    const yAxis = chart.state.yAxisMap?.[0];
    if (!xAxis || !yAxis) return;

    const xScale = xAxis.scale;
    const yScale = yAxis.scale;

    const x0 = xScale(data[0].epoch);
    const x1 = xScale(data[1]?.epoch ?? data[0].epoch);
    const candleWidth = Math.max(4, Math.abs(x1 - x0) * 0.65);

    let closest = -1;
    let minDist = Infinity;

    data.forEach((d, i) => {
      const x = xScale(d.epoch);
      if (x == null) return;

      const openY = yScale(d.open);
      const closeY = yScale(d.close);
      const highY = yScale(d.high);
      const lowY = yScale(d.low);

      const isBull = d.close >= d.open;
      const color = isBull ? colors.BULLISH : colors.BEARISH;

      if (crosshairX != null) {
        const dist = Math.abs(x - crosshairX);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }

      // Wick
      ctx.strokeStyle = colors.WICK;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(openY - closeY));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      // Hover
      if (hoveredIndex === i) {
        ctx.strokeStyle = colors.HIGHLIGHT;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        ctx.lineWidth = 1;
      }
    });

    if (closest !== hoveredIndex) {
      onHoverChange(closest);
    }
  }, [data, hoveredIndex, crosshairX, onHoverChange, colors, chartRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    />
  );
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
  chartData: ChartData[];
  isChartLoading: boolean;
  chartError: string | null;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  showBollingerBands: boolean;
  setShowBollingerBands: (show: boolean) => void;
  handleZoom: (direction: 'in' | 'out') => void;
  zoomLevel: number;
}

export function MarketChart({
  activeSymbol,
  activeContracts,
  chartData,
  isChartLoading,
  chartError,
  chartType,
  setChartType,
  timePeriod,
  setTimePeriod,
  showBollingerBands,
  setShowBollingerBands,
  handleZoom,
  zoomLevel,
}: MarketChartProps) {

  const [chartTheme, setChartTheme] = React.useState<'light' | 'dark'>('dark');
  
  const colors = THEMES[chartTheme];

  const chartRef = React.useRef<any>(null);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [crosshairX, setCrosshairX] = React.useState<number | null>(null);
  
  const visibleData = React.useMemo(() => {
    return chartData.slice(-zoomLevel);
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

  const componentKey = `${activeSymbol}-${chartType}-${timePeriod}-${zoomLevel}`;

  const chartTypes: { label: ChartType, icon: React.ReactNode, disabled: boolean }[] = [
    { label: 'Area', icon: <AreaChart className="w-4 h-4" />, disabled: false },
    { label: 'Candle', icon: <CandlestickChart className="w-4 h-4" />, disabled: ['1m'].includes(timePeriod) },
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
     MODO TICKS (Área com Gradiente)
  -------------------------------------------------------- */
  if (chartType === 'Area') {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div key={componentKey} className="h-[400px] w-full relative group" style={{ backgroundColor: colors.BACKGROUND }}>
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
                <stop offset="0%" stopColor={colors.LINE} stopOpacity="0.6"/>
                <stop offset="100%" stopColor={colors.LINE} stopOpacity="0.1"/>
              </linearGradient>
            </defs>
            <Line
              type="monotone"
              dataKey="price"
              stroke={colors.LINE}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
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
            zoomLevel={zoomLevel}
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
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
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
                      content={({ viewBox }) => {
                        if (!viewBox) return null;
                        const isPositive = prevPrice ? latestPrice >= prevPrice : true;
                        const badgeColor = isPositive ? colors.BULLISH : colors.BEARISH;
                        return (
                          <g transform={`translate(${viewBox.x}, ${viewBox.y})`}>
                              <rect x={5} y={-8} width={55} height={16} fill={badgeColor} rx={4} />
                              <text x={32.5} y={3} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                                  {priceFormatter(latestPrice)}
                              </text>
                          </g>
                        )
                      }}
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
          zoomLevel={zoomLevel}
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
    zoomLevel: number;
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
    handleZoom,
    zoomLevel
}) => {

    const chartButtonClass = cn("h-8 w-8 p-0 border", colors.BUTTON_BG);
    const timePeriods: TimePeriod[] = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '8h', '1d'];


    return (
        <>
            {/* Header Info */}
            {latestPrice && prevPrice && (
                <HeaderInfo symbol={activeSymbol} latestPrice={latestPrice} prevPrice={prevPrice} colors={colors} />
            )}
            
            {/* Floating Controls */}
            <div className="absolute top-2 right-2 flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(chartButtonClass, showBollingerBands && "bg-black/20 dark:bg-white/20")}
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
                    <PopoverContent className="w-auto p-2" style={{ backgroundColor: `${colors.BACKGROUND}e6`, borderColor: colors.BORDER }}>
                        <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as ChartType)} className="grid grid-cols-2 gap-2">
                        {chartTypes.map(type => (
                            <ToggleGroupItem value={type.label} key={type.label} disabled={type.disabled} className="flex flex-col h-auto p-2" style={{ borderColor: colors.BORDER, color: colors.TEXT }} data-state={chartType === type.label ? 'on' : 'off'}>
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
                    <PopoverContent className="w-auto p-2" style={{ backgroundColor: `${colors.BACKGROUND}e6`, borderColor: colors.BORDER }}>
                        <div className="grid grid-cols-4 gap-2">
                            {timePeriods.map(period => (
                                <Button
                                    key={period}
                                    variant={timePeriod === period ? "secondary" : "ghost"}
                                    onClick={() => setTimePeriod(period)}
                                    className={cn("w-full h-8 text-xs", timePeriod !== period && `text-[${colors.TEXT}]`)}
                                >
                                    {period.toUpperCase()}
                                </Button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" className={chartButtonClass} onClick={() => handleZoom('in')} >
                    <Plus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className={chartButtonClass} onClick={() => handleZoom('out')} >
                    <Minus className="h-4 w-4" />
                </Button>
            </div>
        </>
    );
};
