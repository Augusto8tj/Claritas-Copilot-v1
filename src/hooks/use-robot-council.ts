
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
    chartData: ChartData[]
) {
    const { operationsLog, executeTrade, timePeriod } = useDerivApi();
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
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
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

    const committeeOfSpecialists = useCallback((indicators: Indicators, timePeriod: string): string => {
        if (!indicators.adx || !indicators.bbw) return "Comité Indefinido";
    
        if (timePeriod.endsWith('h') || timePeriod.endsWith('d')) {
            if (indicators.adx > 25) return "Gestão de Tendência Macro";
            return "Análise de Ciclo Macro";
        }
    
        if (timePeriod.includes('m') && (parseInt(timePeriod) >= 10)) {
             if (indicators.adx > 25) return "Especialistas em Tendência Intraday";
             if (indicators.bbw < 0.05) return "Caçadores de Rompimento (Squeeze)";
             return "Comité Geral Intraday";
        }
    
        // HFT / Scalping
        if (indicators.stoch && (indicators.stoch < 20 || indicators.stoch > 80)) return "Especialistas em Reversão Rápida";
        if (indicators.bbw > 0.1) return "Jogadores de Volatilidade";
        return "Equipa de Scalping Padrão";
    
    }, []);

    const supervisionCommitteeCheck = useCallback((
        riseSum: number,
        fallSum: number,
        consensusThreshold: number,
        indicators: Indicators,
        dailyPnl: number
    ): { finalStake: number, finalDuration: number, status: 'approved' | 'veto' | 'inactive', message: string, analysis?: string } => {
        
        const { stake, duration } = form.getValues();
        let finalStake = stake;
        let finalDuration = duration;

        // Rule 1: P&L Management (Hard Veto)
        if (dailyPnl <= -dailyBalance) {
            setIsCouncilAutopilotOn(false);
            return { status: 'veto', message: 'VETO: Limite de perda diário atingido.', finalStake, finalDuration };
        }
        if (dailyPnl >= dailyTarget) {
             setIsCouncilAutopilotOn(false);
            return { status: 'veto', message: 'VETO: Meta de lucro diária atingida.', finalStake, finalDuration };
        }

        const consensusReached = Math.max(riseSum, fallSum) >= consensusThreshold;
        if (!consensusReached) {
            return { status: 'inactive', message: 'Aguardando consenso tático.', finalStake, finalDuration };
        }

        // Rule 2: Risk Adjustment
        let analysis = "Risco padrão.";
        const direction = riseSum > fallSum ? 'RISE' : 'FALL';
        
        // Em HFT, o ajuste é rápido e brutal.
        const isHFT = timePeriod.includes('t') || timePeriod.endsWith('s') || parseInt(timePeriod) <= 5;
        
        if (isHFT) {
            // Se operamos reversão (Stoch extremo), mas VWAP está longe, reduzimos o risco.
            if (indicators.stoch && ((direction === 'RISE' && indicators.stoch < 20) || (direction === 'FALL' && indicators.stoch > 80))) {
                analysis = "Setup de reversão de HFT detetado."
                const currentPrice = chartData[chartData.length - 1]?.close;
                const vwap = indicators.vwap?.[indicators.vwap.length -1];
                if (currentPrice && vwap && Math.abs(currentPrice - vwap) / vwap > 0.0005) { // 0.05% de distância
                    finalStake *= 0.7;
                    analysis += " Risco reduzido: operando longe da VWAP."
                }
            }
        } else { // Para períodos mais longos
            if (indicators.adx && indicators.adx < 20) {
                finalStake *= 0.75;
                analysis = "Risco reduzido: mercado sem tendência clara (ADX baixo).";
            }
            if (indicators.atr && indicators.atr > (chartData[chartData.length-1]?.close * 0.0001)) {
                finalStake *= 0.75;
                finalDuration = Math.max(duration + 2, 7);
                analysis = "Risco e duração ajustados: alta volatilidade (ATR alto).";
            }
        }

        return { status: 'approved', message: 'Aprovado. Risco avaliado.', analysis, finalStake: Math.max(0.35, finalStake), finalDuration };

    }, [form, dailyBalance, dailyTarget, chartData, timePeriod]);


    const processNewChartData = useCallback((data: ChartData[]) => {
        if (data.length > 0) {
            const calculatedIndicators = calculateAllIndicators(data, strategyCouncil, timePeriod);
            setIndicators(calculatedIndicators);
            setActiveCommittee(committeeOfSpecialists(calculatedIndicators, timePeriod));
        }
    }, [strategyCouncil, timePeriod, committeeOfSpecialists]);
    
    // Recalculate indicators whenever chartData changes
    useEffect(() => {
        if(chartData.length > 0) {
           processNewChartData(chartData);
        }
    }, [chartData, processNewChartData]);


    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators || !activeSymbol) return;

        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};
        
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
            
            // Lógica de Voto Simplificada (Exemplos)
            if (robot.strategyType === 'RSI' && indicators.rsi) {
                if (indicators.rsi <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
                if (indicators.rsi <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
                if (indicators.rsi >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
                if (indicators.rsi >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
            }
            if (robot.strategyType === 'STOCHASTIC' && indicators.stoch) {
                if (indicators.stoch <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
                if (indicators.stoch <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
                if (indicators.stoch >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
                if (indicators.stoch >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
            }
            if (robot.strategyType === 'MOVING_AVERAGE_CROSS' && indicators.ma.short && indicators.ma.long) {
                if(indicators.ma.short > indicators.ma.long) { vote = 'RISE'; confidence = robot.weakConfidence; }
                if(indicators.ma.long > indicators.ma.short) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }
             if (robot.strategyType === 'MACD_CROSS' && indicators.macd.macd && indicators.macd.signal) {
                 if(indicators.macd.macd > indicators.macd.signal) { vote = 'RISE'; confidence = robot.weakConfidence; }
                 if(indicators.macd.signal > indicators.macd.macd) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });

        const dailyPnl = operationsLog.filter(op => new Date(op.timestamp).toDateString() === new Date().toDateString() && op.initiator === 'Conselho').reduce((sum, op) => sum + (op.result || 0), 0);
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
        isDynamicConsensusOn,
        setIsDynamicConsensusOn,
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
