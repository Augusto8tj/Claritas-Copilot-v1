

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import { calculateAllIndicators } from '@/services/indicator-service';
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


export function useRobotCouncil(
    activeSymbol: string | null,
    operationsLog: any[],
    addActiveContract: (contract: any) => void,
    executeTrade: (...args: any[]) => Promise<any>,
    chartData: any[]
) {
    const { isConnected, getHistoricalData } = useDerivApi();
    const { analyzeLosingTrade } = useTradeAnalysis(activeSymbol, operationsLog);
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
    const [dynamicConsensus, setDynamicConsensus] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    
    const councilExecutionRef = useRef({ isExecuting: false });

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
    }, [activeSymbol, dailyBalance, form, toast, getHistoricalData]);

    // Main logic trigger
    useEffect(() => {
        if (isCouncilAutopilotOn && !isFetchingCouncil && strategyCouncil.length === 0) {
            fetchStrategyCouncil();
        }
    }, [isCouncilAutopilotOn, isFetchingCouncil, strategyCouncil, fetchStrategyCouncil]);

    // Indicator calculation
    useEffect(() => {
        if (!chartData || chartData.length < 2 || strategyCouncil.length === 0) return;
        const allIndicators = calculateAllIndicators(chartData, strategyCouncil);
        setIndicators(allIndicators);
    }, [chartData, strategyCouncil]);

    // Voting and Execution Logic
    useEffect(() => {
        if (!isCouncilAutopilotOn || !strategyCouncil.length || councilExecutionRef.current.isExecuting) return;

        let currentThreshold = consensusThreshold;
        if (isDynamicConsensusOn) {
            const baseThreshold = 250;
            const volatilityFactor = (indicators.atr ?? 0) * 1000;
            const dynamicThreshold = Math.round(baseThreshold + volatilityFactor);
            currentThreshold = Math.max(150, Math.min(700, dynamicThreshold));
            setDynamicConsensus(currentThreshold);
        }

        const newVotes: CouncilVotes = {};
        let riseConfidenceSum = 0, fallConfidenceSum = 0;

        strategyCouncil.forEach(robot => {
            let vote: RobotVote['vote'] = 'HOLD', confidence = 0;
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = robotPerformance.find(p => p.id === robot.id);
                if (perf && (perf.wins + perf.losses) > 3) {
                     const winRate = perf.wins / (perf.wins + perf.losses);
                     weight = 0.5 + winRate; // Weight from 0.5 to 1.5
                }
            }

            switch(robot.strategyType) {
                case 'RSI':
                    if(indicators.rsi && robot.strongBuyThreshold && indicators.rsi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                    else if (indicators.rsi && robot.weakBuyThreshold && indicators.rsi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                    else if (indicators.rsi && robot.strongSellThreshold && indicators.rsi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    else if (indicators.rsi && robot.weakSellThreshold && indicators.rsi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    break;
                 // Add more detailed voting logic for other strategies here in the future
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        setCouncilVotes(newVotes);

        const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= currentThreshold;
        if (consensusReached && activeSymbol) {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'rise' : 'fall';
            const stake = strategyCouncil[0].suggestedStake;
            toast({ title: "Consenso Atingido!", description: `Executando ordem de ${direction.toUpperCase()} com confiança de ${Math.round(Math.max(riseConfidenceSum, fallConfidenceSum))}.` });
            
            const { duration, duration_unit } = form.getValues();

            executeTrade(direction === 'rise' ? 'CALL' : 'PUT', stake, activeSymbol, direction, duration, duration_unit, 'Conselho')
                .then((res: any) => {
                    if (res.success && res.contractId) addActiveContract({ contractId: res.contractId, entryTick: res.entryTick!, entryTime: res.entryTime!, initiator: 'Conselho' });
                })
                .finally(() => setTimeout(() => { councilExecutionRef.current.isExecuting = false; }, 10000));
        }

    }, [
        isCouncilAutopilotOn, strategyCouncil, indicators, consensusThreshold, isDynamicConsensusOn, isMeritocracyOn, robotPerformance, 
        executeTrade, activeSymbol, toast, addActiveContract, form
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
        consensusThreshold: isDynamicConsensusOn ? dynamicConsensus : consensusThreshold,
        setConsensusThreshold,
        isDynamicConsensusOn,
        setIsDynamicConsensusOn,
        isMeritocracyOn,
        setIsMeritocracyOn,
        indicators,
    };
}
