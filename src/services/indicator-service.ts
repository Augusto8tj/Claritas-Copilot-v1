/**
 * @fileOverview A service dedicated to calculating various technical trading indicators.
 */

import type { ChartData, CandleData, TickData } from '@/hooks/use-market-data'
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';

// ===== PRIVATE HELPERS =====

const calculateRSI = (data: CandleData[], period = 14): (number | null)[] => {
    if (data.length < period) return Array(data.length).fill(null);

    const rsiValues: (number | null)[] = Array(period - 1).fill(null);
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i < period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss -= change;
        }
    }
    avgGain /= period;
    avgLoss /= period;

    let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));

    for (let i = period; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        let gain = change > 0 ? change : 0;
        let loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        rsiValues.push(100 - (100 / (1 + rs)));
    }
    return rsiValues;
};


const calculateStochastic = (data: CandleData[], period = 14, smoothK = 3) => {
    if (data.length < period) return Array(data.length).fill(null);

    const kValues: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            kValues.push(null);
            continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const lowestLow = Math.min(...slice.map(d => d.low));
        const highestHigh = Math.max(...slice.map(d => d.high));
        const currentClose = slice[slice.length - 1].close;
        if (highestHigh === lowestLow) {
            kValues.push(i > 0 ? kValues[i - 1] : 50);
        } else {
            kValues.push(100 * ((currentClose - lowestLow) / (highestHigh - lowestLow)));
        }
    }
    return kValues;
};

const calculateMACD = (data: CandleData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (data.length < slowPeriod) return { macd: [], signal: [], histogram: [] };

    const emaFast = calcEMA(data, fastPeriod);
    const emaSlow = calcEMA(data, slowPeriod);
    
    const macdLine = data.map((_, i) => (emaFast[i] && emaSlow[i]) ? emaFast[i]! - emaSlow[i]! : null);
    
    const signalLine = calcEMA(macdLine.filter(v => v !== null).map(v => ({close: v!})) as CandleData[], signalPeriod);

    const macdWithNulls = [...Array(slowPeriod - 1).fill(null), ...macdLine.slice(slowPeriod - 1)];
    const signalWithNulls = [...Array(slowPeriod + signalPeriod - 2).fill(null), ...signalLine.map(s => s)];

    const histogram = macdWithNulls.map((m, i) => (m && signalWithNulls[i]) ? m - signalWithNulls[i]! : null);

    return { macd: macdWithNulls, signal: signalWithNulls, histogram };
};


// ===== PUBLIC INDICATOR FUNCTIONS =====

/**
 * Calculates the Simple Moving Average (SMA) for a given period.
 * @param data - Array of candle data.
 * @param period - The number of periods to average.
 * @returns An array of SMA values or nulls.
 */
export const calcSMA = (data: (CandleData | null)[], period: number): (number | null)[] =>
  data.map((d, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1).filter((item): item is CandleData => !!item);
    if (slice.length < period) return null; // Not enough valid data points in the slice
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
  const emaValues: (number | null)[] = [ema]

  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    if (!d) {
        emaValues.push(ema); // carry over last ema if data is null
        continue;
    }
    ema = d.close * k + ema * (1 - k)
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
    if (!d || !d.volume) return null;
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
  data: (CandleData | null)[],
  period = 20,
  stdDev = 2
): ({ upper: number; middle: number; lower: number } | null)[] => {
  return data.map((d, i) => {
    if (i < period - 1) return null;

    const slice = data.slice(i - period + 1, i + 1).filter((item): item is CandleData => !!item);
    if (slice.length < period) return null;
    
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

    const latestRsi = calculateRSI(candles).pop() ?? null;
    const latestStoch = calculateStochastic(candles).pop() ?? null;
    
    const smaValues = calcSMA(candles, 10);
    const emaValues = calcEMA(candles, 10);
    const vwapValues = calcVWAP(candles);
    const bbValues = calcBollingerBands(candles);
    const macdValues = calculateMACD(candles);


    return {
        rsi: latestRsi,
        stoch: latestStoch,
        ma: { 
            short: smaValues.pop() ?? null,
            long: emaValues.pop() ?? null, // Example: using ema as long
        },
        bollingerBands: bbValues.pop() ?? null,
        macd: {
            macd: macdValues.macd.pop() ?? null,
            signal: macdValues.signal.pop() ?? null,
        },
        priceAction: null, // Placeholder
        adx: null, // Placeholder
        atr: null, // Placeholder
        ichimoku: null, // Placeholder
        awesomeOscillator: null, // Placeholder
        volumePoc: null, // Placeholder

        // Full arrays for chart
        sma: smaValues,
        ema: emaValues,
        vwap: vwapValues,
        bollingerBands: bbValues,
    };
};
