
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { StrategyCouncilInput, RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData } from './types';
import type { Operation } from '@/components/trading/operations-log.types';


export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
};
export type CouncilVotes = { [key:string]: RobotVote };

export type ManualPromptBatch = {
    id: string;
    theme: string;
    prompt: string;
    isCompleted: boolean;
};

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
export interface RobotPerformance {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}


export function useRobotCouncil(
    activeSymbol: string | null,
) {
    const { operationsLog, executeTrade, chartData, timePeriod } = useDerivApi();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();
    
    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>([]);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});
    const [dailyBalance, setDailyBalance] = useState(100);
    const [manualPromptBatches, setManualPromptBatches] = useState<ManualPromptBatch[]>([]);
    const [geminiRequestCount, setGeminiRequestCount] = useState(0);

    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);

    
    const councilExecutionRef = useRef({ isExecuting: false });

    const [indicators, setIndicators] = useState<Indicators | null>(null);

    const incrementGeminiRequestCount = () => setGeminiRequestCount(prev => prev + 1);
    
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);

    const updateRobotPerformance = useCallback((operation: Operation) => {
        if (operation.initiator !== 'Conselho') return;
        
        // This is a simplified logic. A real system would know which vote "won".
        // Here we attribute win/loss to all who voted in the trade direction.
        const contributingRobots = Object.entries(councilVotes)
            .filter(([_, voteData]) => voteData.vote === operation.direction.toUpperCase())
            .map(([robotId, _]) => robotId);

        if (contributingRobots.length === 0) return;

        let updatedPerformance = [...robotPerformance];

        contributingRobots.forEach(robotId => {
            const robotStrategy = strategyCouncil.find(s => s.id === robotId);
            if (!robotStrategy) return;

            let perf = updatedPerformance.find(p => p.id === robotId);
            if (!perf) {
                perf = { id: robotId, strategy: robotStrategy, strategyType: robotStrategy.strategyType, wins: 0, losses: 0, totalProfit: 0 };
                updatedPerformance.push(perf);
            }

            if (operation.status === 'won') {
                perf.wins++;
            } else {
                perf.losses++;
            }
            perf.totalProfit += operation.result || 0;
        });

        localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(updatedPerformance));
        setRobotPerformance(updatedPerformance);

    }, [councilVotes, robotPerformance, strategyCouncil]);

     useEffect(() => {
        const lastOp = operationsLog[0];
        if (lastOp && lastOp.status !== 'pending' && lastOp.initiator === 'Conselho') {
            // A simple check to avoid reprocessing the same operation
            const alreadyProcessed = robotPerformance.some(p => p.totalProfit !== 0); // This is a weak check
            if(!alreadyProcessed || operationsLog.length > robotPerformance.reduce((acc, p) => acc + p.wins + p.losses, 0)) {
               updateRobotPerformance(lastOp);
            }
        }
    }, [operationsLog, updateRobotPerformance, robotPerformance]);


    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol || !chartData || chartData.length < 50) {
            toast({ variant: "destructive", title: "Dados Insuficientes", description: "Necessário mais dados de mercado para construir o conselho." });
            return;
        }
        setIsFetchingCouncil(true);
        setManualPromptBatches([]);
        const historicalDataJson = JSON.stringify(chartData.map(d => ({
            epoch: d.epoch,
            price: 'price' in d ? d.price : d.close
        })));
        
        incrementGeminiRequestCount();
        const result = await getStrategyCouncilAction({
            symbol: activeSymbol,
            balance: dailyBalance,
            currency: "USD",
            historicalDataJson,
            durationUnit: form.getValues('duration_unit'),
        });
        
        if (result.success?.council) {
            setStrategyCouncil(result.success.council);
            toast({ title: "Conselho de IA Montado!", description: `${result.success.council.length} analistas foram calibrados e estão prontos.` });
        } else if (result.prompts) {
            setManualPromptBatches(result.prompts.map((p, i) => ({ ...p, id: `batch-${i}`, isCompleted: false })));
            toast({ title: "Modo Manual Ativado", description: "Siga os passos para construir o conselho manualmente." });
        } else {
            toast({ variant: "destructive", title: "Erro ao Montar Conselho", description: result.error || "Ocorreu um erro desconhecido." });
        }
        setIsFetchingCouncil(false);
    }, [activeSymbol, chartData, dailyBalance, form, toast, incrementGeminiRequestCount]);
    
    const processManualCouncilResponse = (batchId: string, responseText: string) => {
        try {
            const responseJson = JSON.parse(responseText);
            if (!responseJson.council || !Array.isArray(responseJson.council)) {
                throw new Error("O JSON de resposta não contém uma propriedade 'council' do tipo array.");
            }
            setStrategyCouncil(prev => [...prev, ...responseJson.council]);
            setManualPromptBatches(prev => prev.map(b => b.id === batchId ? { ...b, isCompleted: true } : b));
            toast({ title: `Lote ${batchId} Processado!`, description: `${responseJson.council.length} analistas adicionados ao conselho.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Erro ao Processar Resposta", description: `JSON inválido ou formato incorreto. ${e.message}` });
        }
    };

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setManualPromptBatches([]);
        setIsCouncilAutopilotOn(false);
    };

    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators) return;

        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        
        const newVotes: CouncilVotes = {};
        
        strategyCouncil.forEach(robot => {
            let vote: RobotVote['vote'] = 'HOLD', confidence = 0;
            let weight = 1.0;

            if (isMeritocracyOn) {
                const perf = robotPerformance.find(p => p.id === robot.id);
                if (perf && (perf.wins + perf.losses) > 5) { // Needs some history
                     const winRate = perf.wins / (perf.wins + perf.losses);
                     weight = 0.5 + winRate; // Weight between 0.5 and 1.5
                }
            }

            // Simplified voting logic for now
            if (robot.strategyType === 'RSI' && indicators.rsi) {
                if (robot.strongBuyThreshold && indicators.rsi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                else if (robot.weakBuyThreshold && indicators.rsi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                else if (robot.strongSellThreshold && indicators.rsi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                else if (robot.weakSellThreshold && indicators.rsi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }
             if (robot.strategyType === 'STOCHASTIC' && indicators.stoch) {
                if (robot.strongBuyThreshold && indicators.stoch <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                else if (robot.weakBuyThreshold && indicators.stoch <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                else if (robot.strongSellThreshold && indicators.stoch >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                else if (robot.weakSellThreshold && indicators.stoch >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }

            newVotes[robot.id] = { vote, confidence, weight };

            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });

        setCouncilVotes(newVotes);

        const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= consensusThreshold;

        if (consensusReached && activeSymbol) {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const { stake, duration, duration_unit } = form.getValues();
            
            toast({ title: "Consenso Atingido!", description: `Executando ordem de ${direction}.` });

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', stake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', duration, duration_unit, 'Conselho')
                .finally(() => setTimeout(() => councilExecutionRef.current.isExecuting = false, 10000));
        }
    }, [indicators, isCouncilAutopilotOn, strategyCouncil, consensusThreshold, isMeritocracyOn, robotPerformance, executeTrade, activeSymbol, toast, form]);

    const processNewChartData = useCallback((data: ChartData[]) => {
        if (data.length > 0) {
            const calculatedIndicators = calculateAllIndicators(data, strategyCouncil, timePeriod);
            setIndicators(calculatedIndicators);
        }
    }, [strategyCouncil, timePeriod]);
    

    return {
        isCouncilAutopilotOn,
        setIsCouncilAutopilotOn,
        strategyCouncil,
        fetchStrategyCouncil,
        dissolveCouncil,
        isFetchingCouncil,
        councilVotes,
        dailyBalance,
        setDailyBalance,
        dailyTarget,
        setDailyTarget,
        consensusThreshold,
        setConsensusThreshold,
        isMeritocracyOn,
        setIsMeritocracyOn,
        manualPromptBatches,
        processManualCouncilResponse,
        geminiRequestCount,
        incrementGeminiRequestCount,
        processNewChartData,
        indicators,
    };
}
