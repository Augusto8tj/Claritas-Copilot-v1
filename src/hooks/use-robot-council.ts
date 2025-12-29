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
export type CouncilVotes = { [key: string]: RobotVote };

// ============================================================================
// ARENA VIRTUAL: Estrutura de uma Trade Virtual
// ============================================================================
type VirtualTrade = {
    id: string;
    robotId: string;
    vote: 'RISE' | 'FALL';
    entryPrice: number;
    entryEpoch: number;
    entryTickIndex: number;
    durationTicks: number;
    exitTickIndex: number;
};

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
const VIRTUAL_STAKE = 1.0; // Cada trade virtual usa $1 para calcular PnL

// ============================================================================
// UTILITÁRIOS
// ============================================================================
const isCandle = (d: ChartData): d is CandleData => d !== null && 'close' in d;
const getPrice = (d: ChartData | null): number | undefined => {
    if (!d) return undefined;
    return isCandle(d) ? d.close : d.price;
};
const isValid = (val: any): val is number => val !== null && val !== undefined && !isNaN(val);

// ============================================================================
// LÓGICA DE VOTAÇÃO: Como cada robô decide RISE, FALL ou HOLD
// ============================================================================
const calculateRobotVote = (
    robot: RobotStrategy,
    indicators: Indicators,
    chartData: ChartData[] 
): Pick<RobotVote, 'vote' | 'confidence'> => {
    let vote: RobotVote['vote'] = 'HOLD';
    let confidence = 0;

    if (!indicators) return { vote: 'HOLD', confidence: 0 };
    
    // RSI
    if (robot.strategyType === 'RSI' && isValid(indicators.rsi)) {
        if (indicators.rsi <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.rsi <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.rsi >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.rsi >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }

    // STOCHASTIC
    if (robot.strategyType === 'STOCHASTIC' && isValid(indicators.stoch)) {
        if (indicators.stoch <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.stoch <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.stoch >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.stoch >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }

    // MOVING_AVERAGE_CROSS
    if (robot.strategyType === 'MOVING_AVERAGE_CROSS' && isValid(indicators.ma.short) && isValid(indicators.ma.long)) {
        if (indicators.ma.short > indicators.ma.long) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.ma.long > indicators.ma.short) { vote = 'FALL'; confidence = robot.weakConfidence; }
    }

    // MACD_CROSS
    if (robot.strategyType === 'MACD_CROSS' && isValid(indicators.macd.macd) && isValid(indicators.macd.signal)) {
        if (indicators.macd.macd > indicators.macd.signal) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.macd.signal > indicators.macd.macd) { vote = 'FALL'; confidence = robot.weakConfidence; }
    }
    
    // BOLLINGER_BANDS
    const lastBB = indicators.bollingerBands?.[indicators.bollingerBands.length - 1];
    if (robot.strategyType === 'BOLLINGER_BANDS' && lastBB && isValid(lastBB.lower) && isValid(lastBB.upper)) {
        const lastPrice = getPrice(chartData[chartData.length - 1]);
        if(lastPrice) {
            if (lastPrice <= lastBB.lower) { vote = 'RISE'; confidence = robot.weakConfidence; }
            if (lastPrice >= lastBB.upper) { vote = 'FALL'; confidence = robot.weakConfidence; }
        }
    }
    
    // ADX_TREND
    if (robot.strategyType === 'ADX_TREND' && isValid(indicators.adx)) {
        if (indicators.adx > (robot.trendStrengthThreshold || 25)) {
            if (isValid(indicators.pdi) && isValid(indicators.ndi)) {
                if (indicators.pdi > indicators.ndi) { vote = 'RISE'; confidence = robot.weakConfidence; }
                if (indicators.ndi > indicators.pdi) { vote = 'FALL'; confidence = robot.weakConfidence; }
            }
        }
    }
    
    // MFI
    if (robot.strategyType === 'MFI' && isValid(indicators.mfi)) {
        if (indicators.mfi <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.mfi <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.mfi >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.mfi >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }
    
    // STOCH_RSI
    if (robot.strategyType === 'STOCH_RSI' && isValid(indicators.stochRSI)) {
        if (indicators.stochRSI <= robot.weakBuyThreshold!) { vote = 'RISE'; confidence = robot.weakConfidence; }
        if (indicators.stochRSI <= robot.strongBuyThreshold!) { vote = 'RISE'; confidence = robot.strongConfidence; }
        if (indicators.stochRSI >= robot.weakSellThreshold!) { vote = 'FALL'; confidence = robot.weakConfidence; }
        if (indicators.stochRSI >= robot.strongSellThreshold!) { vote = 'FALL'; confidence = robot.strongConfidence; }
    }

    return { vote, confidence };
};


// ============================================================================
// HOOK PRINCIPAL
// ============================================================================
export function useRobotCouncil(
    activeSymbol: string | null,
    chartData: ChartData[],
    priceTicks: TickData[]
) {
    const { operationsLog, executeTrade, timePeriod } = useDerivApi();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    // Estados do Conselho
    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>([]);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});

    // Configurações da Mesa
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);

    // Estados da Arena Virtual
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    const virtualTradesRef = useRef<VirtualTrade[]>([]);
    const tradeCounterRef = useRef(0);

    // Estados de Análise
    const [indicators, setIndicators] = useState<Indicators | null>(null);
    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<{
        status: 'inactive' | 'approved' | 'veto';
        message: string;
        analysis?: string;
    }>({ status: 'inactive', message: 'Aguardando consenso.' });
    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });
    const [consensusDecision, setConsensusDecision] = useState<'RISE' | 'FALL' | 'HOLD'>('HOLD');

    // Controle de execução
    const councilExecutionRef = useRef({ isExecuting: false });

    // ========================================================================
    // CARREGAR DESEMPENHO PERSISTIDO
    // ========================================================================
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setRobotPerformance(parsed);
            }
        } catch (error) {
            console.error('Erro ao carregar desempenho:', error);
        }
    }, []);

    // ========================================================================
    // CONSTRUIR O CONSELHO
    // ========================================================================
    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) {
            toast({
                variant: 'destructive',
                title: 'Nenhum Ativo',
                description: 'Selecione um ativo para construir o conselho.',
            });
            return;
        }

        setIsFetchingCouncil(true);

        // Limpa a arena
        virtualTradesRef.current = [];
        tradeCounterRef.current = 0;

        await new Promise((resolve) => setTimeout(resolve, 500));

        const durationUnit = form.getValues('duration_unit');
        const council = initialCouncilStrategies.map((strategy) => ({
            ...strategy,
            suggestedStake: Math.max(0.35, dailyBalance * 0.01),
            suggestedDuration: 5,
            suggestedDurationUnit: durationUnit,
            justification: strategy.justification.replace('{{timePeriod}}', timePeriod),
        }));

        setStrategyCouncil(council);

        // Inicializa o desempenho
        const initialPerformance: RobotPerformance[] = council.map((robot) => ({
            id: robot.id,
            strategyType: robot.strategyType,
            strategy: robot,
            wins: 0,
            losses: 0,
            totalProfit: 0,
        }));

        setRobotPerformance(initialPerformance);
        localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(initialPerformance));

        toast({
            title: 'Conselho de IA Montado!',
            description: `${council.length} analistas foram convocados. Arena Virtual ativa.`,
        });

        setIsCouncilAutopilotOn(true);
        setIsFetchingCouncil(false);
    }, [activeSymbol, dailyBalance, form, timePeriod, toast]);

    // ========================================================================
    // DISSOLVER O CONSELHO
    // ========================================================================
    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
        virtualTradesRef.current = [];
    };

    // ========================================================================
    // COMITÊ DE ESPECIALISTAS
    // ========================================================================
    const committeeOfSpecialists = useCallback(
        (indicators: Indicators, timePeriod: string): string => {
            if (!indicators.adx || !indicators.bbw) return 'Comité Indefinido';

            if (timePeriod.endsWith('h') || timePeriod.endsWith('d')) {
                if (indicators.adx > 25) return 'Gestão de Tendência Macro';
                return 'Análise de Ciclo Macro';
            }

            if (timePeriod.includes('m') && parseInt(timePeriod) >= 10) {
                if (indicators.adx > 25) return 'Especialistas em Tendência Intraday';
                if (indicators.bbw < 0.05) return 'Caçadores de Rompimento (Squeeze)';
                return 'Comité Geral Intraday';
            }

            if (indicators.stoch && (indicators.stoch < 20 || indicators.stoch > 80))
                return 'Especialistas em Reversão Rápida';
            if (indicators.bbw > 0.1) return 'Jogadores de Volatilidade';
            return 'Equipa de Scalping Padrão';
        },
        []
    );

    // ========================================================================
    // SUPERVISÃO E APROVAÇÃO
    // ========================================================================
    const supervisionCommitteeCheck = useCallback(
        (
            riseSum: number,
            fallSum: number,
            consensusThreshold: number,
            indicators: Indicators,
            dailyPnl: number
        ): {
            finalStake: number;
            finalDuration: number;
            status: 'approved' | 'veto' | 'inactive';
            message: string;
            analysis?: string;
        } => {
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


    // ========================================================================
    // MOTOR DA ARENA VIRTUAL: O CORAÇÃO DO SISTEMA
    // ========================================================================
    useEffect(() => {
        // Condições de guarda
        if (
            !isCouncilAutopilotOn ||
            strategyCouncil.length === 0 ||
            !activeSymbol ||
            priceTicks.length < 2
        ) {
            return;
        }

        // ====================================================================
        // FASE 1: FONTE DA VERDADE
        // ====================================================================
        const currentTickIndex = priceTicks.length - 1;
        const currentTick = priceTicks[currentTickIndex];
        if (!currentTick) return;

        // Converte ticks para velas para cálculo de indicadores
        const tickCandles: CandleData[] = priceTicks.map((t) => ({
            epoch: t.epoch,
            open: t.price,
            high: t.price,
            low: t.price,
            close: t.price,
            volume: 1,
        }));

        const currentIndicators = calculateAllIndicators(
            tickCandles,
            strategyCouncil,
            timePeriod
        );
        setIndicators(currentIndicators);
        if (!currentIndicators) return;

        // ====================================================================
        // FASE 2: JULGAMENTO - Avaliar trades virtuais expirados
        // ====================================================================
        const stillActiveTrades: VirtualTrade[] = [];
        const performanceMap = new Map<string, RobotPerformance>(
            robotPerformance.map((p) => [p.id, { ...p }])
        );
        let performanceChanged = false;

        virtualTradesRef.current.forEach((trade) => {
            const isExpired = currentTickIndex >= trade.exitTickIndex;

            if (isExpired) {
                // Obter o tick de saída
                const exitTick = priceTicks[trade.exitTickIndex];
                if (exitTick) {
                    // Avaliar resultado
                    const isWin =
                        (trade.vote === 'RISE' && exitTick.price > trade.entryPrice) ||
                        (trade.vote === 'FALL' && exitTick.price < trade.entryPrice);

                    // Atualizar desempenho
                    const perf = performanceMap.get(trade.robotId);
                    if (perf) {
                        const pnl = isWin ? VIRTUAL_STAKE * 0.92 : -VIRTUAL_STAKE;
                        perf.totalProfit = (perf.totalProfit || 0) + pnl;
                        if (isWin) {
                            perf.wins = (perf.wins || 0) + 1;
                        } else {
                            perf.losses = (perf.losses || 0) + 1;
                        }
                        performanceChanged = true;
                    }
                }
            } else {
                // Trade ainda ativa
                stillActiveTrades.push(trade);
            }
        });

        virtualTradesRef.current = stillActiveTrades;

        // Persistir desempenho se mudou
        if (performanceChanged) {
            const updatedPerformance = Array.from(performanceMap.values());
            setRobotPerformance(updatedPerformance);
            localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(updatedPerformance));
        }

        // ====================================================================
        // FASE 3: VOTAÇÃO E REGISTO DE NOVAS TRADES VIRTUAIS
        // ====================================================================
        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};
        const tradeDuration = form.getValues('duration');

        strategyCouncil.forEach((robot) => {
            const { vote, confidence } = calculateRobotVote(robot, currentIndicators, tickCandles);

            // REGISTO IMEDIATO: Se votou, registrar na arena
            if (vote !== 'HOLD') {
                const tradeId = `vt_${Date.now()}_${tradeCounterRef.current++}`;
                const virtualTrade: VirtualTrade = {
                    id: tradeId,
                    robotId: robot.id,
                    vote: vote,
                    entryPrice: currentTick.price,
                    entryEpoch: currentTick.epoch,
                    entryTickIndex: currentTickIndex,
                    durationTicks: tradeDuration,
                    exitTickIndex: currentTickIndex + tradeDuration,
                };
                virtualTradesRef.current.push(virtualTrade);
            }

            // Calcular peso (meritocracia)
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = performanceMap.get(robot.id);
                if (perf && perf.wins + perf.losses > 3) {
                    const winRate = perf.wins / (perf.wins + perf.losses);
                    const pnlFactor = Math.tanh(perf.totalProfit / 50);
                    weight = 0.5 + winRate * 0.75 + pnlFactor * 0.25;
                }
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });

        // ====================================================================
        // FASE 4: ATUALIZAÇÃO DE ESTADOS
        // ====================================================================
        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });
        setActiveCommittee(committeeOfSpecialists(currentIndicators, timePeriod));

        if (riseConfidenceSum > fallConfidenceSum && riseConfidenceSum > 0) {
            setConsensusDecision('RISE');
        } else if (fallConfidenceSum > riseConfidenceSum && fallConfidenceSum > 0) {
            setConsensusDecision('FALL');
        } else {
            setConsensusDecision('HOLD');
        }

        // ====================================================================
        // FASE 5: EXECUÇÃO DE TRADE REAL (SE APROVADO)
        // ====================================================================
        if (councilExecutionRef.current.isExecuting) return;

        const dailyPnl = operationsLog
            .filter(
                (op) =>
                    new Date(op.timestamp).toDateString() === new Date().toDateString() &&
                    op.initiator === 'Conselho'
            )
            .reduce((sum, op) => sum + (op.result || 0), 0);

        const supervisionDecision = supervisionCommitteeCheck(
            riseConfidenceSum,
            fallConfidenceSum,
            consensusThreshold,
            currentIndicators,
            dailyPnl
        );
        setSupervisionStatus(supervisionDecision);

        if (supervisionDecision.status === 'approved') {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const { finalStake, finalDuration } = supervisionDecision;

            toast({
                title: 'Conselho Executou Ordem!',
                description: `Direção: ${direction}, Stake: $${finalStake.toFixed(2)}, Duração: ${finalDuration} ticks.`,
            });

            executeTrade(
                direction === 'RISE' ? 'CALL' : 'PUT',
                finalStake,
                activeSymbol,
                direction.toLowerCase() as 'rise' | 'fall',
                finalDuration,
                form.getValues('duration_unit'),
                'Conselho'
            ).finally(() =>
                setTimeout(() => (councilExecutionRef.current.isExecuting = false), 10000)
            );
        }
    }, [
        priceTicks,
        isCouncilAutopilotOn,
        strategyCouncil,
        robotPerformance,
        isMeritocracyOn,
        activeSymbol,
        operationsLog,
        supervisionCommitteeCheck,
        consensusThreshold,
        toast,
        executeTrade,
        form,
        timePeriod,
        committeeOfSpecialists,
    ]);

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
