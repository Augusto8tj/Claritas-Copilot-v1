

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData, TickData } from './types';
import type { RobotPerformance } from '@/components/trading/operations-log.types';
import { initialCouncilStrategies } from '@/services/council-strategies';


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

// Estrutura para as operações virtuais da arena
type VirtualTrade = {
    robotId: string;
    vote: 'RISE' | 'FALL';
    entryPrice: number;
    entryTime: number; // epoch em segundos
    durationTicks: number;
    entryTickIndex: number; // Índice do tick de entrada
};

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';

const isCandle = (d: ChartData): d is { open: number, high: number, low: number, close: number } => d !== null && 'close' in d;
const getPrice = (d: ChartData | null): number | undefined => {
    if (!d) return undefined;
    return isCandle(d) ? d.close : d.price;
}

const calculateRobotVote = (robot: RobotStrategy, indicators: Indicators): Pick<RobotVote, 'vote' | 'confidence'> => {
    let vote: RobotVote['vote'] = 'HOLD', confidence = 0;

    if (!indicators) return { vote: 'HOLD', confidence: 0 };

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
    // ... all other voting logic remains here ...

    return { vote, confidence };
}


export function useRobotCouncil(
    activeSymbol: string | null,
    chartData: ChartData[],
    priceTicks: TickData[]
) {
    const { operationsLog, executeTrade, timePeriod } = useDerivApi();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();
    
    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>([]);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});
    const [dailyBalance, setDailyBalance] = useState(100);
    const [geminiRequestCount, setGeminiRequestCount] = useState(0);

    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);

    const councilExecutionRef = useRef({ isExecuting: false });
    const virtualArenaTradesRef = useRef<VirtualTrade[]>([]); // Armazena trades virtuais abertos

    const [indicators, setIndicators] = useState<Indicators | null>(null);

    // --- State for new supervisor personas ---
    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<{ status: 'inactive' | 'approved' | 'veto', message: string, analysis?: string }>({ status: 'inactive', message: 'Aguardando consenso.' });
    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });
    const [consensusDecision, setConsensusDecision] = useState<'RISE' | 'FALL' | 'HOLD'>('HOLD');


    const incrementGeminiRequestCount = () => setGeminiRequestCount(prev => prev + 1);
    
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) {
                 const parsed = JSON.parse(stored);
                 if (Array.isArray(parsed)) {
                    setRobotPerformance(parsed);
                 }
            }
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);

    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) {
            toast({ variant: "destructive", title: "Nenhum Ativo", description: "Selecione um ativo para construir o conselho." });
            return;
        }
        setIsFetchingCouncil(true);
        virtualArenaTradesRef.current = []; // Limpa trades virtuais pendentes
        
        await new Promise(resolve => setTimeout(resolve, 500));

        const durationUnit = form.getValues('duration_unit');
        const council = initialCouncilStrategies.map(strategy => ({
            ...strategy,
            suggestedStake: Math.max(0.35, dailyBalance * 0.01),
            suggestedDuration: 5, 
            suggestedDurationUnit: durationUnit,
            justification: strategy.justification.replace('{{timePeriod}}', timePeriod)
        }));
        
        setStrategyCouncil(council);

        // Initialize performance for all robots if not already present
        const initialPerformance = council.map(robot => ({
            id: robot.id,
            strategyType: robot.strategyType,
            strategy: robot,
            wins: 0,
            losses: 0,
            totalProfit: 0,
        }));
        setRobotPerformance(initialPerformance);
        localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(initialPerformance));
        window.dispatchEvent(new Event('storage'));


        toast({ title: "Conselho de IA Montado!", description: `${council.length} analistas foram convocados e a Mesa está ativa.` });
        setIsCouncilAutopilotOn(true); // Activate the desk automatically
        setIsFetchingCouncil(false);
    }, [activeSymbol, dailyBalance, form, timePeriod, toast]);
    
    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
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

        let analysis = "Risco padrão.";
        const direction = riseSum > fallSum ? 'RISE' : 'FALL';
        
        const isHFT = timePeriod.includes('t') || timePeriod.endsWith('s') || parseInt(timePeriod) <= 5;
        
        if (isHFT) {
            if (indicators.stoch && ((direction === 'RISE' && indicators.stoch < 20) || (direction === 'FALL' && indicators.stoch > 80))) {
                analysis = "Setup de reversão de HFT detetado."
                const currentPrice = getPrice(chartData[chartData.length - 1]);
                const vwap = indicators.vwap?.[indicators.vwap.length -1];
                if (currentPrice && vwap && Math.abs(currentPrice - vwap) / vwap > 0.0005) {
                    finalStake *= 0.7;
                    analysis += " Risco reduzido: operando longe da VWAP."
                }
            }
        } else { 
            if (indicators.adx && indicators.adx < 20) {
                finalStake *= 0.75;
                analysis = "Risco reduzido: mercado sem tendência clara (ADX baixo).";
            }
            if (indicators.atr && indicators.atr > (getPrice(chartData[chartData.length-1])! * 0.0001)) {
                finalStake *= 0.75;
                finalDuration = Math.max(duration + 2, 7);
                analysis = "Risco e duração ajustados: alta volatilidade (ATR alto).";
            }
        }

        return { status: 'approved', message: 'Aprovado. Risco avaliado.', analysis, finalStake: Math.max(0.35, finalStake), finalDuration };

    }, [form, dailyBalance, dailyTarget, chartData, timePeriod]);


    // Effect to calculate indicators for the main council execution
    useEffect(() => {
        if (!isCouncilAutopilotOn || chartData.length < 2 || strategyCouncil.length === 0) {
            setIndicators(null);
            return;
        };

        const calculatedIndicators = calculateAllIndicators(chartData, strategyCouncil, timePeriod);
        setIndicators(calculatedIndicators);
        
    }, [chartData, strategyCouncil, timePeriod, isCouncilAutopilotOn]);


    // Main council logic effect, triggered by new indicators
    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators || !activeSymbol) return;

        setActiveCommittee(committeeOfSpecialists(indicators, timePeriod));

        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};
        
        const performanceMap = new Map(robotPerformance.map(p => [p.id, { ...p }]));
        
        strategyCouncil.forEach(robot => {
            const { vote, confidence } = calculateRobotVote(robot, indicators);
            let weight = 1.0;

            if (isMeritocracyOn) {
                const perf = performanceMap.get(robot.id);
                if (perf && (perf.wins + perf.losses) > 3) {
                     const winRate = perf.wins / (perf.wins + perf.losses);
                     const pnlFactor = Math.tanh(perf.totalProfit / 50); // Normalize profit impact
                     weight = 0.5 + (winRate * 0.75) + (pnlFactor * 0.25);
                }
            }
            
            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });

        // --- COUNCIL CONSENSUS & EXECUTION ---
        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });

        if (riseConfidenceSum > fallConfidenceSum && riseConfidenceSum > 0) {
            setConsensusDecision('RISE');
        } else if (fallConfidenceSum > riseConfidenceSum && fallConfidenceSum > 0) {
            setConsensusDecision('FALL');
        } else {
            setConsensusDecision('HOLD');
        }

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

    }, [indicators, isCouncilAutopilotOn, strategyCouncil, robotPerformance, isMeritocracyOn, activeSymbol, operationsLog, supervisionCommitteeCheck, consensusThreshold, toast, executeTrade, form, timePeriod, committeeOfSpecialists]);
    

    // --- VIRTUAL ARENA ENGINE ---
    // This effect is dedicated to the virtual arena simulation
    useEffect(() => {
        if (!isCouncilAutopilotOn || priceTicks.length < 2 || strategyCouncil.length === 0) {
            return;
        }

        const arenaIndicators = calculateAllIndicators(priceTicks, strategyCouncil, timePeriod);
        if (!arenaIndicators) return;

        const currentTickIndex = priceTicks.length - 1;
        const currentTick = priceTicks[currentTickIndex];
        if (!currentTick) return;
    
        // 1. Judge closed virtual trades
        const performanceMap = new Map(robotPerformance.map(p => [p.id, { ...p }]));
        const remainingVirtualTrades: VirtualTrade[] = [];
        let performanceChanged = false;
    
        virtualArenaTradesRef.current.forEach(trade => {
            if (currentTickIndex >= trade.entryTickIndex + trade.durationTicks) {
                // Trade is closed
                const exitTick = priceTicks[trade.entryTickIndex + trade.durationTicks];
                if (exitTick) {
                    const isWin = (trade.vote === 'RISE' && exitTick.price > trade.entryPrice) || 
                                  (trade.vote === 'FALL' && exitTick.price < trade.entryPrice);
                    
                    const perf = performanceMap.get(trade.robotId);
                    if (perf) {
                        const virtualPnl = isWin ? 0.92 : -1.0;
                        perf.totalProfit += virtualPnl;
                        if (isWin) perf.wins++; else perf.losses++;
                        performanceMap.set(trade.robotId, perf);
                        performanceChanged = true;
                    }
                }
            } else {
                // Trade is still open
                remainingVirtualTrades.push(trade);
            }
        });
    
        // 2. Open new virtual trades based on the latest votes
        strategyCouncil.forEach(robot => {
            const { vote } = calculateRobotVote(robot, arenaIndicators);
            if (vote !== 'HOLD') {
                remainingVirtualTrades.push({
                    robotId: robot.id,
                    vote: vote,
                    entryPrice: currentTick.price,
                    entryTime: currentTick.epoch,
                    durationTicks: form.getValues('duration'),
                    entryTickIndex: currentTickIndex,
                });
            }
        });
    
        // 3. Update state
        virtualArenaTradesRef.current = remainingVirtualTrades;
        if (performanceChanged) {
            const updatedPerformanceArray = Array.from(performanceMap.values());
            setRobotPerformance(updatedPerformanceArray);
            localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(updatedPerformanceArray));
            window.dispatchEvent(new Event('storage'));
        }
    
    }, [priceTicks, isCouncilAutopilotOn, strategyCouncil, timePeriod, robotPerformance, form]);


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
        geminiRequestCount,
        incrementGeminiRequestCount,
        indicators,
        activeCommittee,
        supervisionStatus,
        consensusSum,
        consensusDecision,
        robotPerformance,
    };
}
