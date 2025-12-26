

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import { useTradeAnalysis } from './use-trade-analysis';
import type { Operation, OperationInitiator } from '@/components/trading/operations-log.types';
import type { ActiveContract } from './use-deriv-api';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface.types';
import type { TradeResult } from '@/services/deriv-api-service';


export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
};
export type CouncilVotes = { [key: string]: RobotVote };

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
export interface RobotPerformance {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    wins: number;
    losses: number;
    totalProfit: number;
}


export function useRobotCouncil(
    activeSymbol: string | null,
    operationsLog: Operation[],
    addActiveContract: (contract: ActiveContract) => void,
    executeTrade: (
        contractType: string,
        stake: number,
        symbol: string,
        tradeDirection: 'rise' | 'fall',
        duration: number,
        durationUnit: DurationUnit,
        initiator: OperationInitiator
    ) => Promise<TradeResult>,
    indicators: any
) {
    const { isConnected, getHistoricalData, chartData } = useDerivApi();
    const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog);
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
    const [lastCouncilLossSuggestion, setLastCouncilLossSuggestion] = useState<string | null>(null);
    
    const councilExecutionRef = useRef({ isExecuting: false });

    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);
    
    useEffect(() => {
        if (!operationsLog || operationsLog.length === 0) return;
        const lastOp = operationsLog[0];
        if (lastOp && lastOp.status === 'lost' && lastOp.initiator === 'Conselho') {
            // A null strategy is passed because the council doesn't have a single "active strategy"
            tradeAnalysis.analyzeLosingTrade(lastOp, null).then(suggestion => {
                if (suggestion) {
                    setLastCouncilLossSuggestion(suggestion);
                    toast({
                        title: "Feedback do Analista de Perdas",
                        description: `Nova diretriz para o conselho: ${suggestion}`,
                        duration: 8000,
                    });
                }
            });
        }
    }, [operationsLog, tradeAnalysis, toast]);


    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) {
            return;
        }
        setIsFetchingCouncil(true);
        try {
            const { duration_unit } = form.getValues();
            const historicalData = await getHistoricalData(activeSymbol, undefined, 200);
            if (!historicalData || historicalData.length < 50) throw new Error("Dados históricos insuficientes.");
            
            setGeminiRequestCount(prev => prev + 1); // Only 1 call now
            const result = await getStrategyCouncilAction({
                symbol: activeSymbol,
                balance: dailyBalance,
                currency: 'USD',
                historicalDataJson: JSON.stringify(historicalData),
                durationUnit: duration_unit,
            });
            if (result.success) {
                setStrategyCouncil(result.success.council);
                toast({ title: "Conselho Formado!", description: "As estratégias dos analistas foram definidas." });
                 if(lastCouncilLossSuggestion) setLastCouncilLossSuggestion(null); // Limpa a sugestão depois de usada
            } else {
                throw new Error(result.error || "Erro desconhecido ao formar conselho.");
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao Formar Conselho", description: e.message });
            setStrategyCouncil([]);
        } finally {
            setIsFetchingCouncil(false);
        }
    }, [activeSymbol, dailyBalance, form, toast, getHistoricalData, lastCouncilLossSuggestion]);

    useEffect(() => {
        if (isCouncilAutopilotOn && activeSymbol && !isFetchingCouncil && strategyCouncil.length === 0) {
            fetchStrategyCouncil();
        }
    }, [isCouncilAutopilotOn, activeSymbol, isFetchingCouncil, strategyCouncil.length, fetchStrategyCouncil]);
    
    const supervisionCommitteeCheck = useCallback((stake: number, direction: 'RISE' | 'FALL') => {
        let finalStake = stake;
        let vetoReason: string | null = null;
    
        // 1. Analista de Risco
        const dailyPnL = operationsLog
            .filter(op => op.initiator === 'Conselho' && op.status !== 'pending' && new Date(op.timestamp).toDateString() === new Date().toDateString())
            .reduce((sum, op) => sum + (op.result || 0), 0);

        if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
            vetoReason = "Limite de perda diária atingido. Operações bloqueadas.";
        } else if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
            vetoReason = "Meta de lucro diária atingida. Operações bloqueadas.";
        }
    
        if (vetoReason) return { finalStake, vetoReason };

        // 2. Analista de Volatilidade (ATR)
        const atr = indicators.atr;
        const lastPrice = chartData.length > 0 ? ('price' in chartData[chartData.length-1] ? chartData[chartData.length-1].price : (chartData[chartData.length-1] as any).close) : 0;

        if (atr && lastPrice > 0) {
            const normalizedATR = atr / lastPrice; 
            if (normalizedATR > 0.0005) { // Ex: Volatilidade muito alta
                finalStake *= 0.5;
                toast({ title: "Supervisor de Volatilidade", description: "Mercado turbulento, risco reduzido para 50%.", variant: "default" });
            } else if (normalizedATR < 0.0001) { // Ex: Volatilidade muito baixa
                finalStake *= 0.75;
                toast({ title: "Supervisor de Volatilidade", description: "Mercado parado, risco reduzido para 75%.", variant: "default" });
            }
        }
    
        // 3. Analista de Tendência (ADX)
        const adx = indicators.adx;
        if (adx) {
            if (adx < 20) { // Mercado lateral
                finalStake *= 0.75;
                toast({ title: "Supervisor de Tendência", description: "Mercado lateral, risco reduzido para 75%.", variant: "default" });
            } else if (adx > 35) { // Tendência forte
                finalStake *= 1.25; // Aumenta o risco em 25%
                toast({ title: "Supervisor de Tendência", description: "Tendência forte confirmada, risco aumentado em 25%.", variant: "default" });
            }
        }

        // Garante que o stake não seja menor que o mínimo
        if (finalStake < 0.35) finalStake = 0.35;
        
        return { finalStake, vetoReason };

    }, [operationsLog, dailyBalance, dailyTarget, indicators.atr, indicators.adx, chartData, toast]);

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
                     weight = 0.5 + winRate;
                }
            }

            switch(robot.strategyType) {
                case 'RSI':
                    if(indicators.rsi && robot.strongBuyThreshold && indicators.rsi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                    else if (indicators.rsi && robot.weakBuyThreshold && indicators.rsi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                    else if (indicators.rsi && robot.strongSellThreshold && indicators.rsi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    else if (indicators.rsi && robot.weakSellThreshold && indicators.rsi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    break;
                 // Adicionar lógica de votação para outros tipos de robôs aqui...
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        setCouncilVotes(newVotes);

        const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= currentThreshold;
        if (consensusReached && activeSymbol) {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const baseStake = strategyCouncil[0].suggestedStake;

            const { finalStake, vetoReason } = supervisionCommitteeCheck(baseStake, direction);

            if (vetoReason) {
                toast({ title: "Operação Vetada", description: vetoReason, variant: "destructive" });
                councilExecutionRef.current.isExecuting = false;
                if(vetoReason.includes("Limite de perda") || vetoReason.includes("Meta de lucro")){
                    setIsCouncilAutopilotOn(false); // Desliga o piloto
                }
                return;
            }
            
            toast({ title: "Consenso Atingido!", description: `Executando ${direction} com stake ajustado de $${finalStake.toFixed(2)}.` });
            
            const { duration, duration_unit } = form.getValues();

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', duration, duration_unit, 'Conselho')
                .then((res: any) => {
                    if (res.success && res.contractId) addActiveContract({ contractId: res.contractId, entryTick: res.entryTick!, entryTime: res.entryTime!, initiator: 'Conselho' });
                })
                .finally(() => setTimeout(() => { councilExecutionRef.current.isExecuting = false; }, 10000));
        }

    }, [
        isCouncilAutopilotOn, strategyCouncil, indicators, consensusThreshold, isDynamicConsensusOn, isMeritocracyOn, robotPerformance, 
        executeTrade, activeSymbol, toast, addActiveContract, form, supervisionCommitteeCheck
    ]);

    return {
        isCouncilAutopilotOn,
        setIsCouncilAutopilotOn,
        strategyCouncil,
        fetchStrategyCouncil,
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
