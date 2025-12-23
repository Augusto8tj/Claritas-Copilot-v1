
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getHistoricalData } from '@/services/deriv-api-service';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import { useTradeAnalysis } from './use-trade-analysis';

type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
};
type CouncilVotes = { [key: string]: RobotVote };

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
interface RobotPerformance {
    id: string;
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}

// Indicator Calculation Helpers
const calculateMA = (data: { price: number }[], period: number) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const sum = relevantData.reduce((acc, tick) => acc + tick.price, 0);
    return sum / period;
};
const calculateEMA = (data: number[], period: number): number[] => {
    if (data.length < period) return [];
    let emaArray: number[] = [];
    emaArray.push(data.slice(0, period).reduce((a, b) => a + b, 0) / period);
    const k = 2 / (period + 1);
    for (let i = period; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[emaArray.length - 1] * (1 - k));
    }
    return emaArray;
};
const calculateRSI = (data: { price: number }[], period = 14) => {
    if (data.length < period + 1) return null;
    const prices = data.map(d => d.price);
    let gains = 0; let losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
};
const calculateStochastic = (data: { high: number, low: number, close: number }[], period = 14) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const lowestLow = Math.min(...relevantData.map(d => d.low));
    const highestHigh = Math.max(...relevantData.map(d => d.high));
    const currentClose = relevantData[relevantData.length - 1].close;
    if (highestHigh === lowestLow) return 50;
    return 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
};
const calculateMACD = (data: { price: number }[], fast = 12, slow = 26, signal = 9) => {
    if (data.length < slow) return null;
    const prices = data.map(d => d.price);
    const emaFast = calculateEMA(prices, fast);
    const emaSlow = calculateEMA(prices, slow);
    const macdLine: number[] = [];
    const startOffset = emaFast.length - emaSlow.length;
    for (let i = 0; i < emaSlow.length; i++) macdLine.push(emaFast[i + startOffset] - emaSlow[i]);
    const signalLine = calculateEMA(macdLine, signal);
    if (!macdLine.length || !signalLine.length) return null;
    return { macd: macdLine.pop()!, signal: signalLine.pop()! };
};
const detectPriceActionPattern = (data: { open: number, high: number, low: number, close: number }[]): string | null => {
    if (data.length < 1) return null;
    const { open, high, low, close } = data[data.length - 1];
    const body = Math.abs(open - close);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    if (lowerWick > body * 2 && upperWick < body) return 'hammer';
    if (upperWick > body * 2 && lowerWick < body) return 'shooting_star';
    return null;
};
const calculateADX = (data: { high: number, low: number, close: number }[], period = 14) => {
    if (data.length < period * 2) return null;
    let trs = [], plusDMs = [], minusDMs = [];
    for (let i = 1; i < data.length; i++) {
        const c = data[i], p = data[i - 1];
        trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
        const upMove = c.high - p.high, downMove = p.low - c.low;
        plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    const smoothedTR = calculateEMA(trs, period), smoothedPlusDM = calculateEMA(plusDMs, period), smoothedMinusDM = calculateEMA(minusDMs, period);
    const validLength = Math.min(smoothedTR.length, smoothedPlusDM.length, smoothedMinusDM.length);
    if (validLength === 0) return null;
    let plusDIs = [], minusDIs = [];
    for (let i = 0; i < validLength; i++) {
        plusDIs.push(smoothedTR[i] === 0 ? 0 : 100 * (smoothedPlusDM[i] / smoothedTR[i]));
        minusDIs.push(smoothedTR[i] === 0 ? 0 : 100 * (smoothedMinusDM[i] / smoothedTR[i]));
    }
    const dxs = plusDIs.map((plusDI, i) => (plusDI + minusDIs[i] === 0) ? 0 : 100 * (Math.abs(plusDI - minusDIs[i]) / (plusDI + minusDIs[i])));
    const adx = calculateEMA(dxs, period);
    return adx.length ? adx.pop()! : null;
};
const calculateATR = (data: { high: number, low: number, close: number }[], period = 14): number | null => {
    if (data.length < period) return null;
    let trs = [];
    for (let i = data.length - period; i < data.length; i++) {
        const c = data[i], p = data[i - 1];
        if (p) trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    }
    return trs.length ? trs.reduce((a, b) => a + b, 0) / trs.length : null;
};
const calculateIchimokuCloud = (data: { high: number, low: number, close: number }[]) => {
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
const calculateAwesomeOscillator = (data: { high: number, low: number }[]) => {
    if (data.length < 34) return null;
    const median = data.map(d => (d.high + d.low) / 2);
    const shortMA = median.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longMA = median.slice(-34).reduce((a, b) => a + b, 0) / 34;
    return shortMA - longMA;
};
const calculateVolumeProfile = (data: { close: number, volume?: number }[], bars: number) => {
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
const calculateVolatility = (data: { price: number }[], period = 20) => {
    if (data.length < period) return 0;
    const prices = data.slice(-period).map(d => d.price);
    const mean = prices.reduce((a, b) => a + b, 0) / period;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    return Math.sqrt(variance);
};

export function useRobotCouncil() {
    const { isConnected, activeSymbol, chartData, executeTrade, operationsLog, addActiveContract } = useDerivApi();
    const { analyzeLosingTrade } = useTradeAnalysis();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>([]);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});
    const [geminiRequestCount, setGeminiRequestCount] = useState(0);
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    
    const [indicators, setIndicators] = useState({
        rsi: null as number | null,
        stoch: null as number | null,
        ma: { short: null as number | null, long: null as number | null },
        bollingerBands: null as { upper: number, middle: number, lower: number } | null,
        macd: null as { macd: number, signal: number } | null,
        priceAction: null as string | null,
        adx: null as number | null,
        atr: null as number | null,
        ichimoku: null as { inCloud: boolean, trend: 'bullish' | 'bearish' | 'neutral' } | null,
        awesomeOscillator: null as number | null,
        volumePoc: null as number | null,
    });

    const councilExecutionRef = useRef({ isExecuting: false });

    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);

    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) {
            toast({ variant: "destructive", title: "Erro", description: "Símbolo do ativo não está selecionado." });
            setIsCouncilAutopilotOn(false);
            return;
        }
        setIsFetchingCouncil(true);
        try {
            const { duration_unit } = form.getValues();
            const historicalData = await getHistoricalData(activeSymbol, undefined, 200);
            if (!historicalData || historicalData.length < 50) throw new Error("Dados históricos insuficientes.");
            
            setGeminiRequestCount(prev => prev + 10);
            const result = await getStrategyCouncilAction({
                symbol: activeSymbol,
                balance: dailyBalance,
                currency: 'USD',
                historicalDataJson: JSON.stringify(historicalData),
                durationUnit: duration_unit,
            });
            if (result.success) {
                setStrategyCouncil(result.success.council);
                toast({ title: "Conselho Formado!", description: "As estratégias dos robôs foram definidas." });
            } else {
                throw new Error(result.error || "Erro desconhecido ao formar conselho.");
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao Formar Conselho", description: e.message });
            setStrategyCouncil([]);
        } finally {
            setIsFetchingCouncil(false);
        }
    }, [activeSymbol, dailyBalance, form, toast]);

    // Main logic trigger
    useEffect(() => {
        if (isCouncilAutopilotOn && !isFetchingCouncil && strategyCouncil.length === 0) {
            fetchStrategyCouncil();
        }
    }, [isCouncilAutopilotOn, isFetchingCouncil, strategyCouncil, fetchStrategyCouncil]);

    // Indicator calculation
    useEffect(() => {
        const candleData = chartData.filter(d => 'close' in d) as { open: number, high: number, low: number, close: number, volume?: number, price: number }[];
        if (candleData.length < 2) return;
        
        candleData.forEach(c => c.price = c.close); // Add price for RSI calc

        const maRobot = strategyCouncil.find(r => r.strategyType === 'MOVING_AVERAGE_CROSS');
        setIndicators({
            rsi: calculateRSI(candleData),
            stoch: calculateStochastic(candleData),
            ma: {
                short: maRobot?.shortPeriod ? calculateMA(candleData, maRobot.shortPeriod) : null,
                long: maRobot?.longPeriod ? calculateMA(candleData, maRobot.longPeriod) : null
            },
            bollingerBands: null, // Placeholder
            macd: calculateMACD(candleData),
            priceAction: detectPriceActionPattern(candleData),
            adx: calculateADX(candleData),
            atr: calculateATR(candleData),
            ichimoku: calculateIchimokuCloud(candleData),
            awesomeOscillator: calculateAwesomeOscillator(candleData),
            volumePoc: strategyCouncil.some(r => r.strategyType === 'VOLUME_PROFILE' && r.profileBars) 
                ? calculateVolumeProfile(candleData, strategyCouncil.find(r => r.strategyType === 'VOLUME_PROFILE')!.profileBars!) 
                : null
        });
    }, [chartData, strategyCouncil]);

    // Voting and Execution Logic
    useEffect(() => {
        if (!isCouncilAutopilotOn || !strategyCouncil.length || councilExecutionRef.current.isExecuting) return;

        const newVotes: CouncilVotes = {};
        let riseConfidenceSum = 0, fallConfidenceSum = 0;

        strategyCouncil.forEach(robot => {
            let vote: RobotVote['vote'] = 'HOLD', confidence = 0;
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = robotPerformance.find(p => p.id === robot.id);
                if (perf && (perf.wins + perf.losses) > 5) weight = 0.5 + (perf.wins / (perf.wins + perf.losses));
            }

            // Simplified voting logic for brevity
            switch(robot.strategyType) {
                case 'RSI': 
                    if(indicators.rsi && robot.strongBuyThreshold && indicators.rsi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                    else if (indicators.rsi && robot.weakBuyThreshold && indicators.rsi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                    // ... fall conditions
                    break;
                // ... other cases
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        setCouncilVotes(newVotes);

        const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= consensusThreshold;
        if (consensusReached) {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'rise' : 'fall';
            const stake = strategyCouncil[0].suggestedStake; // Simplified
            toast({ title: "Consenso Atingido!", description: `Executando ordem de ${direction.toUpperCase()}.` });
            executeTrade(direction === 'rise' ? 'CALL' : 'PUT', stake, activeSymbol!, direction, 5, 't', 'Conselho')
                .then(res => {
                    if (res.success && res.contractId) addActiveContract({ contractId: res.contractId, entryTick: res.entryTick!, entryTime: res.entryTime!, initiator: 'Conselho' });
                })
                .finally(() => setTimeout(() => councilExecutionRef.current.isExecuting = false, 10000));
        }

    }, [
        isCouncilAutopilotOn, strategyCouncil, indicators, consensusThreshold, isMeritocracyOn, robotPerformance, 
        executeTrade, activeSymbol, toast, addActiveContract
    ]);

    return {
        isCouncilAutopilotOn,
        setIsCouncilAutopilotOn,
        strategyCouncil,
        isFetchingCouncil,
        councilVotes,
        geminiRequestCount,
        dailyBalance,
        setDailyBalance,
        dailyTarget,
        setDailyTarget,
        consensusThreshold,
        setConsensusThreshold,
        isDynamicConsensusOn,
        setIsDynamicConsensusOn,
        isMeritocracyOn,
        setIsMeritocracyOn,
        indicators,
    };
}
