"use client";

import type { THEMES } from './themes';

interface CandleShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: any;
  yAxis?: any; // Recharts yAxis object
  colors: typeof THEMES.dark;
}

export const CandleShape = ({ x = 0, width = 0, payload, yAxis, colors }: CandleShapeProps) => {
  if (!payload || !yAxis) return null;

  const { open, close, high, low } = payload;
  const bullish = close >= open;
  const color = bullish ? colors.bull : colors.bear;

  const yOpen = yAxis.scale(open);
  const yClose = yAxis.scale(close);
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);

  const bodyTop = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
  const cx = x + width / 2;

  return (
    <g>
      {/* Wick */}
      <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect
        x={x + width * 0.2}
        y={bodyTop}
        width={width * 0.6}
        height={bodyHeight}
        fill={color}
        rx={1}
      />
    </g>
  );
};
