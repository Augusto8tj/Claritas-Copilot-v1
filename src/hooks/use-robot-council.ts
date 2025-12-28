
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncil } from '@/ai/flows/strategy-council-flow';
import type { StrategyCouncilInput, RobotStrategy, StrategyCouncilOutput } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData } from './types';
import type { Operation, OperationInitiator } from '@/components/trading/operations-log.types';


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

    // --- State for new supervisor personas ---
    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<{ status: 'inactive' | 'approved' | 'veto', message: string, analysis?: string }>({ status: 'inactive', message: 'Aguardando consenso.' });
    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });

    const incrementGeminiRequestCount = () => setGeminiRequestCount(prev => prev + 1);
    
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);

    const updateRobotPerformance = useCallback((operation: Operation) => {
        if (operation.initiator !== 'Conselho') return;
        
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
            const alreadyProcessed = robotPerformance.some(p => p.totalProfit !== 0); 
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

        const input: StrategyCouncilInput = {
            symbol: activeSymbol,
            balance: dailyBalance,
            currency: "USD",
            historicalDataJson,
            durationUnit: form.getValues('duration_unit'),
            timePeriod: timePeriod
        };
        
        try {
            const result: StrategyCouncilOutput = await getStrategyCouncil(input);
            setStrategyCouncil(result.council);
            toast({ title: "Conselho de IA Montado!", description: `${result.council.length} analistas foram calibrados e estão prontos.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao Montar Conselho", description: e.message || "Ocorreu um erro desconhecido." });
        } finally {
            setIsFetchingCouncil(false);
        }

    }, [activeSymbol, chartData, dailyBalance, form, toast, incrementGeminiRequestCount, timePeriod]);
    
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

    const committeeOfSpecialists = useCallback((indicators: Indicators, timePeriod: TimePeriod): string => {
        if (!indicators.adx || !indicators.bbw) return "Comité Indefinido";

        if (indicators.adx > 25) return "Especialistas em Tendência";
        if (indicators.bbw < 0.05) return "Especialistas em Volatilidade (Squeeze)";
        if (indicators.stoch && (indicators.stoch < 20 || indicators.stoch > 80)) return "Especialistas em Reversão";

        return "Comité Geral";
    }, []);

    const supervisionCommitteeCheck = useCallback((
        riseSum: number,
        fallSum: number,
        consensusThreshold: number,
        indicators: Indicators,
        dailyPnl: number
    ): { finalStake: number, finalDuration: number, status: 'approved' | 'veto', message: string, analysis?: string } => {
        
        const { stake, duration } = form.getValues();

        // Rule 1: P&L Management (Hard Veto)
        if (dailyPnl <= -dailyBalance) {
            return { status: 'veto', message: 'Veto: Limite de perda diário atingido.', finalStake: stake, finalDuration: duration };
        }
        if (dailyPnl >= dailyTarget) {
            return { status: 'veto', message: 'Veto: Meta de lucro diária atingida.', finalStake: stake, finalDuration: duration };
        }

        const consensusReached = Math.max(riseSum, fallSum) >= consensusThreshold;
        if (!consensusReached) {
            return { status: 'inactive', message: 'Aguardando consenso tático.', finalStake: stake, finalDuration: duration };
        }

        // Rule 2: Risk Adjustment
        let finalStake = stake;
        let finalDuration = duration;
        let analysis = "Risco padrão.";

        if (indicators.adx && indicators.adx < 20) {
            finalStake *= 0.75; // Reduce risk in non-trending market
            analysis = "Risco reduzido: mercado sem tendência clara (ADX baixo).";
        }
        if (indicators.atr && indicators.atr > (chartData[chartData.length-1]?.close * 0.0001)) { // ATR is 0.01% of price
            finalStake *= 0.75; // Reduce risk in high volatility
            finalDuration = Math.max(duration + 2, 7); // Increase duration to survive noise
            analysis = "Risco e duração ajustados: alta volatilidade (ATR alto).";
        }

        if(riseSum > fallSum && indicators.stoch && indicators.stoch < 20 && indicators.rsi && indicators.rsi < 30) {
            analysis = "Setup de reversão de alta confiança detetado (sobrevenda).";
        }

        return { status: 'approved', message: 'Aprovado. Risco avaliado.', analysis, finalStake: Math.max(0.35, finalStake), finalDuration };

    }, [form, dailyBalance, dailyTarget, chartData]);

    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators || !activeSymbol) return;

        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};
        
        // --- TACTICAL COMMITTEE (ANALYSTS) ---
        strategyCouncil.forEach(robot => {
            let vote: RobotVote['vote'] = 'HOLD', confidence = 0;
            let weight = 1.0;

            if (isMeritocracyOn) {
                const perf = robotPerformance.find(p => p.id === robot.id);
                if (perf && (perf.wins + perf.losses) > 3) {
                     const winRate = perf.wins / (perf.wins + perf.losses);
                     weight = 0.75 + winRate; 
                }
            }

            if (robot.strategyType === 'RSI' && indicators.rsi) {
                if (indicators.rsi >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
                else if (indicators.rsi >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
                else if (indicators.rsi <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
                else if (indicators.rsi <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
            }
            if (robot.strategyType === 'STOCHASTIC' && indicators.stoch) {
                if (indicators.stoch >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
                else if (indicators.stoch >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
                else if (indicators.stoch <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
                else if (indicators.stoch <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
            }
            if (robot.strategyType === 'MACD_CROSS' && indicators.macd.macd && indicators.macd.signal) {
                 if(indicators.macd.macd > indicators.macd.signal && (indicators.macd.macd - indicators.macd.signal) > (indicators.macd.signal * 0.0001)) { vote = 'RISE'; confidence = robot.weakConfidence; }
                 if(indicators.macd.signal > indicators.macd.macd && (indicators.macd.signal - indicators.macd.macd) > (indicators.macd.signal * 0.0001)) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });

        // --- SUPERVISION COMMITTEE (RISK MANAGEMENT) ---
        const dailyPnl = operationsLog.filter(op => new Date(op.timestamp).toDateString() === new Date().toDateString()).reduce((sum, op) => sum + (op.result || 0), 0);
        const supervisionDecision = supervisionCommitteeCheck(riseConfidenceSum, fallConfidenceSum, consensusThreshold, indicators, dailyPnl);
        setSupervisionStatus(supervisionDecision);

        if (supervisionDecision.status === 'approved') {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const { finalStake, finalDuration } = supervisionDecision;
            
            toast({ title: "Conselho Executou Ordem!", description: `Direção: ${direction}, Stake: $${finalStake.toFixed(2)}, Duração: ${finalDuration} ticks.` });

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', finalDuration, form.getValues('duration_unit'), 'Conselho')
                .finally(() => setTimeout(() => councilExecutionRef.current.isExecuting = false, 10000));
        }

    }, [indicators, isCouncilAutopilotOn, strategyCouncil, consensusThreshold, isMeritocracyOn, robotPerformance, executeTrade, activeSymbol, toast, form, operationsLog, supervisionCommitteeCheck]);

    const processNewChartData = useCallback((data: ChartData[]) => {
        if (data.length > 0) {
            const calculatedIndicators = calculateAllIndicators(data, strategyCouncil, timePeriod);
            setIndicators(calculatedIndicators);
            setActiveCommittee(committeeOfSpecialists(calculatedIndicators, timePeriod));
        }
    }, [strategyCouncil, timePeriod, committeeOfSpecialists]);
    
    // Recalculate indicators whenever chartData changes
    useEffect(() => {
        processNewChartData(chartData);
    }, [chartData, processNewChartData]);


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
        activeCommittee,
        supervisionStatus,
        consensusSum,
    };
}
