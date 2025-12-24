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
import { Loader2, ArrowUp, ArrowDown } from "lucide-react";
import type { CandleData, ChartData, ActiveContract, TimePeriod, ChartType, TickData } from '@/hooks/use-market-data';

/* =========================================================
   1. CONFIGURAÇÕES DE COR E ESTILO PREMIUM (Tema Dark)
========================================================= */

const COLORS = {
  BACKGROUND: '#0d1117', // Cinza escuro elegante
  GRID: '#2a2e39',       // Grid sutil
  BULLISH: '#26a69a',    // Verde TradingView
  BEARISH: '#ef5350',    // Vermelho TradingView
  WICK: '#636e72',       // Pavio neutro
  TEXT: '#c9d1d9',       // Texto claro
  BORDER: '#30363d',     // Bordas suaves
  HIGHLIGHT: '#484f58',  // Highlight hover
  SHADOW: 'rgba(0, 0, 0, 0.5)',
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
}: {
  data: CandleData[];
  chartRef: React.RefObject<any>;
  onHoverChange: (index: number | null) => void;
  hoveredIndex: number | null;
  crosshairX: number | null;
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
        const color = isBullish ? COLORS.BULLISH : COLORS.BEARISH;

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
        ctx.strokeStyle = COLORS.WICK;
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
          ctx.shadowColor = COLORS.SHADOW;
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = COLORS.HIGHLIGHT;
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

  }, [data, chartRef, hoveredIndex, crosshairX, onHoverChange]);

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
const CustomTooltip = ({ active, payload, label, hoveredCandle }: any) => {
  if (!active || !payload || !hoveredCandle) return null;

  const { open, high, low, close, epoch } = hoveredCandle;
  const changeAbs = parseFloat((close - open).toFixed(4));
  const changePct = parseFloat(((changeAbs / open) * 100).toFixed(2));

  const trendIcon = changeAbs >= 0 ? (
    <ArrowUp className="w-4 h-4 text-green-500" />
  ) : (
    <ArrowDown className="w-4 h-4 text-red-500" />
  );

  return (
    <div
      className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-sm font-mono shadow-xl"
      style={{
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="text-xs text-[#8b949e] mb-1">
        {new Date(epoch * 1000).toLocaleString('pt-BR')}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#c9d1d9]">
        <span>Open:</span>
        <span className="text-right">{open.toFixed(2)}</span>
        <span>High:</span>
        <span className="text-right">{high.toFixed(2)}</span>
        <span>Low:</span>
        <span className="text-right">{low.toFixed(2)}</span>
        <span>Close:</span>
        <span className={`text-right ${changeAbs >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {close.toFixed(2)}
        </span>
        <span>Δ:</span>
        <span className={`text-right flex items-center gap-1 ${changeAbs >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
const PriceBadge = ({ price, isPositive }: { price: number; isPositive: boolean }) => {
  const badgeColor = isPositive ? COLORS.BULLISH : COLORS.BEARISH;
  return (
    <div
      className="absolute right-0 top-1/2 transform -translate-y-1/2 px-2 py-1 rounded-md text-xs font-mono font-bold text-white shadow-lg"
      style={{
        backgroundColor: badgeColor,
        boxShadow: `0 4px 12px ${COLORS.SHADOW}`,
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
}: {
  symbol: string;
  latestPrice: number;
  prevPrice: number;
}) => {
  const changeAbs = parseFloat((latestPrice - prevPrice).toFixed(4));
  const changePct = parseFloat(((changeAbs / prevPrice) * 100).toFixed(2));
  const isPositive = changeAbs >= 0;

  const badgeColor = isPositive ? COLORS.BULLISH : COLORS.BEARISH;

  return (
    <div className="absolute top-2 left-2 bg-[#161b22] rounded-md px-3 py-1.5 text-sm flex items-center gap-2">
      <span className="font-bold text-[#c9d1d9]">{symbol}</span>
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
  zoomLevel: number;
  chartData: ChartData[];
  isChartLoading: boolean;
  chartError: string | null;
  chartType: ChartType;
  timePeriod: TimePeriod;
  showBollingerBands: boolean;
}

export function MarketChart({
  activeSymbol,
  activeContracts,
  zoomLevel,
  chartData,
  isChartLoading,
  chartError,
  chartType,
  timePeriod,
  showBollingerBands,
}: MarketChartProps) {

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

  if (isChartLoading && visibleData.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-[#8b949e] ml-3">A carregar gráfico...</p>
      </div>
    );
  }

  if (chartError) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center text-center p-4 bg-[#0d1117]">
        <p className="text-destructive">{chartError}</p>
      </div>
    );
  }

  if (visibleData.length === 0) {
     return <div className="h-[400px] w-full flex items-center justify-center text-[#8b949e] bg-[#0d1117]">Aguardando dados...</div>;
  }

  /* --------------------------------------------------------
     MODO TICKS (Área com Gradiente Azul)
  -------------------------------------------------------- */
  if (chartType === 'Area') {
    const data = visibleData as TickData[];
    const yDomain = getStableYDomain(data.map(d => d.price));

    return (
      <div key={componentKey} className="h-[400px] w-full relative group bg-[#0d1117]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ right: 0, left: 0, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.GRID} vertical={true} />
            <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR')}
              stroke={COLORS.TEXT}
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
              stroke={COLORS.TEXT}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDataOverflow={false}
            />
            <Tooltip
              labelFormatter={l => new Date(l * 1000).toLocaleString('pt-BR')}
              formatter={(value: number) => [priceFormatter(value), "Preço"]}
              contentStyle={{
                backgroundColor: '#161b22',
                borderRadius: '8px',
                border: `1px solid ${COLORS.BORDER}`,
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
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
              <ReferenceLine y={latestPrice} stroke={COLORS.TEXT} strokeDasharray="3 3">
                  <Label value={priceFormatter(latestPrice)} position="right" fill={COLORS.TEXT} offset={10} className="text-xs bg-[#161b22]/50 px-1 py-0.5 rounded" />
              </ReferenceLine>
            )}
            {activeContracts.map(contract => (
              contract.entryTick > 0 && (
                <ReferenceDot
                    key={contract.contractId}
                    x={contract.entryTime}
                    y={contract.entryTick}
                    r={4}
                    fill={COLORS.BULLISH}
                    stroke={COLORS.BACKGROUND}
                    strokeWidth={2}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
        {/* Header Info */}
        {latestPrice && prevPrice && (
          <HeaderInfo symbol={activeSymbol} latestPrice={latestPrice} prevPrice={prevPrice} />
        )}
        {/* Price Badge */}
        {latestPrice && prevPrice && (
          <PriceBadge price={latestPrice} isPositive={latestPrice >= prevPrice} />
        )}
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
      className="h-[400px] w-full relative bg-[#0d1117]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={candleData}
          ref={chartRef}
          margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="1 0" stroke={COLORS.GRID} vertical={true} horizontal={true} />

          <XAxis
              dataKey="epoch"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={e => new Date(e * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              stroke={COLORS.TEXT}
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
              stroke={COLORS.TEXT}
              fontSize={11}
              tickLine={false}
              axisLine={false}
          />

          <Tooltip
              content={<CustomTooltip hoveredCandle={hoveredIndex !== null ? candleData[hoveredIndex] : null} />}
              isAnimationActive={false}
              cursor={{
                stroke: COLORS.TEXT,
                strokeWidth: 1,
                strokeDasharray: '4 4',
                pointerEvents: 'none',
              }}
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
                  fill={COLORS.BULLISH}
                  stroke={COLORS.BACKGROUND}
                  strokeWidth={2}
                  ifOverflow="visible"
              />
            )
          ))}

          {latestPrice && (
              <ReferenceLine y={latestPrice} stroke={COLORS.TEXT} strokeDasharray="2 2" ifOverflow="visible" strokeOpacity={0.5}>
                   <Label 
                      value={priceFormatter(latestPrice)} 
                      position="right"
                      fill={COLORS.TEXT}
                      className="text-xs font-bold"
                      style={{ transform: 'translateX(5px)'}}
                      content={({ viewBox }) => (
                          <g transform={`translate(${viewBox.x}, ${viewBox.y})`}>
                              <rect x={5} y={-8} width={50} height={16} fill={COLORS.BULLISH} rx={4} />
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
      />

      {/* Header Info */}
      {latestPrice && prevPrice && (
        <HeaderInfo symbol={activeSymbol} latestPrice={latestPrice} prevPrice={prevPrice} />
      )}

      {/* Price Badge */}
      {latestPrice && prevPrice && (
        <PriceBadge price={latestPrice} isPositive={latestPrice >= prevPrice} />
      )}
    </div>
  );
}
