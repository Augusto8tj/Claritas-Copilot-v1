/**
 * @fileOverview A service dedicated to calculating various technical trading indicators.
 */

import type { ChartData, CandleData, TickData } from '@/hooks/use-market-data'
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';

// ===== PRIVATE HELPERS =====

const calculateRSI = (data: CandleData[], period = 14) => {
    if (data.length < period) return null;
    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
        const difference = data[i].close - data[i - 1].close;
        if (difference >= 0) gains += difference;
        else losses -= difference;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
};

const calculateStochastic = (data: CandleData[], period = 14) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const lowestLow = Math.min(...relevantData.map(d => d.low));
    const highestHigh = Math.max(...relevantData.map(d => d.high));
    const currentClose = relevantData[relevantData.length - 1].close;
    if (highestHigh === lowestLow) return 50; // Avoid division by zero
    return 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
};

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
  if (data.length === 0 || !data[0]) return []
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
    if (!d) return null; // Fix: Ensure 'd' is not null.
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
  period = 20,
  stdDev = 2
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


/**
 * Calculates all necessary indicators based on the current chart data and the strategies in the council.
 * @param chartData The raw data from the chart (ticks or candles).
 * @param council The array of robot strategies.
 * @returns An object containing the latest calculated values for all required indicators.
 */
export const calculateAllIndicators = (chartData: ChartData[], council: RobotStrategy[]) => {
    const candles = chartData.filter(d => 'close' in d) as CandleData[];
    
    if (candles.length < 2) {
        return {
            rsi: null, stoch: null, ma: { short: null, long: null },
            bollingerBands: null, macd: null, priceAction: null,
            adx: null, atr: null, ichimoku: null, awesomeOscillator: null,
            volumePoc: null,
        };
    }

    const latestCandle = candles[candles.length - 1];

    const rsi = calculateRSI(candles, 14);
    const stoch = calculateStochastic(candles, 14);

    // Placeholder for other indicators until they are fully implemented
    const ma = { short: null, long: null };
    const bollingerBands = null;
    const macd = null;
    const priceAction = null;
    const adx = null;
    const atr = null;
    const ichimoku = null;
    const awesomeOscillator = null;
    const volumePoc = null;

    return {
        rsi,
        stoch,
        ma,
        bollingerBands,
        macd,
        priceAction,
        adx,
        atr,
        ichimoku,
        awesomeOscillator,
        volumePoc,
    };
};
