// /src/hooks/use-robot-council.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import type { RobotStrategy, DurationUnit } from '@/lib/types';
import type { RiseFallFormValues } from '@/components/deriv-trader/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData, TickData, CandleData } from '@/lib/types';
import { initialCouncilStrategies } from '@/services/council-strategies';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { saveRobotPerformance, loadRobotPerformance } from '@/services/financial-data-service';

export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
    // NEW: Include duration suggestion in the vote
    optimalDuration: number;
    optimalDurationUnit: DurationUnit;
};
export type CouncilVotes = { [key:string]: RobotVote };

export type RobotPerformance = {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
};

type VirtualTrade = {
    id: string;
    robotId: string;
    vote: 'RISE' | 'FALL';
    entryPrice: number;
    entryEpoch: number;
    entryTickIndex: number;
    exitTickIndex: number;
};

const VIRTUAL_STAKE = 1.0; 

const isCandle = (d: ChartData): d is CandleData => d !== null && 'close' in d;
const getPrice = (d: ChartData | null): number | undefined => {
    if (!d) return undefined;
    return isCandle(d) ? d.close : d.price;
};

const isValid = (value: any): value is number => value !== null && value !== undefined && !isNaN(value);

const calculateRobotVote = (
    robot: RobotStrategy,
    indicators: Indicators,
    tickCandles: CandleData[]
): Pick<RobotVote, 'vote' | 'confidence' | 'optimalDuration' | 'optimalDurationUnit'> => {
    let vote: RobotVote['vote'] = 'HOLD';
    let confidence = 0;
    const { optimalDuration, optimalDurationUnit } = robot;

    if (!indicators) return { vote: 'HOLD', confidence: 0, optimalDuration, optimalDurationUnit };
    
    if (robot.strategyType === 'RSI' && isValid(indicators.rsi)) {
        if (indicators.rsi! <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.rsi! <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.rsi! >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.rsi! >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }

    if (robot.strategyType === 'STOCHASTIC' && isValid(indicators.stoch)) {
        if (indicators.stoch! <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.stoch! <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.stoch! >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.stoch! >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }

    if (robot.strategyType === 'MOVING_AVERAGE_CROSS' && isValid(indicators.ma.short) && isValid(indicators.ma.long)) {
        if (indicators.ma.short! > indicators.ma.long!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.ma.long! > indicators.ma.short!) { vote = 'FALL'; confidence = robot.weakConfidence; }
    }

    if (robot.strategyType === 'MACD_CROSS' && isValid(indicators.macd.macd) && isValid(indicators.macd.signal)) {
        if (indicators.macd.macd! > indicators.macd.signal!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.macd.signal! > indicators.macd.macd!) { vote = 'FALL'; confidence = robot.weakConfidence; }
    }

    if (
        robot.strategyType === 'BOLLINGER_BANDS' &&
        indicators.bollingerBands &&
        indicators.bollingerBands.length > 0 &&
        tickCandles.length > 0
    ) {
        const lastBand = indicators.bollingerBands[indicators.bollingerBands.length - 1];
        const lastPrice = tickCandles[tickCandles.length - 1].close;

        if (lastBand && isValid(lastBand.lower) && isValid(lastBand.upper) && isValid(lastPrice)) {
            if (lastPrice <= lastBand.lower) { vote = 'RISE'; confidence = robot.weakConfidence; }
            if (lastPrice >= lastBand.upper) { vote = 'FALL'; confidence = robot.weakConfidence; }
        }
    }

    if (robot.strategyType === 'ADX_TREND' && isValid(indicators.adx)) {
        if (indicators.adx! > (robot.trendStrengthThreshold || 25)) {
            if (isValid(indicators.pdi) && isValid(indicators.ndi)) {
                if (indicators.pdi! > indicators.ndi!) { vote = 'RISE'; confidence = robot.weakConfidence; }
                if (indicators.ndi! > indicators.pdi!) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }
        }
    }
    
    if (robot.strategyType === 'MFI' && isValid(indicators.mfi)) {
        if (indicators.mfi! <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.mfi! <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.mfi! >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.mfi! >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }
    
    if (robot.strategyType === 'STOCH_RSI' && isValid(indicators.stochRSI)) {
        if (indicators.stochRSI! <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.stochRSI! <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.stochRSI! >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.stochRSI! >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }

    return { vote, confidence, optimalDuration, optimalDurationUnit };
};

// Helper to convert duration to a common unit (seconds)
const durationToSeconds = (duration: number, unit: DurationUnit): number => {
    switch (unit) {
        case 't': return duration * 2; // Assuming 1 tick = 2 seconds for calculation
        case 's': return duration;
        case 'm': return duration * 60;
        case 'h': return duration * 3600;
        case 'd': return duration * 86400;
        default: return duration;
    }
};

export function useRobotCouncil(
    activeSymbol: string | null,
    priceTicks: TickData[]
) {
    const { operationsLog, executeTrade, timePeriod, isConnected } = useDerivApi();
    const { user, loading: isAuthLoading } = useAuth();
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
    const [isDynamicRiskOn, setIsDynamicRiskOn] = useState(true); 
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);

    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    const virtualTradesRef = useRef<VirtualTrade[]>([]);
    const tradeCounterRef = useRef(0);

    const [indicators, setIndicators] = useState<Indicators | null>(null);
    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<{
        status: 'inactive' | 'approved' | 'veto';
        message: string;
        analysis?: string;
    }>({ status: 'inactive', message: 'Aguardando consenso.' });
    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });
    const [consensusDecision, setConsensusDecision] = useState<'RISE' | 'FALL' | 'HOLD'>('HOLD');

    const councilExecutionRef = useRef({ isExecuting: false });

    useEffect(() => {
        if (!user || isAuthLoading) return;
        const doLoad = async () => {
            try {
                const storedPerformance = await loadRobotPerformance(user.uid);
                if (storedPerformance && storedPerformance.length > 0) {
                    setRobotPerformance(storedPerformance);
                }
            } catch (error) {
                console.error("useRobotCouncil: Falha ao carregar o desempenho dos robôs.", error);
            }
        };
        doLoad();
    }, [user, isAuthLoading]);

    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol || !user) {
            toast({
                variant: 'destructive',
                title: !user ? 'Não Autenticado' : 'Nenhum Ativo',
                description: !user ? 'Faça login para usar a Mesa Operacional.' : 'Selecione um ativo para construir o conselho.',
            });
            return;
        }

        setIsFetchingCouncil(true);
        virtualTradesRef.current = [];
        tradeCounterRef.current = 0;
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        const { stake, duration, duration_unit } = form.getValues();

        const council = initialCouncilStrategies.map((strategy) => ({
            ...strategy,
            suggestedStake: stake,
            justification: strategy.justification.replace('{{timePeriod}}', timePeriod),
        }));
        setStrategyCouncil(council as RobotStrategy[]);

        if (robotPerformance.length === 0) {
            const initialPerformance: RobotPerformance[] = (council as RobotStrategy[]).map((robot) => ({
                id: robot.id,
                strategyType: robot.strategyType,
                strategy: robot,
                wins: 0,
                losses: 0,
                totalProfit: 0,
            }));
            setRobotPerformance(initialPerformance);
            await saveRobotPerformance(user.uid, initialPerformance);
        }

        toast({
            title: 'Conselho de IA Montado!',
            description: `${council.length} analistas foram convocados. Arena Virtual ativa.`,
        });
        setIsCouncilAutopilotOn(true);
        setIsFetchingCouncil(false);
    }, [activeSymbol, timePeriod, toast, user, robotPerformance, form]);

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
        virtualTradesRef.current = [];
    };

    const committeeOfSpecialists = useCallback(
        (indicators: Indicators): string => {
            if (!indicators.adx || !indicators.stoch) return 'Comité Indefinido';
            if (indicators.adx > 25) {
                 if (indicators.pdi && indicators.ndi) {
                    if (indicators.pdi > indicators.ndi) return "Tendência de Alta com Força";
                    return "Tendência de Baixa com Força";
                }
                return "Tendência com Força";
            }
            if (indicators.stoch < 20 ) return 'Exaustão de Venda';
            if (indicators.stoch > 80 ) return 'Exaustão de Compra';
            return 'Mercado Lateral';
        },
        []
    );

    const supervisionCommitteeCheck = useCallback(
        (
            riseSum: number,
            fallSum: number,
            currentVotes: CouncilVotes,
            indicators: Indicators | null,
            dailyPnl: number,
            formValues: RiseFallFormValues
        ): {
            finalStake: number;
            finalDuration: number;
            finalDurationUnit: DurationUnit;
            status: 'approved' | 'veto' | 'inactive';
            message: string;
            analysis?: string;
        } => {
            let { stake: finalStake } = formValues;

            // DYNAMIC DURATION CALCULATION
            let totalDurationWeight = 0;
            let weightedDurationSum = 0;

            Object.values(currentVotes).forEach(vote => {
                if (vote.vote !== 'HOLD') {
                    const voteWeight = vote.confidence * vote.weight;
                    weightedDurationSum += durationToSeconds(vote.optimalDuration, vote.optimalDurationUnit) * voteWeight;
                    totalDurationWeight += voteWeight;
                }
            });

            // Default to form duration if no votes
            let finalDuration = formValues.duration;
            let finalDurationUnit = formValues.duration_unit;
            
            if (totalDurationWeight > 0) {
                const avgDurationInSeconds = weightedDurationSum / totalDurationWeight;
                // Convert back to a suitable unit. Prioritize ticks if short, otherwise seconds/minutes.
                if (avgDurationInSeconds <= 20) { // If avg is <= 20s, use ticks
                    finalDuration = Math.round(avgDurationInSeconds / 2); // 1 tick = 2s
                    finalDurationUnit = 't';
                } else if (avgDurationInSeconds <= 120) { // If <= 2min, use seconds
                    finalDuration = Math.round(avgDurationInSeconds);
                    finalDurationUnit = 's';
                } else { // Otherwise use minutes
                    finalDuration = Math.round(avgDurationInSeconds / 60);
                    finalDurationUnit = 'm';
                }
            }


            if (!indicators) {
                 return { status: 'inactive', message: 'Aguardando indicadores.', finalStake, finalDuration, finalDurationUnit };
            }

            if (dailyPnl <= -dailyBalance) {
                setIsCouncilAutopilotOn(false);
                return { status: 'veto', message: 'VETO: Limite de perda diário atingido.', finalStake, finalDuration, finalDurationUnit, analysis: `Prejuízo de $${Math.abs(dailyPnl).toFixed(2)} atingiu o limite de $${dailyBalance}.` };
            }
            if (dailyPnl >= dailyTarget) {
                setIsCouncilAutopilotOn(false);
                return { status: 'veto', message: 'VETO: Meta de lucro diária atingida.', finalStake, finalDuration, finalDurationUnit, analysis: `Lucro de $${dailyPnl.toFixed(2)} atingiu a meta de $${dailyTarget}.` };
            }
            
            let effectiveThreshold;
            if (isDynamicConsensusOn) {
                const totalPossibleConsensus = Object.values(currentVotes).filter(v => v.vote !== 'HOLD').reduce((sum, v) => sum + (v.confidence * v.weight), 0);
                let requiredPercentage = 0.60;
                if (indicators.adx && indicators.adx < 20) requiredPercentage += 0.15;
                if (indicators.bbw && indicators.bbw > 0.08) requiredPercentage += 0.20;
                requiredPercentage = Math.min(requiredPercentage, 0.85);
                effectiveThreshold = totalPossibleConsensus * requiredPercentage;
                setConsensusThreshold(Math.round(effectiveThreshold));
            } else {
                effectiveThreshold = consensusThreshold;
            }

            const consensusReached = Math.max(riseSum, fallSum) >= effectiveThreshold;
            if (!consensusReached) {
                return { status: 'inactive', message: 'Aguardando consenso tático.', finalStake, finalDuration, finalDurationUnit };
            }

            let analysis = 'Risco padrão.';
            let riskFactor = 1.0;
            let riskAnalysisParts: string[] = [];

            if (isDynamicRiskOn) { 
                if (indicators.adx && indicators.adx < 20) {
                    riskFactor *= 0.75;
                    riskAnalysisParts.push("sem tendência (ADX baixo)");
                }
                const lastPrice = getPrice(priceTicks[priceTicks.length - 1]);
                if (indicators.atr && lastPrice && (indicators.atr / lastPrice) > 0.00015) {
                    riskFactor *= 0.8;
                    riskAnalysisParts.push("ATR elevado");
                }
                
                finalStake = formValues.stake * riskFactor;
                
                if(riskAnalysisParts.length > 0) {
                    analysis = `Risco ajustado: ${riskAnalysisParts.join(', ')}.`;
                }
            } else {
                 analysis = 'Gestão de risco dinâmica desativada.';
            }

            finalStake = Math.max(0.35, finalStake);
            finalDuration = Math.round(Math.max(1, finalDuration));
             if (finalDurationUnit === 't') {
                finalDuration = Math.min(10, finalDuration);
             }


            return { status: 'approved', message: 'Aprovado. Risco avaliado.', analysis, finalStake, finalDuration, finalDurationUnit };
        },
        [dailyBalance, dailyTarget, priceTicks, isDynamicConsensusOn, isDynamicRiskOn, consensusThreshold]
    );

    useEffect(() => {
        if (!isConnected || !user || !isCouncilAutopilotOn || strategyCouncil.length === 0 || !activeSymbol || priceTicks.length < 2) return;
        const currentTickIndex = priceTicks.length - 1;
        const currentTick = priceTicks[currentTickIndex];
        if (!currentTick) return;

        const tickCandles: CandleData[] = priceTicks.map((t) => ({ epoch: t.epoch, open: t.price, high: t.price, low: t.price, close: t.price, volume: 1 }));
        const currentIndicators = calculateAllIndicators(tickCandles, strategyCouncil, timePeriod);
        setIndicators(currentIndicators);
        if (!currentIndicators) { console.warn("[Robot Council] Indicators could not be calculated."); return; }

        const stillActiveTrades: VirtualTrade[] = [];
        const performanceMap = new Map<string, RobotPerformance>(robotPerformance.map((p) => [p.id, { ...p }]));
        let performanceChanged = false;

        virtualTradesRef.current.forEach((trade) => {
            const isExpired = currentTickIndex >= trade.exitTickIndex;
            if (isExpired) {
                const exitTick = priceTicks[trade.exitTickIndex];
                if (exitTick) {
                    const isWin = (trade.vote === 'RISE' && exitTick.price > trade.entryPrice) || (trade.vote === 'FALL' && exitTick.price < trade.entryPrice);
                    const perf = performanceMap.get(trade.robotId);
                    if (perf) {
                        const pnl = isWin ? VIRTUAL_STAKE * 0.92 : -VIRTUAL_STAKE;
                        perf.totalProfit = (perf.totalProfit || 0) + pnl;
                        if (isWin) perf.wins = (perf.wins || 0) + 1;
                        else perf.losses = (perf.losses || 0) + 1;
                        performanceChanged = true;
                    }
                }
            } else {
                stillActiveTrades.push(trade);
            }
        });
        virtualTradesRef.current = stillActiveTrades;
        if (performanceChanged) {
            const updatedPerformance = Array.from(performanceMap.values());
            setRobotPerformance(updatedPerformance);
            if (user) saveRobotPerformance(user.uid, updatedPerformance);
        }

        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};
        const formValues = form.getValues();

        strategyCouncil.forEach((robot) => {
            const { vote, confidence, optimalDuration, optimalDurationUnit } = calculateRobotVote(robot, currentIndicators, tickCandles);
            
            if (vote !== 'HOLD') {
                const tradeId = `vt_${Date.now()}_${tradeCounterRef.current++}`;
                
                const durationInSeconds = durationToSeconds(optimalDuration, optimalDurationUnit);
                const exitTickCount = Math.ceil(durationInSeconds / 2); // Approximate ticks based on 2s per tick

                const virtualTrade: VirtualTrade = {
                    id: tradeId, 
                    robotId: robot.id, 
                    vote: vote, 
                    entryPrice: currentTick.price,
                    entryEpoch: currentTick.epoch, 
                    entryTickIndex: currentTickIndex,
                    exitTickIndex: currentTickIndex + exitTickCount
                };
                virtualTradesRef.current.push(virtualTrade);
            }

            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = performanceMap.get(robot.id);
                if (perf && (perf.wins + perf.losses) > 3) {
                    const winRate = perf.wins / (perf.wins + perf.losses);
                    const pnlFactor = Math.tanh(perf.totalProfit / 50);
                    weight = 1.0 + (winRate - 0.5) + (pnlFactor * 0.2);
                    weight = Math.max(0.5, Math.min(1.5, weight));
                }
            }

            newVotes[robot.id] = { vote, confidence, weight, optimalDuration, optimalDurationUnit };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });

        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });
        setActiveCommittee(committeeOfSpecialists(currentIndicators));
        
        if (riseConfidenceSum > fallConfidenceSum && riseConfidenceSum > 0) setConsensusDecision('RISE');
        else if (fallConfidenceSum > riseConfidenceSum && fallConfidenceSum > 0) setConsensusDecision('FALL');
        else setConsensusDecision('HOLD');
        
        if (councilExecutionRef.current.isExecuting) return;

        const dailyPnl = operationsLog.filter(op => new Date(op.timestamp).toDateString() === new Date().toDateString() && op.initiator === 'Conselho').reduce((sum, op) => sum + (op.result || 0), 0);
        const supervisionDecision = supervisionCommitteeCheck(riseConfidenceSum, fallConfidenceSum, newVotes, currentIndicators, dailyPnl, formValues);
        setSupervisionStatus(supervisionDecision);

        if (supervisionDecision.status === 'approved') {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const { finalStake, finalDuration, finalDurationUnit } = supervisionDecision;
            
            toast({ title: 'Conselho Executou Ordem!', description: `Direção: ${direction}, Stake: $${finalStake.toFixed(2)}, Duração: ${finalDuration} ${finalDurationUnit}.` });
            
            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol!, direction.toLowerCase() as 'rise' | 'fall', finalDuration, finalDurationUnit, 'Conselho')
                .finally(() => setTimeout(() => (councilExecutionRef.current.isExecuting = false), 10000));
        }
    }, [priceTicks, isConnected, isCouncilAutopilotOn, strategyCouncil, robotPerformance, isMeritocracyOn, activeSymbol, operationsLog, supervisionCommitteeCheck, toast, executeTrade, form, timePeriod, committeeOfSpecialists, user, isAuthLoading]);

    return {
        isCouncilAutopilotOn, setIsCouncilAutopilotOn, strategyCouncil, fetchStrategyCouncil, dissolveCouncil, isFetchingCouncil,
        councilVotes, dailyBalance, setDailyBalance, dailyTarget, setDailyTarget, consensusThreshold, setConsensusThreshold,
        isDynamicConsensusOn, setIsDynamicConsensusOn, isDynamicRiskOn, setIsDynamicRiskOn, isMeritocracyOn, setIsMeritocracyOn,
        indicators, activeCommittee, supervisionStatus, consensusSum, consensusDecision, robotPerformance,
    };
}
