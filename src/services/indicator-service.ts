

'use client';

/**
 * @fileOverview This service provides a centralized engine for calculating various financial technical indicators.
 * It is designed to be used on the client-side for real-time analysis.
 */

import type { CandleData, ChartData } from '@/hooks/types';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';

export interface Indicators {
    rsi: number | null;
    stoch: number | null;
    atr: number | null;
    adx: number | null;
    pdi: number | null;
    ndi: number | null;
    macd: { macd: number | null; signal: number | null; };
    ma: { short: number | null; long: number | null; };
    sma: (number | null)[];
    ema: (number | null)[];
    vwap: (number | null)[];
    bollingerBands: ({ upper: number; middle: number; lower: number } | null)[];
}

const isCandle = (d: ChartData): d is CandleData => 'close' in d;

const calculateSMA = (data: CandleData[], period: number): (number | null)[] => {
    if (data.length < period) return Array(data.length).fill(null);
    const smaValues: (number | null)[] = Array(period - 1).fill(null);
    let sum = 0;
    for(let i=0; i<period; i++) sum += data[i].close;
    smaValues.push(sum / period);
    for(let i=period; i<data.length; i++){
        sum = sum - data[i-period].close + data[i].close;
        smaValues.push(sum / period);
    }
    return smaValues;
}

const calculateEMA = (data: CandleData[], period: number): (number | null)[] => {
  if (data.length < period) return Array(data.length).fill(null);
  const k = 2 / (period + 1)
  const emaValues: (number | null)[] = Array(period - 1).fill(null);
  let sum = data.slice(0, period).reduce((acc, d) => acc + d.close, 0);
  emaValues.push(sum / period);

  for (let i = period; i < data.length; i++) {
    const prevEma = emaValues[i - 1];
    if(prevEma !== null) {
      emaValues.push(data[i].close * k + prevEma * (1 - k));
    } else {
      emaValues.push(null);
    }
  }
  return emaValues;
}

const calculateBollingerBands = (data: CandleData[], period = 20, stdDev = 2) => {
    if (data.length < period) return Array(data.length).fill(null);
    const bands: ({ upper: number; middle: number; lower: number } | null)[] = Array(period - 1).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const middle = slice.reduce((sum, d) => sum + d.close, 0) / period;
        const standardDeviation = Math.sqrt(slice.reduce((sum, d) => sum + Math.pow(d.close - middle, 2), 0) / period);
        bands.push({
            upper: middle + stdDev * standardDeviation,
            middle: middle,
            lower: middle - stdDev * standardDeviation
        });
    }
    return bands;
};

const calculateVWAP = (data: CandleData[]): (number | null)[] => {
    const vwapValues: (number | null)[] = [];
    let cumulativeTypicalPriceVolume = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (d.volume) {
            const typicalPrice = (d.high + d.low + d.close) / 3;
            cumulativeTypicalPriceVolume += typicalPrice * d.volume;
            cumulativeVolume += d.volume;
            vwapValues.push(cumulativeVolume > 0 ? cumulativeTypicalPriceVolume / cumulativeVolume : null);
        } else {
            vwapValues.push(null);
        }
    }
    return vwapValues;
};

const calculateRSI = (data: CandleData[], period = 14): (number | null)[] => {
    if (data.length < period + 1) return Array(data.length).fill(null);

    const rsiValues: (number | null)[] = Array(period).fill(null);
    let avgGain = 0;
    let avgLoss = 0;

    // First RSI calculation
    for (let i = 1; i <= period; i++) {
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

    // Subsequent RSI calculations
    for (let i = period + 1; i < data.length; i++) {
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

const calculateStochastic = (data: CandleData[], period = 14) => {
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
            kValues.push(i > 0 && kValues[i-1] ? kValues[i-1] : 50);
        } else {
            kValues.push(100 * ((currentClose - lowestLow) / (highestHigh - lowestLow)));
        }
    }
    return kValues;
};

const calculateMACD = (data: CandleData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (data.length < slowPeriod) return { macd: [], signal: [], histogram: [] };

    const emaFast = calculateEMA(data, fastPeriod);
    const emaSlow = calculateEMA(data, slowPeriod);
    
    const macdLine = data.map((_, i) => (emaFast[i] && emaSlow[i]) ? emaFast[i]! - emaSlow[i]! : null);
    
    const signalData = macdLine.map(v => v !== null ? { close: v, high:v, low:v, epoch:0, open:v } as CandleData : null).filter((v): v is CandleData => v !== null);

    const signalLineRaw = calculateEMA(signalData, signalPeriod);
    
    const fillLength = data.length - signalData.length;
    const signalLine = [...Array(fillLength).fill(null), ...signalLineRaw];

    const histogram = macdLine.map((m, i) => (m && signalLine[i]) ? m - signalLine[i]! : null);

    return { macd: macdLine, signal: signalLine, histogram };
};

const calculateATR = (data: CandleData[], period = 14): (number | null)[] => {
    if (data.length < period) return Array(data.length).fill(null);
    
    const trueRanges: (number | null)[] = [];
    for (let i = 1; i < data.length; i++) {
        const highLow = data[i].high - data[i].low;
        const highPrevClose = Math.abs(data[i].high - data[i-1].close);
        const lowPrevClose = Math.abs(data[i].low - data[i-1].close);
        trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
    
    const atrValues: (number | null)[] = Array(period).fill(null);
    
    let firstAtrSum = trueRanges.slice(0, period - 1).reduce((sum, val) => sum + (val || 0), 0);
    atrValues.push(firstAtrSum / period);
    
    for (let i = period; i < trueRanges.length; i++) {
        const prevAtr = atrValues[i-1];
        const tr = trueRanges[i-1];
        if (tr === null || prevAtr === null) {
            atrValues.push(null);
            continue;
        }
        const currentAtr = (prevAtr * (period - 1) + tr) / period;
        atrValues.push(currentAtr);
    }
    
    return [null, ...atrValues];
};

const calculateADX = (data: CandleData[], period = 14) => {
    if (data.length < period * 2) return { adx: Array(data.length).fill(null), pdi: [], ndi: [] };

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

    const smooth = (values: (number | null)[], smoothingPeriod: number) => {
        if(values.length < smoothingPeriod) return Array(values.length).fill(null);
        let smoothed: (number | null)[] = Array(smoothingPeriod-1).fill(null);
        const initialSum = values.slice(0, smoothingPeriod).reduce((acc, v) => acc + (v||0), 0);
        smoothed.push(initialSum);

        for (let i = smoothingPeriod; i < values.length; i++) {
             const prevSmoothed = smoothed[i-1];
             if(prevSmoothed !== null && values[i] !== null){
                smoothed.push(prevSmoothed - (prevSmoothed / smoothingPeriod) + (values[i] || 0));
             } else {
                smoothed.push(null);
             }
        }
        return smoothed;
    };

    const smoothedPDI = smooth(pdi, period);
    const smoothedNDI = smooth(ndi, period);
    const smoothedTR = smooth(trs, period);
    
    let pdiFinal: (number | null)[] = [], ndiFinal: (number | null)[] = [], dx: (number | null)[] = [];

    for(let i=0; i< smoothedTR.length; i++){
        if(!smoothedTR[i] || smoothedTR[i] === 0 || smoothedPDI[i] === null || smoothedNDI[i] === null) {
             pdiFinal.push(null);
             ndiFinal.push(null);
             continue;
        };
        pdiFinal.push(100 * (smoothedPDI[i]! / smoothedTR[i]!));
        ndiFinal.push(100 * (smoothedNDI[i]! / smoothedTR[i]!));
    }
    
    for (let i = 0; i < pdiFinal.length; i++) {
        const p = pdiFinal[i];
        const n = ndiFinal[i];
        if (p === null || n === null) { dx.push(null); continue; }
        const den = p + n;
        dx.push(den === 0 ? 0 : 100 * Math.abs(p - n) / den);
    }
    
    const adxRaw = smooth(dx.filter((v): v is number => v !== null), period);
    
    const fillCount = data.length - adxRaw.length;
    const adx = Array(fillCount).fill(null).concat(adxRaw);
    
    return { adx, pdi: pdiFinal, ndi: ndiFinal };
};


export function calculateAllIndicators(chartData: ChartData[], strategyCouncil: RobotStrategy[]): Indicators {
    
    let candles: CandleData[];

    // Convert Tick data to Candle data if needed
    if (chartData.length > 0 && !isCandle(chartData[0])) {
        candles = chartData.map(d => {
            const price = (d as { price: number }).price;
            return { epoch: d.epoch, open: price, high: price, low: price, close: price, volume: (d as any).volume || 1 };
        });
    } else {
        candles = chartData.filter(isCandle);
    }

    if (candles.length < 2) {
        return {
            rsi: null, stoch: null, atr: null, adx: null, pdi: null, ndi: null,
            macd: { macd: null, signal: null }, ma: { short: null, long: null },
            sma: [], ema: [], vwap: [], bollingerBands: [],
        };
    }

    const indicators: Partial<Indicators> = {};

    const rsiRobot = strategyCouncil.find(r => r.strategyType === 'RSI');
    const rsiValues = calculateRSI(candles, rsiRobot?.period || 14);
    indicators.rsi = rsiValues[rsiValues.length - 1] ?? null;

    const stochRobot = strategyCouncil.find(r => r.strategyType === 'STOCHASTIC');
    const stochValues = calculateStochastic(candles, stochRobot?.period || 14);
    indicators.stoch = stochValues[stochValues.length - 1] ?? null;
    
    const macdRobot = strategyCouncil.find(r => r.strategyType === 'MACD_CROSS');
    const macdValues = calculateMACD(candles, macdRobot?.fastPeriod || 12, macdRobot?.slowPeriod || 26, macdRobot?.signalPeriod || 9);
    indicators.macd = { 
        macd: macdValues.macd[macdValues.macd.length - 1] ?? null,
        signal: macdValues.signal[macdValues.signal.length - 1] ?? null,
    };

    const adxRobot = strategyCouncil.find(r => r.strategyType === 'ADX_TREND');
    const adxValues = calculateADX(candles, adxRobot?.period || 14);
    indicators.adx = adxValues.adx[adxValues.adx.length - 1] ?? null;
    indicators.pdi = adxValues.pdi[adxValues.pdi.length - 1] ?? null;
    indicators.ndi = adxValues.ndi[adxValues.ndi.length - 1] ?? null;

    const atrValues = calculateATR(candles);
    indicators.atr = atrValues[atrValues.length - 1] ?? null;

    const maRobot = strategyCouncil.find(r => r.strategyType === 'MOVING_AVERAGE_CROSS');
    const emaValues = calculateEMA(candles, maRobot?.shortPeriod || 20);
    const smaValues = calculateSMA(candles, maRobot?.longPeriod || 50);

    indicators.ema = emaValues;
    indicators.sma = smaValues;

    indicators.ma = {
        short: emaValues.length > 0 ? emaValues[emaValues.length - 1] : null,
        long: smaValues.length > 0 ? smaValues[smaValues.length - 1] : null,
    };

    const bbRobot = strategyCouncil.find(r => r.strategyType === 'BOLLINGER_BANDS');
    indicators.bollingerBands = bbRobot ? calculateBollingerBands(candles, bbRobot.period || 20, bbRobot.stdDev || 2) : [];
    indicators.vwap = calculateVWAP(candles);

    return indicators as Indicators;
}
