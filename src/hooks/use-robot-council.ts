'use client';

/**
 * @fileoverview Este hook é o cérebro central da Mesa Operacional.
 * Ele possui duas responsabilidades principais:
 * 1. O CONSELHO DE ROBÔS:
 *    - Convoca e gere um conselho de 22 robôs analistas.
 *    - A cada tick de preço, calcula o voto de cada robô (RISE/FALL/HOLD).
 *    - Agrega os votos para formar uma decisão de consenso.
 *    - Aplica a lógica de supervisão e gestão de risco (Comités).
 *
 * 2. A ARENA VIRTUAL:
 *    - Para cada voto válido, cria uma "operação virtual" (paper trade).
 *    - Rastreia o resultado dessas operações virtuais para medir o desempenho individual de cada robô.
 *    - Calcula vitórias, derrotas e P&L (Lucro/Prejuízo) para cada analista.
 *    - Permite o modo "Meritocracia", onde o peso do voto de um robô é ponderado pelo seu desempenho histórico.
 *    - Persiste os dados de desempenho no Firebase.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import type { RobotStrategy, DurationUnit } from '@/lib/types';
import type { RiseFallFormValues } from '@/components/deriv-trader/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData, TickData, CandleData, Operation } from '@/lib/types';
import { initialCouncilStrategies } from '@/services/council-strategies';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { saveRobotPerformance, loadRobotPerformance } from '@/services/financial-data-service';
import { useStrategyEvolution } from './use-strategy-evolution';
import type { DurationLimits } from './use-deriv-api';

// --- TIPAGEM ---
export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
    optimalDuration: number;
    optimalDurationUnit: DurationUnit;
    suggestedStake: number;
};
export type CouncilVotes = { [key:string]: RobotVote };

export type RobotPerformance = {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
    winRate: number; // NOVO: Para facilitar o ranking na UI
};

type VirtualTrade = {
    id: string;
    robotId: string;
    vote: 'RISE' | 'FALL';
    entryPrice: number;
    entryEpoch: number;
    exitEpoch: number; // NOVO: Tempo de expiração exato
};

// --- CONSTANTES ---
const VIRTUAL_STAKE = 1.0; 

// --- HELPERS ---
const isCandle = (d: ChartData): d is CandleData => d !== null && 'close' in d;
const getPrice = (d: ChartData | null): number | undefined => {
    if (!d) return undefined;
    return isCandle(d) ? d.close : d.price;
};

const isValid = (value: any): value is number => value !== null && value !== undefined && !isNaN(value);

const durationToSeconds = (duration: number, unit: DurationUnit): number => {
    switch (unit) {
        case 't': return duration * 2; // Estimativa média para Deriv (Indices sintéticos)
        case 's': return duration;
        case 'm': return duration * 60;
        case 'h': return duration * 3600;
        case 'd': return duration * 86400;
        default: return duration;
    }
};

// Lógica de Votação Isolada (Pura)
const calculateRobotVote = (
    robot: RobotStrategy,
    indicators: Indicators,
    tickCandles: CandleData[]
): Omit<RobotVote, 'weight'> => {
    let vote: RobotVote['vote'] = 'HOLD';
    let confidence = 0;
    let suggestedStake = 0;
    const { optimalDuration, optimalDurationUnit, suggestedStake: baseStake } = robot;

    const setVote = (newVote: 'RISE' | 'FALL', newConfidence: number) => {
        vote = newVote;
        confidence = newConfidence;
        // Lógica de Stake baseada em confiança
        if (confidence === robot.strongConfidence) {
            suggestedStake = baseStake;
        } else if (confidence === robot.weakConfidence) {
            suggestedStake = baseStake * 0.5;
        }
    };

    if (!indicators) return { vote: 'HOLD', confidence: 0, optimalDuration, optimalDurationUnit, suggestedStake: 0 };
    
    // --- LÓGICA DE ESTRATÉGIAS COMPLETA ---
    
    if (robot.strategyType === 'RSI' && isValid(indicators.rsi)) {
        if (indicators.rsi! <= robot.weakBuyThreshold!) setVote('RISE', robot.weakConfidence);
        if (indicators.rsi! <= robot.strongBuyThreshold!) setVote('RISE', robot.strongConfidence);
        if (indicators.rsi! >= robot.weakSellThreshold!) setVote('FALL', robot.weakConfidence);
        if (indicators.rsi! >= robot.strongSellThreshold!) setVote('FALL', robot.strongConfidence);
    }
    
    if (robot.strategyType === 'STOCHASTIC' && isValid(indicators.stoch)) {
        if (indicators.stoch! <= robot.weakBuyThreshold!) setVote('RISE', robot.weakConfidence);
        if (indicators.stoch! <= robot.strongBuyThreshold!) setVote('RISE', robot.strongConfidence);
        if (indicators.stoch! >= robot.weakSellThreshold!) setVote('FALL', robot.weakConfidence);
        if (indicators.stoch! >= robot.strongSellThreshold!) setVote('FALL', robot.strongConfidence);
    }

    if (robot.strategyType === 'MOVING_AVERAGE_CROSS' && isValid(indicators.ma.short) && isValid(indicators.ma.long)) {
        if (indicators.ma.short! > indicators.ma.long!) setVote('RISE', robot.weakConfidence);
        if (indicators.ma.long! > indicators.ma.short!) setVote('FALL', robot.weakConfidence);
    }

    if (robot.strategyType === 'MACD_CROSS' && isValid(indicators.macd.macd) && isValid(indicators.macd.signal)) {
       if (indicators.macd.macd! > indicators.macd.signal!) setVote('RISE', robot.weakConfidence);
       if (indicators.macd.signal! > indicators.macd.macd!) setVote('FALL', robot.weakConfidence);
    }
    
    if (robot.strategyType === 'BOLLINGER_BANDS' && indicators.bollingerBands?.length && tickCandles.length) {
        const lastBand = indicators.bollingerBands[indicators.bollingerBands.length - 1];
        const lastPrice = tickCandles[tickCandles.length - 1].close;
        if (lastBand && isValid(lastBand.lower) && isValid(lastBand.upper) && isValid(lastPrice)) {
            if (lastPrice <= lastBand.lower) setVote('RISE', robot.weakConfidence);
            if (lastPrice >= lastBand.upper) setVote('FALL', robot.weakConfidence);
        }
    }

    if (robot.strategyType === 'ADX_TREND' && isValid(indicators.adx)) {
        if (indicators.adx! > (robot.trendStrengthThreshold || 25)) {
            if (isValid(indicators.pdi) && isValid(indicators.ndi)) {
                if (indicators.pdi! > indicators.ndi!) setVote('RISE', robot.weakConfidence);
                if (indicators.ndi! > indicators.pdi!) setVote('FALL', robot.weakConfidence);
            }
        }
    }
    
    if (robot.strategyType === 'MFI' && isValid(indicators.mfi)) {
        if (indicators.mfi! <= robot.weakBuyThreshold!) setVote('RISE', robot.weakConfidence);
        if (indicators.mfi! <= robot.strongBuyThreshold!) setVote('RISE', robot.strongConfidence);
        if (indicators.mfi! >= robot.weakSellThreshold!) setVote('FALL', robot.weakConfidence);
        if (indicators.mfi! >= robot.strongSellThreshold!) setVote('FALL', robot.strongConfidence);
    }
    
    if (robot.strategyType === 'STOCH_RSI' && isValid(indicators.stochRSI)) {
        if (indicators.stochRSI! <= robot.weakBuyThreshold!) setVote('RISE', robot.weakConfidence);
        if (indicators.stochRSI! <= robot.strongBuyThreshold!) setVote('RISE', robot.strongConfidence);
        if (indicators.stochRSI! >= robot.weakSellThreshold!) setVote('FALL', robot.weakConfidence);
        if (indicators.stochRSI! >= robot.strongSellThreshold!) setVote('FALL', robot.strongConfidence);
    }
    
    if (robot.strategyType === 'PRICE_ACTION_PATTERN' && tickCandles.length >= 3) {
        const [c3, c2, c1] = tickCandles.slice(-3);
        const body = Math.abs(c1.close - c1.open);
        const upperWick = c1.high - Math.max(c1.open, c1.close);
        const lowerWick = Math.min(c1.open, c1.close) - c1.low;
        const isUpTrend = c3.close > c3.open && c2.close > c2.open;
        const isDownTrend = c3.close < c3.open && c2.close < c2.open;

        if (robot.pattern === 'hammer' && isDownTrend && lowerWick > body * 2 && upperWick < body * 0.5) {
             setVote('RISE', robot.strongConfidence);
        }
        if (robot.pattern === 'shooting_star' && isUpTrend && upperWick > body * 2 && lowerWick < body * 0.5) {
             setVote('FALL', robot.strongConfidence);
        }
    }

    if (robot.strategyType === 'ICHIMOKU_CLOUD' && indicators.ichimoku && isValid(indicators.ichimoku.senkouA) && isValid(indicators.ichimoku.senkouB) && tickCandles.length > 0) {
        const lastPrice = tickCandles[tickCandles.length - 1].close;
        if (lastPrice > indicators.ichimoku.senkouA! && lastPrice > indicators.ichimoku.senkouB!) {
            setVote('RISE', robot.weakConfidence);
        }
        if (lastPrice < indicators.ichimoku.senkouA! && lastPrice < indicators.ichimoku.senkouB!) {
             setVote('FALL', robot.weakConfidence);
        }
    }
    
    // As outras lógicas que estavam faltando
    if (robot.strategyType === 'AWESOME_OSCILLATOR' && isValid(indicators.awesomeOscillator)) {
        if (indicators.awesomeOscillator! > 0) setVote('RISE', robot.weakConfidence);
        else setVote('FALL', robot.weakConfidence);
    }
    if (robot.strategyType === 'KAMA' && isValid(indicators.kama) && tickCandles.length > 0) {
        if (tickCandles[tickCandles.length - 1].close > indicators.kama!) setVote('RISE', robot.weakConfidence);
        else setVote('FALL', robot.weakConfidence);
    }
    if (robot.strategyType === 'Z_SCORE' && isValid(indicators.zScore)) {
        if (indicators.zScore! <= -robot.zScoreThreshold!) setVote('RISE', robot.strongConfidence);
        if (indicators.zScore! >= robot.zScoreThreshold!) setVote('FALL', robot.strongConfidence);
    }
    if (robot.strategyType === 'OBV' && isValid(indicators.obv) && tickCandles.length > 1) {
        // Implementação simplificada: tendência de OBV
        const obvValues = DerivIndicators.obv(tickCandles);
        if (obvValues.length > 5) {
             const last5 = obvValues.slice(-5);
             if (last5[4] > last5[0]) setVote('RISE', robot.weakConfidence);
             if (last5[4] < last5[0]) setVote('FALL', robot.weakConfidence);
        }
    }


    return { vote, confidence, optimalDuration, optimalDurationUnit, suggestedStake };
};


export function useRobotCouncil(
    activeSymbol: string | null,
    priceTicks: TickData[]
) {
    const { operationsLog, executeTrade, timePeriod, isConnected, durationLimits, sellContract } = useDerivApi();
    const { user, loading: isAuthLoading } = useAuth();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    const { evolvedStrategies, evolveTrigger, evolutionHistory } = useStrategyEvolution(initialCouncilStrategies);
    
    // Estado
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>(evolvedStrategies as RobotStrategy[]);
    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});
    
    // Configurações de Gestão
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isDynamicRiskOn, setIsDynamicRiskOn] = useState(true); 
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);

    // Performance e Simulação
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    const virtualTradesRef = useRef<VirtualTrade[]>([]); // Ref para não triggar render a cada trade aberto
    const tradeCounterRef = useRef(0);

    // Análise Técnica
    const [indicators, setIndicators] = useState<Indicators | null>(null);
    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<{
        status: 'inactive' | 'approved' | 'veto';
        message: string;
        analysis?: string;
    }>({ status: 'inactive', message: 'Aguardando consenso.' });

    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });
    const [consensusDecision, setConsensusDecision] = useState<'RISE' | 'FALL' | 'HOLD'>('HOLD');
    const councilExecutionRef = useRef<{ isExecuting: boolean, sellingContracts: Set<number> }>({ isExecuting: false, sellingContracts: new Set() });

    // --- EFEITOS DE CARREGAMENTO ---

    useEffect(() => {
        setStrategyCouncil(evolvedStrategies as RobotStrategy[]);
    }, [evolvedStrategies]);

    useEffect(() => {
        if (!user || isAuthLoading) return;
        loadRobotPerformance(user.uid)
            .then((stored) => {
                if (stored && stored.length > 0) setRobotPerformance(stored);
            })
            .catch(err => console.error("Erro ao carregar performance", err));
    }, [user, isAuthLoading]);

    // Otimização: Memoizar a conversão de Ticks para Candles para evitar .map() pesado no render
    const tickCandles = useMemo(() => {
        if (!priceTicks || priceTicks.length === 0) return [];
        // Converte ticks em formato Candle (Open=High=Low=Close) para indicadores técnicos
        return priceTicks.map((t) => ({ 
            epoch: t.epoch, 
            open: t.price, 
            high: t.price, 
            low: t.price, 
            close: t.price, 
            volume: 1 
        }));
    }, [priceTicks]);

    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol || !user) {
            toast({
                variant: 'destructive',
                title: !user ? 'Não Autenticado' : 'Nenhum Ativo',
                description: 'Necessário login e ativo selecionado.',
            });
            return;
        }

        setIsFetchingCouncil(true);
        virtualTradesRef.current = []; // Resetar simulação ao mudar ativo
        tradeCounterRef.current = 0;
        
        // Simulação de delay para "montagem" do conselho
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        setStrategyCouncil(evolvedStrategies as RobotStrategy[]);

        if (robotPerformance.length === 0) {
            const initialPerformance: RobotPerformance[] = (evolvedStrategies as RobotStrategy[]).map((robot) => ({
                id: robot.id,
                strategyType: robot.strategyType,
                strategy: robot,
                wins: 0,
                losses: 0,
                totalProfit: 0,
                winRate: 0
            }));
            setRobotPerformance(initialPerformance);
            saveRobotPerformance(user.uid, initialPerformance);
        }

        toast({
            title: 'Arena Virtual Iniciada',
            description: `${evolvedStrategies.length} robôs analistas ativos.`,
        });
        setIsCouncilAutopilotOn(true);
        setIsFetchingCouncil(false);
    }, [activeSymbol, user, toast, robotPerformance, evolvedStrategies]);

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
        virtualTradesRef.current = [];
    };

    // --- COMITÊS DE LÓGICA ---

    const committeeOfSpecialists = useCallback((indicators: Indicators): string => {
        if (!indicators.adx || !indicators.stoch) return 'Análise Pendente';
        if (indicators.adx > 25) return "Tendência Forte Detectada";
        if (indicators.stoch < 20) return 'Zona de Sobre-venda';
        if (indicators.stoch > 80) return 'Zona de Sobre-compra';
        return 'Mercado Lateral';
    }, []);
    
    // Comitê de Gestão de Posições (Stop Loss / Take Profit)
    const positionManagementCommittee = useCallback((activeContracts: Operation[], indicators: Indicators) => {
        if (!indicators.rsi || !indicators.stoch) return;

        for (const contract of activeContracts) {
            if (councilExecutionRef.current.sellingContracts.has(contract.id)) continue;

            const potentialProfit = contract.stake * 0.90; // Margem de segurança
            const currentProfit = contract.result || 0;

            // TP Dinâmico
            if (currentProfit >= potentialProfit * 0.75) {
                councilExecutionRef.current.sellingContracts.add(contract.id);
                sellContract(contract.id);
                toast({ title: "Lucro Garantido", description: `Encerrando contrato ${contract.id} com lucro.` });
                continue; 
            }

            // SL Técnico (Reversão)
            const isReversal = 
                (contract.direction === 'rise' && indicators.rsi > 75) ||
                (contract.direction === 'fall' && indicators.rsi < 25);

            if (isReversal && currentProfit < -contract.stake * 0.4) {
                councilExecutionRef.current.sellingContracts.add(contract.id);
                sellContract(contract.id);
                toast({ title: "Proteção de Capital", description: `Reversão detectada. Encerrando ${contract.id}.`, variant: "destructive" });
            }
        }
    }, [sellContract, toast]);

    const supervisionCommitteeCheck = useCallback((
            currentVotes: CouncilVotes,
            indicators: Indicators | null,
            dailyPnl: number,
        ) => {
            const formValues = form.getValues();
            
            // Cálculos de peso e médias
            let totalWeight = 0;
            let weightedStakeSum = 0;
            let weightedDurationSum = 0;
            let riseSum = 0;
            let fallSum = 0;

            Object.values(currentVotes).forEach(vote => {
                if (vote.vote !== 'HOLD') {
                    const voteWeight = vote.confidence * vote.weight;
                    if (vote.vote === 'RISE') riseSum += voteWeight;
                    if (vote.vote === 'FALL') fallSum += voteWeight;

                    weightedStakeSum += vote.suggestedStake * voteWeight;
                    weightedDurationSum += durationToSeconds(vote.optimalDuration, vote.optimalDurationUnit) * voteWeight;
                    totalWeight += voteWeight;
                }
            });
            
            // Valores Default
            const averageStake = totalWeight > 0 ? weightedStakeSum / totalWeight : formValues.stake;
            const averageDurationInSeconds = totalWeight > 0 ? weightedDurationSum / totalWeight : durationToSeconds(formValues.duration, formValues.duration_unit);
            
            const defaultResult = { 
                status: 'inactive' as const, 
                message: 'Aguardando dados...', 
                finalStake: averageStake, 
                finalDuration: formValues.duration, 
                finalDurationUnit: formValues.duration_unit,
                analysis: ''
            };

            if (!indicators || !durationLimits) return defaultResult;

            // Verificações de PnL Diário
            if (dailyPnl <= -dailyBalance) return { ...defaultResult, status: 'veto', message: 'Stop Loss Diário Atingido', analysis: 'Operações suspensas por hoje.' };
            if (dailyPnl >= dailyTarget) return { ...defaultResult, status: 'veto', message: 'Meta Diária Batida', analysis: 'Lucro no bolso. Bom descanso.' };
            
            // Consenso Dinâmico
            let effectiveThreshold = consensusThreshold;
            if (isDynamicConsensusOn) {
                const volatilityFactor = (indicators.bbw || 0) > 0.1 ? 1.2 : 1.0; // Exige mais consenso se volátil
                effectiveThreshold = (totalWeight * 0.6) * volatilityFactor;
            }

            const consensusReached = Math.max(riseSum, fallSum) >= effectiveThreshold;
            if (!consensusReached) return { ...defaultResult, message: 'Sem consenso suficiente.' };

            // Gestão de Risco
            let riskFactor = 1.0;
            let analysis = 'Condições normais.';
            if (isDynamicRiskOn) {
                if (indicators.adx && indicators.adx < 20) {
                    riskFactor = 0.5; // Reduz a mão em mercado sem tendência
                    analysis = 'Mercado lento (ADX Baixo). Stake reduzida.';
                }
            }

            // Finalização dos parâmetros
            let finalStake = parseFloat(Math.max(0.35, averageStake * riskFactor).toFixed(2));
            
            // Conversão inteligente de duração (Seconds -> Ticks se possível para rapidez)
            let finalDurationInSeconds = averageDurationInSeconds;
            let finalDurationUnit: DurationUnit = 'm';
            let finalDuration = Math.round(finalDurationInSeconds / 60);

            if (finalDurationInSeconds <= durationLimits.t.max * 2) {
                finalDurationUnit = 't';
                finalDuration = Math.round(finalDurationInSeconds / 2); // Aprox 2s por tick
            } else if (finalDurationInSeconds < 60) {
                finalDurationUnit = 's';
                finalDuration = Math.round(finalDurationInSeconds);
            }

            // Clamp nos limites da Deriv
            const { min, max } = durationLimits[finalDurationUnit];
            finalDuration = Math.max(min, Math.min(max, finalDuration));

            return { 
                status: 'approved', 
                message: 'Aprovado pelo Conselho', 
                analysis, 
                finalStake, 
                finalDuration, 
                finalDurationUnit 
            };
        },
        [dailyBalance, dailyTarget, isDynamicConsensusOn, isDynamicRiskOn, consensusThreshold, form, durationLimits]
    );

    // --- CORE LOGIC LOOP (RODA A CADA TICK) ---
    useEffect(() => {
        if (!isConnected || !user || !isCouncilAutopilotOn || strategyCouncil.length === 0 || !activeSymbol || tickCandles.length < 2) return;

        const currentTick = priceTicks[priceTicks.length - 1];

        // 1. Calcular Indicadores
        const currentIndicators = calculateAllIndicators(tickCandles, strategyCouncil, timePeriod);
        setIndicators(currentIndicators);
        if (!currentIndicators) return;

        // 2. Comitê de Gestão de Posições (Ordens Reais)
        const activeCouncilContracts = operationsLog.filter(op => op.status === 'pending' && op.initiator === 'Conselho');
        if (activeCouncilContracts.length > 0) {
            positionManagementCommittee(activeCouncilContracts, currentIndicators);
        }

        // 3. Processar Trades Virtuais (Simulação)
        const stillActiveTrades: VirtualTrade[] = [];
        const performanceMap = new Map<string, RobotPerformance>(robotPerformance.map((p) => [p.id, { ...p }]));
        let performanceChanged = false;

        virtualTradesRef.current.forEach((trade) => {
            // Verifica se o trade já expirou baseado no tempo (epoch)
            if (currentTick.epoch >= trade.exitEpoch) {
                // Encontrar o tick mais próximo do tempo de saída para um julgamento preciso
                 const exitTick = priceTicks.find(t => t.epoch >= trade.exitEpoch) || currentTick;
                
                if (exitTick) {
                    const isWin = (trade.vote === 'RISE' && exitTick.price > trade.entryPrice) || 
                                  (trade.vote === 'FALL' && exitTick.price < trade.entryPrice);
                    
                    const perf = performanceMap.get(trade.robotId);
                    if (perf) {
                        const pnl = isWin ? VIRTUAL_STAKE * 0.95 : -VIRTUAL_STAKE;
                        perf.totalProfit = (perf.totalProfit || 0) + pnl;
                        if (isWin) perf.wins++; else perf.losses++;
                        
                        // Atualiza WinRate
                        const totalTrades = perf.wins + perf.losses;
                        perf.winRate = totalTrades > 0 ? (perf.wins / totalTrades) * 100 : 0;
                        
                        performanceChanged = true;
                    }
                }
            } else {
                stillActiveTrades.push(trade);
            }
        });

        virtualTradesRef.current = stillActiveTrades;

        // Só atualiza o estado se houve mudança real nos números (Evita re-renders massivos)
        if (performanceChanged) {
            const updatedPerformance = Array.from(performanceMap.values());
            // Ordena por WinRate para a UI
            updatedPerformance.sort((a, b) => b.winRate - a.winRate);
            
            setRobotPerformance(updatedPerformance);
            evolveTrigger(updatedPerformance); 
            if (user) saveRobotPerformance(user.uid, updatedPerformance);
        }

        // 4. Nova Votação do Conselho
        let riseConfidenceSum = 0;
        let fallConfidenceSum = 0;
        const newVotes: CouncilVotes = {};

        strategyCouncil.forEach((robot) => {
            const { vote, confidence, optimalDuration, optimalDurationUnit, suggestedStake } = calculateRobotVote(robot, currentIndicators, tickCandles);
            
            // Peso Meritocrático: Robôs que acertam mais, valem mais
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = performanceMap.get(robot.id);
                if (perf && (perf.wins + perf.losses) > 5) {
                    const winRateDecimal = perf.winRate / 100;
                    // Se winrate > 50%, aumenta peso. Se < 50%, diminui.
                    weight = 1 + (winRateDecimal - 0.5) * 2; 
                    weight = Math.max(0.2, Math.min(2.0, weight)); // Clamp peso entre 0.2 e 2.0
                }
            }

            // Criar Trade Virtual se o robô votar
            if (vote !== 'HOLD') {
                const tradeId = `vt_${Date.now()}_${tradeCounterRef.current++}`;
                const durationInSeconds = durationToSeconds(optimalDuration, optimalDurationUnit);

                const virtualTrade: VirtualTrade = {
                    id: tradeId,
                    robotId: robot.id,
                    vote: vote,
                    entryPrice: currentTick.price,
                    entryEpoch: currentTick.epoch,
                    exitEpoch: currentTick.epoch + durationInSeconds,
                };
                virtualTradesRef.current.push(virtualTrade);
            }

            newVotes[robot.id] = { vote, confidence, weight, optimalDuration, optimalDurationUnit, suggestedStake };
            
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });

        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });
        setActiveCommittee(committeeOfSpecialists(currentIndicators));
        
        // Decisão Visual
        if (riseConfidenceSum > fallConfidenceSum && riseConfidenceSum > 0) setConsensusDecision('RISE');
        else if (fallConfidenceSum > riseConfidenceSum && fallConfidenceSum > 0) setConsensusDecision('FALL');
        else setConsensusDecision('HOLD');
        
        // 5. Execução Real (Se Aprovado)
        if (councilExecutionRef.current.isExecuting) return;

        const dailyPnl = operationsLog
            .filter(op => new Date(op.timestamp).toDateString() === new Date().toDateString() && op.initiator === 'Conselho')
            .reduce((sum, op) => sum + (op.result || 0), 0);
            
        const supervisionDecision = supervisionCommitteeCheck(newVotes, currentIndicators, dailyPnl);
        setSupervisionStatus(supervisionDecision);

        if (supervisionDecision.status === 'approved') {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const { finalStake, finalDuration, finalDurationUnit } = supervisionDecision;
            
            toast({ title: 'Ordem do Conselho', description: `Executando ${direction} com stake de $${finalStake}.` });
            
            executeTrade(
                direction === 'RISE' ? 'CALL' : 'PUT', 
                finalStake, 
                activeSymbol!, 
                direction.toLowerCase() as 'rise' | 'fall', 
                finalDuration, 
                finalDurationUnit, 
                'Conselho'
            ).finally(() => {
                // Cooldown para evitar abrir muitas ordens seguidas
                setTimeout(() => (councilExecutionRef.current.isExecuting = false), 5000);
            });
        }

    }, [
        priceTicks, tickCandles, isConnected, isCouncilAutopilotOn, strategyCouncil, robotPerformance, 
        isMeritocracyOn, activeSymbol, operationsLog, supervisionCommitteeCheck, toast, executeTrade, 
        timePeriod, committeeOfSpecialists, user, evolveTrigger, positionManagementCommittee
    ]);

    return {
        isCouncilAutopilotOn, setIsCouncilAutopilotOn, strategyCouncil, fetchStrategyCouncil, dissolveCouncil, isFetchingCouncil,
        councilVotes, dailyBalance, setDailyBalance, dailyTarget, setDailyTarget, consensusThreshold, setConsensusThreshold,
        isDynamicConsensusOn, setIsDynamicConsensusOn, isDynamicRiskOn, setIsDynamicRiskOn, isMeritocracyOn, setIsMeritocracyOn,
        indicators, activeCommittee, supervisionStatus, consensusSum, consensusDecision, robotPerformance,
        evolutionHistory,
    };
}
