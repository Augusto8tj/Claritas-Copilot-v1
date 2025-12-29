
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData, TickData, CandleData } from './types';
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

const isCandle = (d: ChartData): d is CandleData => d !== null && 'close' in d;
const getPrice = (d: ChartData | null): number | undefined => {
    if (!d) return undefined;
    return isCandle(d) ? d.close : d.price;
}

const calculateRobotVote = (robot: RobotStrategy, indicators: Indicators): Pick<RobotVote, 'vote' | 'confidence'> => {
    let vote: RobotVote['vote'] = 'HOLD', confidence = 0;

    if (!indicators) return { vote: 'HOLD', confidence: 0 };

    // --- Lógica de Votação para cada tipo de estratégia ---
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
    // Adicionar lógicas de voto para as outras 18 estratégias aqui...
    // Omitido por brevidade, mas a estrutura seria a mesma

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

    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);

    const councilExecutionRef = useRef({ isExecuting: false });
    const virtualArenaTradesRef = useRef<VirtualTrade[]>([]); 

    const [indicators, setIndicators] = useState<Indicators | null>(null);

    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<{ status: 'inactive' | 'approved' | 'veto', message: string, analysis?: string }>({ status: 'inactive', message: 'Aguardando consenso.' });
    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });
    const [consensusDecision, setConsensusDecision] = useState<'RISE' | 'FALL' | 'HOLD'>('HOLD');

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
        setIsCouncilAutopilotOn(true);
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


    // CICLO PRINCIPAL DA MESA OPERACIONAL E DA ARENA VIRTUAL
    useEffect(() => {
        // --- Condições de Guarda ---
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !activeSymbol || priceTicks.length < 2) {
            return;
        }

        // --- 1. FONTE DA VERDADE: Ticks e Indicadores ---
        const currentTickIndex = priceTicks.length - 1;
        const currentTick = priceTicks[currentTickIndex];
        if (!currentTick) return;
        
        // Converte ticks para velas para os indicadores
        const tickCandles: CandleData[] = priceTicks.map(t => ({ epoch: t.epoch, open: t.price, high: t.price, low: t.price, close: t.price, volume: 1 }));
        const currentIndicators = calculateAllIndicators(tickCandles, strategyCouncil, timePeriod);
        setIndicators(currentIndicators);
        if (!currentIndicators) return;

        // --- 2. JULGAMENTO DA ARENA: Processa Trades Virtuais Concluídos ---
        const stillActiveVirtualTrades: VirtualTrade[] = [];
        let performanceChanged = false;
        
        // Cria um mapa mutável para o desempenho da sessão atual
        const performanceMap = new Map<string, RobotPerformance>(robotPerformance.map(p => [p.id, { ...p }]));
        
        virtualArenaTradesRef.current.forEach(trade => {
            const isFinished = currentTickIndex >= trade.entryTickIndex + trade.durationTicks;
            if (isFinished) {
                const exitTick = priceTicks[trade.entryTickIndex + trade.durationTicks];
                if (exitTick) {
                    const isWin = (trade.vote === 'RISE' && exitTick.price > trade.entryPrice) || (trade.vote === 'FALL' && exitTick.price < trade.entryPrice);
                    const perf = performanceMap.get(trade.robotId);
                    if (perf) {
                        const virtualPnl = isWin ? 0.92 : -1.0; // Assume stake de $1
                        perf.totalProfit = (perf.totalProfit || 0) + virtualPnl;
                        if (isWin) perf.wins = (perf.wins || 0) + 1;
                        else perf.losses = (perf.losses || 0) + 1;
                        performanceChanged = true;
                    }
                }
            } else {
                stillActiveVirtualTrades.push(trade);
            }
        });
        virtualArenaTradesRef.current = stillActiveVirtualTrades;

        // --- 3. VOTAÇÃO DO CONSELHO E CRIAÇÃO DE TRADES VIRTUAIS ---
        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};
        
        strategyCouncil.forEach(robot => {
            const { vote, confidence } = calculateRobotVote(robot, currentIndicators);
            
            // LÓGICA PRAGMÁTICA: Se o robô votou, a Arena regista!
            if (vote !== 'HOLD') {
                const newVirtualTrade: VirtualTrade = {
                    robotId: robot.id,
                    vote: vote,
                    entryPrice: currentTick.price,
                    entryTime: currentTick.epoch,
                    durationTicks: form.getValues('duration'),
                    entryTickIndex: currentTickIndex,
                };
                virtualArenaTradesRef.current.push(newVirtualTrade);
            }
            
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = performanceMap.get(robot.id);
                if (perf && (perf.wins + perf.losses) > 3) {
                     const winRate = perf.wins / (perf.wins + perf.losses);
                     const pnlFactor = Math.tanh(perf.totalProfit / 50); // Normaliza o PnL
                     weight = 0.5 + (winRate * 0.75) + (pnlFactor * 0.25);
                }
            }
            
            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        
        // --- 4. ATUALIZAÇÃO DE ESTADOS ---
        if (performanceChanged) {
            const updatedPerformanceArray = Array.from(performanceMap.values());
            setRobotPerformance(updatedPerformanceArray);
            localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(updatedPerformanceArray));
            window.dispatchEvent(new Event('storage'));
        }

        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });
        setActiveCommittee(committeeOfSpecialists(currentIndicators, timePeriod));
        
        if (riseConfidenceSum > fallConfidenceSum && riseConfidenceSum > 0) setConsensusDecision('RISE');
        else if (fallConfidenceSum > riseConfidenceSum && fallConfidenceSum > 0) setConsensusDecision('FALL');
        else setConsensusDecision('HOLD');

        // --- 5. EXECUÇÃO DE TRADE REAL (SE APROVADO) ---
        const dailyPnl = operationsLog.filter(op => new Date(op.timestamp).toDateString() === new Date().toDateString() && op.initiator === 'Conselho').reduce((sum, op) => sum + (op.result || 0), 0);
        const supervisionDecision = supervisionCommitteeCheck(riseConfidenceSum, fallConfidenceSum, consensusThreshold, currentIndicators, dailyPnl);
        setSupervisionStatus(supervisionDecision);

        if (supervisionDecision.status === 'approved') {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const { finalStake, finalDuration } = supervisionDecision;
            
            toast({ title: "Conselho Executou Ordem!", description: `Direção: ${direction}, Stake: $${finalStake.toFixed(2)}, Duração: ${finalDuration} ticks.` });

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', finalDuration, form.getValues('duration_unit'), 'Conselho')
                .finally(() => setTimeout(() => councilExecutionRef.current.isExecuting = false, 10000));
        }

    }, [priceTicks, isCouncilAutopilotOn, strategyCouncil, robotPerformance, isMeritocracyOn, activeSymbol, operationsLog, supervisionCommitteeCheck, consensusThreshold, toast, executeTrade, form, timePeriod, committeeOfSpecialists]);
    
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
        indicators,
        activeCommittee,
        supervisionStatus,
        consensusSum,
        consensusDecision,
        robotPerformance,
    };
}
