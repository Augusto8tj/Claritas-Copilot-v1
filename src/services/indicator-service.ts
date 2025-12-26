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

const calculateATR = (data: CandleData[], period = 14): (number | null)[] => {
    if (data.length < 1) return [];
    
    const trueRanges: (number | null)[] = [null];
    for (let i = 1; i < data.length; i++) {
        const highLow = data[i].high - data[i].low;
        const highPrevClose = Math.abs(data[i].high - data[i-1].close);
        const lowPrevClose = Math.abs(data[i].low - data[i-1].close);
        trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
    
    const atrValues: (number | null)[] = Array(period).fill(null);
    if (data.length < period) return atrValues;
    
    let firstAtr = trueRanges.slice(1, period + 1).reduce((sum, val) => sum + (val || 0), 0) / period;
    atrValues.push(firstAtr);
    
    for (let i = period + 1; i < data.length; i++) {
        const tr = trueRanges[i];
        if (tr === null) {
            atrValues.push(atrValues[atrValues.length - 1]);
            continue;
        }
        const currentAtr = (atrValues[i - 1]! * (period - 1) + tr) / period;
        atrValues.push(currentAtr);
    }
    
    return atrValues;
};


const calculateADX = (data: CandleData[], period = 14) => {
    if (data.length < period * 2) return { adx: [], pdi: [], ndi: [] };

    let pdi: (number | null)[] = [], ndi: (number | null)[] = [], trs: (number | null)[] = [];
    
    for (let i = 1; i < data.length; i++) {
        const upMove = data[i].high - data[i - 1].high;
        const downMove = data[i-1].low - data[i].low;
        
        const pdm = (upMove > downMove && upMove > 0) ? upMove : 0;
        const ndm = (downMove > upMove && downMove > 0) ? downMove : 0;
        
        pdi.push(pdm);
        ndi.push(ndm);
        
        const tr = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i-1].close), Math.abs(data[i].low - data[i-1].close));
        trs.push(tr);
    }
    
    const smooth = (values: (number | null)[]) => {
        let smoothed: (number | null)[] = [values.slice(0, period).reduce((acc, v) => acc + (v||0), 0)];
        for (let i = period; i < values.length; i++) {
            smoothed.push(smoothed[i-period]! - (smoothed[i-period]! / period) + (values[i] || 0));
        }
        return smoothed.map(v => v/period);
    };

    const smoothedPDI = smooth(pdi);
    const smoothedNDI = smooth(ndi);
    const smoothedTR = smooth(trs);
    
    let pdiFinal: (number | null)[] = [], ndiFinal: (number | null)[] = [], dx: (number | null)[] = [];

    for(let i=0; i< smoothedTR.length; i++){
        if(!smoothedTR[i]) {
             pdiFinal.push(null);
             ndiFinal.push(null);
             continue;
        };
        pdiFinal.push(100 * (smoothedPDI[i]! / smoothedTR[i]!));
        ndiFinal.push(100 * (smoothedNDI[i]! / smoothedTR[i]!));
    }

    for (let i = 0; i < pdiFinal.length; i++) {
        if (pdiFinal[i] === null || ndiFinal[i] === null) {
            dx.push(null);
            continue;
        }
        const den = pdiFinal[i]! + ndiFinal[i]!;
        if (den === 0) {
            dx.push(0);
        } else {
            dx.push(100 * Math.abs(pdiFinal[i]! - ndiFinal[i]!) / den);
        }
    }
    
    const adx = smooth(dx);
    return { adx: Array(data.length - adx.length).fill(null).concat(adx), pdi: pdiFinal, ndi: ndiFinal };
};


// ===== PUBLIC INDICATOR FUNCTIONS =====

export const calcSMA = (data: (CandleData | null)[], period: number): (number | null)[] =>
  data.map((d, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1).filter((item): item is CandleData => !!item);
    if (slice.length < period) return null;
    return slice.reduce((sum, candle) => sum + candle.close, 0) / period
  })

export const calcEMA = (data: CandleData[], period: number): (number | null)[] => {
  if (data.length === 0 || !data[0]) return []
  const k = 2 / (period + 1)
  let ema = data[0].close
  const emaValues: (number | null)[] = [ema]

  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    if (!d) {
        emaValues.push(ema);
        continue;
    }
    ema = d.close * k + ema * (1 - k)
    emaValues.push(ema)
  }
  return emaValues
}

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
    
    const middle = closes.reduce((sum, close) => sum + close, 0) / period;
    
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - middle, 2), 0) / period;
    const sd = Math.sqrt(variance);

    return {
      upper: middle + stdDev * sd,
      middle: middle,
      lower: middle - stdDev * sd,
    };
  });
};

export const calculateAllIndicators = (chartData: ChartData[], council: RobotStrategy[]) => {
    const candles = chartData.filter(d => 'close' in d) as CandleData[];
    
    if (candles.length < 2) {
        return {
            rsi: null, stoch: null, ma: { short: null, long: null },
            bollingerBands: [], macd: null, priceAction: null,
            adx: null, atr: null, ichimoku: null, awesomeOscillator: null,
            volumePoc: null, sma: [], ema: [], vwap: [],
        };
    }

    const rsiValues = calculateRSI(candles);
    const stochValues = calculateStochastic(candles);
    const smaValues = calcSMA(candles, 10);
    const emaValues = calcEMA(candles, 10);
    const vwapValues = calcVWAP(candles);
    const bbValues = calcBollingerBands(candles);
    const macdValues = calculateMACD(candles);
    const adxValues = calculateADX(candles);
    const atrValues = calculateATR(candles);

    return {
        rsi: rsiValues.pop() ?? null,
        stoch: stochValues.pop() ?? null,
        ma: { 
            short: smaValues[smaValues.length-1] ?? null,
            long: emaValues[emaValues.length-1] ?? null,
        },
        macd: {
            macd: macdValues.macd.pop() ?? null,
            signal: macdValues.signal.pop() ?? null,
        },
        adx: adxValues.adx.pop() ?? null,
        atr: atrValues.pop() ?? null,
        priceAction: null, 
        ichimoku: null, 
        awesomeOscillator: null,
        volumePoc: null,

        // Full arrays for chart
        sma: smaValues,
        ema: emaValues,
        vwap: vwapValues,
        bollingerBands: bbValues,
    };
};
