'use client'

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { Flag, Settings, Loader2 } from 'lucide-react'
import { useTheme as useAppTheme } from '@/hooks/use-theme'
import type {
  ChartData,
  CandleData,
  TimePeriod,
  ChartType,
} from '@/hooks/use-market-data'
import { HeaderInfo } from './chart-parts/header-info'
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

const Y_AXIS_WIDTH = 80;
const PADDING = { top: 20, right: Y_AXIS_WIDTH, bottom: 40, left: 10 };

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
  const { theme: appTheme } = useAppTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [chartTheme, setChartTheme] = useState<'light' | 'dark'>(appTheme.includes('dark') ? 'dark' : 'light');
  const colors = THEMES[chartTheme];
  
  const panOffsetRef = useRef(0);
  const zoomLevelRef = useRef(1);
  const isDraggingRef = useRef(false);
  const lastMouseXRef = useRef(0);
  const crosshairPositionRef = useRef<{ x: number, y: number } | null>(null);

  const isCandle = (d: ChartData): d is CandleData => 'open' in d && d.open !== undefined;
  
  const getVisibleData = useCallback(() => {
    const candlesToShow = 100 / zoomLevelRef.current;
    const endIndex = Math.floor(rawData.length - panOffsetRef.current);
    const startIndex = Math.max(0, Math.floor(endIndex - candlesToShow));
    return rawData.slice(startIndex, endIndex);
  }, [rawData]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const visibleData = getVisibleData();
    if (!canvas || !container || visibleData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const chartWidth = width - PADDING.left - PADDING.right;
    const chartHeight = height - PADDING.top - PADDING.bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    visibleData.forEach(d => {
      if (isCandle(d)) {
        minPrice = Math.min(minPrice, d.low);
        maxPrice = Math.max(maxPrice, d.high);
      } else {
        minPrice = Math.min(minPrice, d.price);
        maxPrice = Math.max(maxPrice, d.price);
      }
    });
    
    const priceRange = maxPrice - minPrice || 1;
    const pricePadding = priceRange * 0.1;
    minPrice -= pricePadding;
    maxPrice += pricePadding;

    const getY = (price: number) => PADDING.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
    const getX = (index: number) => PADDING.left + (index / (visibleData.length - 1)) * chartWidth;
    
    // Draw Grid & Y-Axis Labels
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = colors.text;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = PADDING.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(width - PADDING.right, y);
        ctx.stroke();
        const price = maxPrice - (i / gridLines) * (maxPrice - minPrice);
        ctx.fillText(price.toFixed(4), width - PADDING.right + 5, y + 3);
    }
    
    // Draw X-Axis Labels
    const labelCount = Math.floor(chartWidth / 100);
    const labelInterval = Math.max(1, Math.floor(visibleData.length / labelCount));
    for (let i = 0; i < visibleData.length; i += labelInterval) {
        const x = getX(i);
        const date = new Date(visibleData[i].epoch * 1000);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(timeString, x, height - PADDING.bottom + 15);
    }
    
    const candleWidth = (chartWidth / visibleData.length) * 0.7;
    
    // Draw Chart Data
    if (chartType === 'Candle') {
        visibleData.forEach((d, i) => {
            if (!isCandle(d)) return;
            const x = getX(i);
            const openY = getY(d.open);
            const closeY = getY(d.close);
            const highY = getY(d.high);
            const lowY = getY(d.low);

            const isBullish = d.close >= d.open;
            ctx.fillStyle = isBullish ? colors.bull : colors.bear;
            ctx.strokeStyle = isBullish ? colors.bull : colors.bear;
            
            // Wick
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            // Body
            const bodyHeight = Math.max(1, Math.abs(openY - closeY));
            ctx.fillRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, bodyHeight);
        });

    } else { // Area
        ctx.beginPath();
        visibleData.forEach((d, i) => {
            const x = getX(i);
            const y = getY(d.price);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 2;
        ctx.stroke();

        const gradient = ctx.createLinearGradient(0, PADDING.top, 0, height - PADDING.bottom);
        gradient.addColorStop(0, colors.areaTop);
        gradient.addColorStop(1, colors.areaBottom);
        ctx.fillStyle = gradient;
        ctx.lineTo(getX(visibleData.length - 1), height - PADDING.bottom);
        ctx.lineTo(getX(0), height - PADDING.bottom);
        ctx.closePath();
        ctx.fill();
    }

    // Draw Operations
    operations.forEach(op => {
      if (!op.entryPrice) return;
      const entryEpoch = new Date(op.timestamp).getTime() / 1000;
      
      const visibleStartEpoch = visibleData[0].epoch;
      const visibleEndEpoch = visibleData[visibleData.length - 1].epoch;

      if (entryEpoch < visibleStartEpoch || entryEpoch > visibleEndEpoch) {
          return; // Don't draw operations outside the visible window
      }
      
      // Find the index by finding the closest epoch
      let entryDataIndex = -1;
      let minDiff = Infinity;
      visibleData.forEach((d, i) => {
          const diff = Math.abs(d.epoch - entryEpoch);
          if (diff < minDiff) {
              minDiff = diff;
              entryDataIndex = i;
          }
      });
      
      if (entryDataIndex === -1) return;

      const entryX = getX(entryDataIndex);
      const entryY = getY(op.entryPrice);

      let statusColor = '#3b82f6'; // Blue for pending
      if (op.status === 'won') statusColor = '#22c55e';
      else if (op.status === 'lost') statusColor = '#ef4444';
      
      // Draw entry circle
      ctx.beginPath();
      ctx.arc(entryX, entryY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = statusColor;
      ctx.fill();
      ctx.strokeStyle = colors.bg;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw line to exit
      if (op.exitPrice && op.status !== 'pending') {
          let durationInSeconds = 0;
          switch (op.durationUnit) {
              case 't': durationInSeconds = op.duration * 2; break; // Approximate
              case 's': durationInSeconds = op.duration; break;
              case 'm': durationInSeconds = op.duration * 60; break;
              case 'h': durationInSeconds = op.duration * 3600; break;
              case 'd': durationInSeconds = op.duration * 86400; break;
          }
          const exitEpoch = entryEpoch + durationInSeconds;
          
          let exitDataIndex = -1;
          let minExitDiff = Infinity;
          visibleData.forEach((d, i) => {
              const diff = Math.abs(d.epoch - exitEpoch);
              if (diff < minExitDiff) {
                  minExitDiff = diff;
                  exitDataIndex = i;
              }
          });

          if(exitDataIndex !== -1 && exitDataIndex < visibleData.length) {
              const exitX = getX(exitDataIndex);
              const exitY = getY(op.exitPrice);
              
              ctx.beginPath();
              ctx.moveTo(entryX, entryY);
              ctx.lineTo(exitX, exitY);
              ctx.strokeStyle = statusColor;
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.stroke();
              ctx.setLineDash([]);
          }
      }
    });

  }, [rawData, colors, chartType, getVisibleData, operations]);
  
  useEffect(() => {
    panOffsetRef.current = 0;
    zoomLevelRef.current = 1;
    const animationFrameId = requestAnimationFrame(drawChart);
    return () => cancelAnimationFrame(animationFrameId);
  }, [rawData, chartType, timePeriod, drawChart]);

  useEffect(() => {
    const handleResize = () => {
      const animationFrameId = requestAnimationFrame(drawChart);
      return () => cancelAnimationFrame(animationFrameId);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  const handleMouseDown = (e: React.MouseEvent) => { isDraggingRef.current = true; lastMouseXRef.current = e.clientX; };
  const handleMouseUp = () => { isDraggingRef.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - lastMouseXRef.current;
    const sensitivity = 50 / ((containerRef.current?.clientWidth || 500));
    panOffsetRef.current = Math.max(0, Math.min(rawData.length - 2, panOffsetRef.current - deltaX * sensitivity));
    lastMouseXRef.current = e.clientX;
    requestAnimationFrame(drawChart);
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    zoomLevelRef.current = Math.max(0.2, Math.min(5, zoomLevelRef.current * zoomFactor));
    requestAnimationFrame(drawChart);
  };

  const latestPrice = rawData.length > 0 ? rawData[rawData.length - 1]!.price : 0
  const prevPrice = rawData.length > 1 ? rawData[rawData.length - 2]!.price : latestPrice

  return (
    <div
      className="h-[520px] w-full rounded-xl p-4 relative"
      style={{ backgroundColor: colors.bg }}
      ref={containerRef}
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
        {/* O botão de indicadores pode ser reativado aqui no futuro */}
      </div>

       <div 
        className="w-full h-[80%] relative"
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
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            className="w-full h-full"
        />
       </div>
    </div>
  )
}
