/**
 * @fileOverview A service dedicated to calculating various technical trading indicators.
 */

import type { ChartData, CandleData } from '@/hooks/use-market-data'

// ===== PUBLIC INDICATOR FUNCTIONS =====

/**
 * Calculates the Simple Moving Average (SMA) for a given period.
 * @param data - Array of candle data.
 * @param period - The number of periods to average.
 * @returns An array of SMA values or nulls.
 */
export const calcSMA = (data: CandleData[], period: number): (number | null)[] =>
  data.map((d, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    return slice.reduce((sum, candle) => sum + candle.close, 0) / period
  })

/**
 * Calculates the Exponential Moving Average (EMA) for a given period.
 * @param data - Array of candle data.
 * @param period - The number of periods for the EMA.
 * @returns An array of EMA values.
 */
export const calcEMA = (data: CandleData[], period: number): (number | null)[] => {
  if (data.length === 0) return []
  const k = 2 / (period + 1)
  let ema = data[0].close // Start with the first close
  const emaValues: number[] = [ema]

  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    emaValues.push(ema)
  }
  return emaValues
}

/**
 * Calculates the Volume-Weighted Average Price (VWAP).
 * @param data - Array of candle data.
 * @returns An array of VWAP values.
 */
export const calcVWAP = (data: CandleData[]): (number | null)[] => {
  let cumulativePV = 0
  let cumulativeVolume = 0
  return data.map(d => {
    if(!d.volume) return null;
    const typicalPrice = (d.high + d.low + d.close) / 3
    cumulativePV += typicalPrice * d.volume
    cumulativeVolume += d.volume
    return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : null;
  })
}


/**
 * Calculates Bollinger Bands for a given period and standard deviation.
 * @param data - Array of candle data.
 * @param period - The number of periods for the moving average.
 * @param stdDev - The number of standard deviations.
 * @returns An array of objects containing the upper, middle, and lower bands.
 */
export const calcBollingerBands = (
  data: CandleData[],
  period: number,
  stdDev: number
): ({ upper: number; middle: number; lower: number } | null)[] => {
  return data.map((d, i) => {
    if (i < period - 1) return null;

    const slice = data.slice(i - period + 1, i + 1);
    const closes = slice.map(c => c.close);
    
    // Middle Band (SMA)
    const middle = closes.reduce((sum, close) => sum + close, 0) / period;
    
    // Standard Deviation
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - middle, 2), 0) / period;
    const sd = Math.sqrt(variance);

    return {
      upper: middle + stdDev * sd,
      middle: middle,
      lower: middle - stdDev * sd,
    };
  });
};
