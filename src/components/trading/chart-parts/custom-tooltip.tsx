"use client";

import type { THEMES } from './themes';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  colors: typeof THEMES.dark;
}

export const CustomTooltip = ({ active, payload, label, colors }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const priceKeys = ['open', 'high', 'low', 'close'];
  const indicatorKeys = ['sma', 'ema', 'vwap'];

  return (
    <div
      className="text-xs p-2 rounded-lg shadow-xl space-y-1"
      style={{
        backgroundColor: `${colors.bg}e6`, // bg com alpha
        border: `1px solid ${colors.grid}`,
        color: colors.text,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="font-bold">{label}</div>
      {priceKeys.map(key => (
        <div key={key} className="flex justify-between">
          <span className="capitalize">{key}:</span>
          <span className="font-mono ml-4">{data[key]?.toFixed(4)}</span>
        </div>
      ))}
      {data.volume && (
        <div className="flex justify-between">
          <span>Volume:</span>
          <span className="font-mono ml-4">{data.volume}</span>
        </div>
      )}
       {indicatorKeys.some(key => data[key]) && <hr className="border-gray-600 my-1"/>}
       {indicatorKeys.map(key => (
         data[key] && (
            <div key={key} className="flex justify-between items-center">
                <span className="uppercase">{key}:</span>
                <span className="font-mono ml-4">{data[key].toFixed(4)}</span>
            </div>
         )
       ))}
    </div>
  );
};
