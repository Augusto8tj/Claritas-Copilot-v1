

/**
 * @fileOverview A service dedicated to calculating various technical trading indicators.
 */

import type { ChartData } from "@/hooks/use-market-data";
import type { RobotStrategy } from "@/ai/flows/strategy-council-flow.types";


// ===== PRIVATE UTILITY FUNCTIONS =====

const calculateEMA = (data: number[], period: number): number[] => {
    if (data.length < period) return [];
    let emaArray: number[] = [];
    const k = 2 / (period + 1);
    
    const initialSlice = data.slice(0, period);
    if(initialSlice.length > 0) {
      emaArray.push(initialSlice.reduce((a, b) => a + b, 0) / period);
    }
    
    for (let i = period; i < data.length; i++) {
        if (emaArray.length > 0) {
            emaArray.push(data[i] * k + emaArray[emaArray.length - 1] * (1 - k));
        }
    }
    return emaArray.slice(emaArray.length - data.length + period - 1);
};


// ===== PUBLIC INDICATOR FUNCTIONS =====

export const calculateMA = (data: { price: number }[], period: number) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const sum = relevantData.reduce((acc, tick) => acc + tick.price, 0);
    return sum / period;
};

export const calculateRSI = (data: { price: number }[], period = 14) => {
    if (data.length < period + 1) return null;
    const prices = data.map(d => d.price);
    let gains = 0; let losses = 0;
    
    // Using a simpler RSI calculation for recent values
    for (let i = prices.length - period; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
            gains += difference;
        } else {
            losses -= difference;
        }
    }

    if (losses === 0) return 100;
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;

    return 100 - (100 / (1 + rs));
};

export const calculateStochastic = (data: { high: number, low: number, close: number }[], period = 14) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const lowestLow = Math.min(...relevantData.map(d => d.low));
    const highestHigh = Math.max(...relevantData.map(d => d.high));
    const currentClose = relevantData[relevantData.length - 1].close;
    if (highestHigh === lowestLow) return 50;
    return 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
};

export const calculateMACD = (data: { price: number }[], fast = 12, slow = 26, signal = 9) => {
    if (data.length < slow) return null;
    const prices = data.map(d => d.price);
    const emaFast = calculateEMA(prices, fast);
    const emaSlow = calculateEMA(prices, slow);
    
    if (emaFast.length === 0 || emaSlow.length === 0) return null;

    const macdLine: number[] = [];
    const startOffset = emaFast.length - emaSlow.length;
    for (let i = 0; i < emaSlow.length; i++) {
        macdLine.push(emaFast[i + startOffset] - emaSlow[i]);
    }
    
    const signalLine = calculateEMA(macdLine, signal);
    const macdValue = macdLine.pop();
    const signalValue = signalLine.pop();
    
    if (macdValue === undefined || signalValue === undefined) return null;
    
    return { macd: macdValue, signal: signalValue };
};

export const detectPriceActionPattern = (data: { open: number, high: number, low: number, close: number }[]): string | null => {
    if (data.length < 1) return null;
    const { open, high, low, close } = data[data.length - 1];
    const body = Math.abs(open - close);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    if (lowerWick > body * 2 && upperWick < body * 0.5) return 'hammer';
    if (upperWick > body * 2 && lowerWick < body * 0.5) return 'shooting_star';
    return null;
};

export const calculateADX = (data: { high: number, low: number, close: number }[], period = 14) => {
    if (data.length < period * 2) return null;
    let trs = [], plusDMs = [], minusDMs = [];
    for (let i = 1; i < data.length; i++) {
        const c = data[i], p = data[i - 1];
        trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
        const upMove = c.high - p.high, downMove = p.low - c.low;
        plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    const smoothedTRs = calculateEMA(trs, period);
    const smoothedPlusDMs = calculateEMA(plusDMs, period);
    const smoothedMinusDMs = calculateEMA(minusDMs, period);
    
    const validLength = Math.min(smoothedTRs.length, smoothedPlusDMs.length, smoothedMinusDMs.length);
    if (validLength === 0) return null;
    
    let plusDIs = [], minusDIs = [];
    const plusDMsOffset = smoothedPlusDMs.length - validLength;
    const trsOffset = smoothedTRs.length - validLength;
    for (let i = 0; i < validLength; i++) {
        const tr = smoothedTRs[i + trsOffset];
        plusDIs.push(tr === 0 ? 0 : 100 * (smoothedPlusDMs[i + plusDMsOffset] / tr));
        minusDIs.push(tr === 0 ? 0 : 100 * (smoothedMinusDMs[i + plusDMsOffset] / tr));
    }
    
    const dxs = plusDIs.map((plusDI, i) => (plusDI + minusDIs[i] === 0) ? 0 : 100 * (Math.abs(plusDI - minusDIs[i]) / (plusDI + minusDIs[i])));
    const adx = calculateEMA(dxs, period);
    return adx.length ? adx.pop()! : null;
};

export const calculateATR = (data: { high: number, low: number, close: number }[], period = 14): number | null => {
    if (data.length < period) return null;
    let trs = [];
    const relevantData = data.slice(-(period + 1));
    for (let i = 1; i < relevantData.length; i++) {
        const c = relevantData[i], p = relevantData[i - 1];
        trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    }
    return trs.length ? trs.reduce((a, b) => a + b, 0) / trs.length : null;
};

export const calculateIchimokuCloud = (data: { high: number, low: number, close: number }[]) => {
    if (data.length < 52) return null;
    const last = data[data.length - 1];
    const tenkanSen = (Math.max(...data.slice(-9).map(d => d.high)) + Math.min(...data.slice(-9).map(d => d.low))) / 2;
    const kijunSen = (Math.max(...data.slice(-26).map(d => d.high)) + Math.min(...data.slice(-26).map(d => d.low))) / 2;
    const senkouSpanA = (tenkanSen + kijunSen) / 2;
    const pastDataForB = data.slice(-52, -26);
    const senkouSpanB = (Math.max(...pastDataForB.map(d => d.high)) + Math.min(...pastDataForB.map(d => d.low))) / 2;
    const inCloud = last.close > Math.min(senkouSpanA, senkouSpanB) && last.close < Math.max(senkouSpanA, senkouSpanB);
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (last.close > Math.max(senkouSpanA, senkouSpanB)) trend = 'bullish';
    if (last.close < Math.min(senkouSpanA, senkouSpanB)) trend = 'bearish';
    return { inCloud, trend };
};

export const calculateAwesomeOscillator = (data: { high: number, low: number }[]) => {
    if (data.length < 34) return null;
    const median = data.map(d => (d.high + d.low) / 2);
    const sma5 = median.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const sma34 = median.slice(-34).reduce((a, b) => a + b, 0) / 34;
    return sma5 - sma34;
};

export const calculateVolumeProfile = (data: { close: number, volume?: number }[], bars: number) => {
    if (data.length < bars) return null;
    const relevant = data.slice(-bars);
    const levels: { [k: string]: number } = {};
    relevant.forEach(c => {
        if (!c.close || !c.volume) return;
        const price = c.close.toFixed(4);
        levels[price] = (levels[price] || 0) + c.volume;
    });
    let poc = null, maxVol = 0;
    for (const price in levels) {
        if (levels[price] > maxVol) {
            maxVol = levels[price];
            poc = parseFloat(price);
        }
    }
    return poc;
};

export const calculateBollingerBands = (data: { close: number }[], period = 20, stdDev = 2) => {
    if (data.length < period) return data;
    
    return data.map((d, i, all) => {
        if (i < period - 1) return { ...d, bollingerUpper: undefined, bollingerLower: undefined };
        
        const slice = all.slice(i - period + 1, i + 1);
        const prices = slice.map(item => item.close);
        const mean = prices.reduce((acc, price) => acc + price, 0) / period;
        const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / period;
        const sd = Math.sqrt(variance);
        
        return {
            ...d,
            bollingerUpper: mean + stdDev * sd,
            bollingerLower: mean - stdDev * sd,
        };
    });
};

export const calculateVolatility = (data: { price: number }[], period = 20) => {
    if (data.length < period) return 0;
    const prices = data.slice(-period).map(d => d.price);
    const mean = prices.reduce((a, b) => a + b, 0) / period;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    return Math.sqrt(variance);
};

// ===== MAIN AGGREGATOR FUNCTION =====

export function calculateAllIndicators(chartData: ChartData[], strategyCouncil: RobotStrategy[]) {
    const candleData = chartData.filter(d => 'close' in d) as { open: number, high: number, low: number, close: number, volume?: number, price: number }[];
    if (candleData.length < 2) {
        return {
            rsi: null, stoch: null, ma: { short: null, long: null },
            bollingerBands: null, macd: null, priceAction: null, adx: null,
            atr: null, ichimoku: null, awesomeOscillator: null, volumePoc: null,
        };
    }
    
    candleData.forEach(c => c.price = c.close);

    const maRobot = strategyCouncil.find(r => r.strategyType === 'MOVING_AVERAGE_CROSS');
    const volumeRobot = strategyCouncil.find(r => r.strategyType === 'VOLUME_PROFILE');
    const bbRobot = strategyCouncil.find(r => r.strategyType === 'BOLLINGER_BANDS');

    const bands = bbRobot ? calculateBollingerBands(candleData, bbRobot.period, bbRobot.stdDev).pop() : undefined;


    return {
        rsi: calculateRSI(candleData),
        stoch: calculateStochastic(candleData),
        ma: {
            short: maRobot?.shortPeriod ? calculateMA(candleData, maRobot.shortPeriod) : null,
            long: maRobot?.longPeriod ? calculateMA(candleData, maRobot.longPeriod) : null,
        },
        bollingerBands: bands ? { upper: bands.bollingerUpper, lower: bands.bollingerLower } : null,
        macd: calculateMACD(candleData),
        priceAction: detectPriceActionPattern(candleData),
        adx: calculateADX(candleData),
        atr: calculateATR(candleData),
        ichimoku: calculateIchimokuCloud(candleData),
        awesomeOscillator: calculateAwesomeOscillator(candleData),
        volumePoc: volumeRobot?.profileBars ? calculateVolumeProfile(candleData, volumeRobot.profileBars) : null,
    };
}
