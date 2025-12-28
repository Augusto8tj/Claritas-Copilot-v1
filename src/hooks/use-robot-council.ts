
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import { useTradeAnalysis } from './use-trade-analysis';
import type { Indicators } from '@/services/indicator-service';

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
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}

/**
 * Builds a statically defined, locally calibrated council of all 22 trading robots.
 * @param durationUnit The time horizon ('t', 'm', etc.) to calibrate parameters for.
 * @param dailyBalance The daily balance for risk management.
 * @returns An array of 22 configured RobotStrategy objects.
 */
const buildStaticCouncil = (durationUnit: RiseFallFormValues['duration_unit'], dailyBalance: number): RobotStrategy[] => {
    const isTickTrading = durationUnit === 't';
    const suggestedStake = Math.max(0.35, dailyBalance * 0.01);
    const suggestedDuration = isTickTrading ? 5 : 1;

    const strategies: RobotStrategy[] = [
        // --- Momentum & Trend ---
        {
            id: 'RSI_BOT_1', strategyType: 'RSI', justification: `Parâmetros de RSI ${isTickTrading ? 'rápidos (7)' : 'padrão (14)'} para o horizonte de tempo.`,
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 65,
            period: isTickTrading ? 7 : 14, strongBuyThreshold: 25, weakBuyThreshold: 35, strongSellThreshold: 75, weakSellThreshold: 65,
        },
        {
            id: 'STOCH_BOT_1', strategyType: 'STOCHASTIC', justification: `Estocástico ${isTickTrading ? 'sensível (10)' : 'padrão (14)'} para detectar reversões rápidas.`,
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 65,
            period: isTickTrading ? 10 : 14, strongBuyThreshold: 20, weakBuyThreshold: 30, strongSellThreshold: 80, weakSellThreshold: 70,
        },
        {
            id: 'MACD_BOT_1', strategyType: 'MACD_CROSS', justification: `MACD ${isTickTrading ? 'rápido (8/17/6)' : 'padrão (12/26/9)'} para capturar cruzamentos de momentum.`,
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 95, weakConfidence: 70,
            fastPeriod: isTickTrading ? 8 : 12, slowPeriod: isTickTrading ? 17 : 26, signalPeriod: isTickTrading ? 6 : 9,
        },
        {
            id: 'ADX_BOT_1', strategyType: 'ADX_TREND', justification: 'Usa o ADX para confirmar a força da tendência antes de entrar.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: 14, trendStrengthThreshold: 25,
        },
        {
            id: 'AWESOME_OSC_BOT_1', strategyType: 'AWESOME_OSCILLATOR', justification: 'Busca "pires" e cruzamentos de linha zero para sinais de momentum.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 60,
        },
        {
            id: 'TRIX_BOT_1', strategyType: 'TRIX', justification: 'Usa a inclinação do TRIX para um sinal de momentum suave.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: isTickTrading ? 9 : 15,
        },
        {
            id: 'ROC_BOT_1', strategyType: 'ROC', justification: 'Mede a velocidade da mudança de preço para sinais de aceleração.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 55,
            period: isTickTrading ? 9 : 12,
        },
        {
            id: 'RVI_BOT_1', strategyType: 'RVI', justification: 'Mede a convicção da tendência com base no vigor relativo.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 65,
            period: 10, strongBuyThreshold: 40, weakBuyThreshold: 50, strongSellThreshold: 60, weakSellThreshold: 50,
        },
        {
            id: 'PSAR_BOT_1', strategyType: 'PARABOLIC_SAR', justification: 'Identifica reversões de tendência com pontos SAR.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 0,
            acceleration: 0.02, maxAcceleration: 0.2,
        },
        {
            id: 'MA_CROSS_BOT_1', strategyType: 'MOVING_AVERAGE_CROSS', justification: `Cruzamento de médias ${isTickTrading ? 'curtas (5/10)' : 'padrão (10/20)'}.`,
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 0,
            shortPeriod: isTickTrading ? 5 : 10, longPeriod: isTickTrading ? 10 : 20,
        },
        // --- Volatility & Structure ---
        {
            id: 'BB_BOT_1', strategyType: 'BOLLINGER_BANDS', justification: `Negocia reversões nas bandas com desvio padrão ${isTickTrading ? '1.8' : '2.0'}.`,
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: 20, stdDev: isTickTrading ? 1.8 : 2.0,
        },
        {
            id: 'ICHIMOKU_BOT_1', strategyType: 'ICHIMOKU_CLOUD', justification: 'Analisa a nuvem Kumo como suporte/resistência dinâmica.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 88, weakConfidence: 60,
        },
        {
            id: 'KAMA_BOT_1', strategyType: 'KAMA', justification: 'Usa a média móvel adaptativa para seguir a tendência suavemente.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 65,
            period: 10, fastEnd: 2, slowEnd: 30
        },
        {
            id: 'DONCHIAN_BOT_1', strategyType: 'DONCHIAN_CHANNELS', justification: 'Busca rompimentos dos canais de Donchian de 20 períodos.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 0,
            period: 20,
        },
        {
            id: 'CHANDELIER_BOT_1', strategyType: 'CHANDELIER_EXIT', justification: 'Usa o Chandelier Exit para seguir a tendência.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 0,
            period: 22, multiplier: 3.0,
        },
        // --- Volume & Order Flow ---
        {
            id: 'VP_BOT_1', strategyType: 'VOLUME_PROFILE', justification: 'Identifica suporte/resistência em zonas de alto volume (POC).',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 75, weakConfidence: 55,
            profileBars: 100,
        },
        {
            id: 'VWAP_BOT_1', strategyType: 'VWAP', justification: 'Usa o VWAP como um nível de preço médio dinâmico.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 60,
        },
        {
            id: 'MFI_BOT_1', strategyType: 'MFI', justification: 'RSI ponderado por volume para medir a pressão do dinheiro.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 65,
            period: 14, strongBuyThreshold: 20, weakBuyThreshold: 30, strongSellThreshold: 80, weakSellThreshold: 70,
        },
        {
            id: 'OBV_BOT_1', strategyType: 'OBV', justification: 'Confirma a força da tendência com base no volume acumulado.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 75, weakConfidence: 50,
        },
        // --- Statistical & Mean Reversion ---
        {
            id: 'ZSCORE_BOT_1', strategyType: 'Z_SCORE', justification: 'Negocia reversão à média com base em desvios padrão (Z-Score).',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: 20, zScoreThreshold: 2.0
        },
        {
            id: 'STOCH_RSI_BOT_1', strategyType: 'STOCH_RSI', justification: 'Indicador de indicador para sinais rápidos de sobrecompra/venda.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 88, weakConfidence: 68,
            period: 14, strongBuyThreshold: 0.2, weakBuyThreshold: 0.3, strongSellThreshold: 0.8, weakSellThreshold: 0.7,
        },
        // --- Patterns ---
        {
            id: 'PA_BOT_1', strategyType: 'PRICE_ACTION_PATTERN', justification: 'Identifica padrões de velas de reversão como Martelo/Estrela Cadente.',
            suggestedStake, suggestedDuration, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 0,
            pattern: 'hammer', // Default, logic will check for both
        },
    ];

    return strategies;
};


export function useRobotCouncil(
    activeSymbol: string | null,
    indicators: Indicators
) {
    const { operationsLog, executeTrade, chartData } = useDerivApi();
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
    const previousMacdRef = useRef<{ macd: number | null; signal: number | null }>({ macd: null, signal: null });
    const previousObvRef = useRef<number | null>(null);

    const incrementGeminiRequestCount = useCallback(() => {}, []);

    const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog, incrementGeminiRequestCount);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);

    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) return;
        setIsFetchingCouncil(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            const { duration_unit } = form.getValues();
            const council = buildStaticCouncil(duration_unit, dailyBalance);
            setStrategyCouncil(council);
            toast({ title: "Conselho de IA Montado!", description: `Os ${council.length} analistas-robôs estão prontos e calibrados.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao Montar o Conselho", description: e.message });
        } finally {
            setIsFetchingCouncil(false);
        }
    }, [activeSymbol, dailyBalance, form, toast]);

    const supervisionCommitteeCheck = useCallback((stake: number, direction: 'RISE' | 'FALL') => {
        let finalStake = stake;
        let vetoReason: string | null = null;
    
        const dailyPnL = operationsLog
            .filter(op => op.initiator === 'Conselho' && op.status !== 'pending' && new Date(op.timestamp).toDateString() === new Date().toDateString())
            .reduce((sum, op) => sum + (op.result || 0), 0);

        if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
            vetoReason = "Limite de perda diária atingido. Operações bloqueadas.";
        } else if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
            vetoReason = "Meta de lucro diária atingida. Operações bloqueadas.";
        }
    
        if (vetoReason) return { finalStake, vetoReason };

        const atr = indicators.atr;
        const lastClose = chartData.length > 0 ? (chartData[chartData.length - 1] as any).close : null;
        if (atr && lastClose) {
            const atrPercentage = (atr / lastClose) * 100;
            if (atrPercentage > 0.05) { 
                finalStake *= 0.75;
                toast({ title: "Supervisor de Volatilidade", description: "ATR alto. Risco reduzido para 75%.", variant: "default" });
            }
        }
        
        const adx = indicators.adx;
        if (adx) {
            if (adx < 20) { 
                finalStake *= 0.75;
                toast({ title: "Supervisor de Tendência", description: "ADX baixo (mercado lateral). Risco reduzido.", variant: "default" });
            } else if (adx > 35) { 
                finalStake *= 1.25; 
                toast({ title: "Supervisor de Tendência", description: "ADX alto (tendência forte). Risco aumentado.", variant: "default" });
            }
        }

        if (finalStake < 0.35) finalStake = 0.35;
        
        return { finalStake, vetoReason };

    }, [operationsLog, dailyBalance, dailyTarget, indicators, chartData, toast]);

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
    };

    const committeeOfSpecialists = useCallback(() => {
        const activeSpecialists: RobotStrategy[] = [];
        const { adx, atr, bbw } = indicators;

        const isVolatile = (bbw && bbw > 0.04) || (atr && chartData.length > 0 && atr > ((chartData[chartData.length - 1] as any).close || 1) * 0.0005);
        if (isVolatile) {
            const volatilityBots = strategyCouncil.filter(r => ['BOLLINGER_BANDS', 'KAMA', 'ADX_TREND', 'CHANDELIER_EXIT'].includes(r.strategyType));
            activeSpecialists.push(...volatilityBots);
        }

        const isTrending = adx && adx > 25;
        if (isTrending) {
            const trendBots = strategyCouncil.filter(r => ['MOVING_AVERAGE_CROSS', 'MACD_CROSS', 'ICHIMOKU_CLOUD', 'PARABOLIC_SAR'].includes(r.strategyType));
            activeSpecialists.push(...trendBots);
        }

        if (!isTrending) {
             const rangeBots = strategyCouncil.filter(r => ['RSI', 'STOCHASTIC', 'Z_SCORE', 'STOCH_RSI', 'RVI'].includes(r.strategyType));
            activeSpecialists.push(...rangeBots);
        }

        if (activeSpecialists.length === 0) {
            const defaultBots = strategyCouncil.filter(r => ['RSI', 'MOVING_AVERAGE_CROSS'].includes(r.strategyType));
            activeSpecialists.push(...defaultBots);
        }

        return [...new Map(activeSpecialists.map(item => [item.id, item])).values()];

    }, [indicators, strategyCouncil, chartData]);

    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators.rsi || !chartData.length) {
            return;
        }
        
        let currentThreshold = consensusThreshold;
        if (isDynamicConsensusOn && indicators.atr) {
            const baseThreshold = 250;
            const volatilityFactor = indicators.atr * 1000;
            const dynamicThreshold = Math.round(baseThreshold + volatilityFactor);
            currentThreshold = Math.max(150, Math.min(700, dynamicThreshold));
            setDynamicConsensus(dynamicThreshold);
        }

        const newVotes: CouncilVotes = {};
        let riseConfidenceSum = 0, fallConfidenceSum = 0;
        
        const activeSpecialists = committeeOfSpecialists();
        const currentPrice = (chartData[chartData.length-1] as any)?.close;
        if (!currentPrice) return;

        activeSpecialists.forEach(robot => {
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
                    if (indicators.rsi) {
                        if (robot.strongBuyThreshold && indicators.rsi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.rsi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.rsi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.rsi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'STOCHASTIC':
                    if (indicators.stoch) {
                        if (robot.strongBuyThreshold && indicators.stoch <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.stoch <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.stoch >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.stoch >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                 case 'MACD_CROSS':
                    const { macd: currentMacd, signal: currentSignal } = indicators.macd;
                    const { macd: prevMacd, signal: prevSignal } = previousMacdRef.current;
                    if (currentMacd !== null && currentSignal !== null && prevMacd !== null && prevSignal !== null) {
                         if (prevMacd <= prevSignal && currentMacd > currentSignal) { vote = 'RISE'; confidence = robot.strongConfidence; }
                         if (prevMacd >= prevSignal && currentMacd < currentSignal) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'MOVING_AVERAGE_CROSS':
                    if(indicators.ma.short && indicators.ma.long) {
                        if(indicators.ma.short > indicators.ma.long) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (indicators.ma.short < indicators.ma.long) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'BOLLINGER_BANDS':
                    const lastBB = indicators.bollingerBands.length > 0 ? indicators.bollingerBands[indicators.bollingerBands.length - 1] : null;
                    if (lastBB && currentPrice) {
                        if (currentPrice <= lastBB.lower) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (currentPrice >= lastBB.upper) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'ADX_TREND':
                    if (indicators.adx && indicators.pdi && indicators.ndi && robot.trendStrengthThreshold) {
                         if(indicators.adx > robot.trendStrengthThreshold) {
                             if(indicators.pdi > indicators.ndi) { vote = 'RISE'; confidence = robot.strongConfidence; }
                             else if (indicators.ndi > indicators.pdi) { vote = 'FALL'; confidence = robot.strongConfidence; }
                         }
                    }
                    break;
                case 'KAMA':
                    if (indicators.kama && currentPrice) {
                        if (currentPrice > indicators.kama) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (currentPrice < indicators.kama) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'Z_SCORE':
                    if (indicators.zScore && robot.zScoreThreshold) {
                        if (indicators.zScore <= -robot.zScoreThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (indicators.zScore >= robot.zScoreThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'STOCH_RSI':
                     if (indicators.stochRSI) {
                        if (robot.strongBuyThreshold && indicators.stochRSI <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.stochRSI <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.stochRSI >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.stochRSI >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'AWESOME_OSCILLATOR':
                    const ao = indicators.awesomeOscillator;
                    if(ao !== null) {
                        if(ao > 0) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if(ao < 0) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'TRIX':
                    const trix = indicators.trix;
                    if (trix !== null) {
                        if (trix > 0.01) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (trix < -0.01) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'ROC':
                    const roc = indicators.roc;
                    if (roc !== null) {
                        if (roc > 0.05) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (roc < -0.05) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                 case 'RVI':
                    if (indicators.rvi) {
                        if (robot.strongBuyThreshold && indicators.rvi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.rvi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.rvi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.rvi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                 case 'PARABOLIC_SAR':
                    if(indicators.parabolicSAR && currentPrice) {
                        if(currentPrice > indicators.parabolicSAR) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if(currentPrice < indicators.parabolicSAR) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                 case 'ICHIMOKU_CLOUD':
                    const ichi = indicators.ichimoku;
                    if (ichi && ichi.senkouA && ichi.senkouB && currentPrice) {
                        if (currentPrice > ichi.senkouA && currentPrice > ichi.senkouB) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (currentPrice < ichi.senkouA && currentPrice < ichi.senkouB) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'DONCHIAN_CHANNELS':
                    const lastDonchian = indicators.donchianChannels.length > 0 ? indicators.donchianChannels[indicators.donchianChannels.length - 1] : null;
                    if (lastDonchian && currentPrice) {
                         if (currentPrice >= lastDonchian.upper) { vote = 'RISE'; confidence = robot.strongConfidence; }
                         if (currentPrice <= lastDonchian.lower) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'CHANDELIER_EXIT':
                    if (indicators.chandelierExit && currentPrice) {
                        if(currentPrice > indicators.chandelierExit) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if(currentPrice < indicators.chandelierExit) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'VWAP':
                    const lastVWAP = indicators.vwap && indicators.vwap.length > 0 ? indicators.vwap[indicators.vwap.length - 1] : null;
                    if (lastVWAP && currentPrice) {
                         if(currentPrice > lastVWAP) { vote = 'RISE'; confidence = robot.weakConfidence; }
                         if(currentPrice < lastVWAP) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'MFI':
                     if (indicators.mfi) {
                        if (robot.strongBuyThreshold && indicators.mfi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.mfi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.mfi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.mfi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'OBV':
                    const obv = indicators.obv;
                    const prevObv = previousObvRef.current;
                    if (obv !== null && prevObv !== null) {
                        if (obv > prevObv) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (obv < prevObv) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        
        previousMacdRef.current = indicators.macd;
        previousObvRef.current = indicators.obv;
        setCouncilVotes(newVotes);

        const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= currentThreshold;
        if (consensusReached && activeSymbol) {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const baseStake = strategyCouncil[0]?.suggestedStake || form.getValues('stake');

            const { finalStake, vetoReason } = supervisionCommitteeCheck(baseStake, direction);

            if (vetoReason) {
                toast({ title: "Operação Vetada", description: vetoReason, variant: "destructive" });
                councilExecutionRef.current.isExecuting = false;
                if(vetoReason.includes("Limite de perda") || vetoReason.includes("Meta de lucro")){
                    setIsCouncilAutopilotOn(false);
                }
                return;
            }
            
            toast({ title: "Consenso Atingido!", description: `Executando ${direction} com stake ajustado de $${finalStake.toFixed(2)}.` });
            
            const { duration, duration_unit } = form.getValues();

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', duration, duration_unit, 'Conselho')
                .finally(() => setTimeout(() => { councilExecutionRef.current.isExecuting = false; }, 10000));
        }
    }, [
        indicators,
        isCouncilAutopilotOn,
        strategyCouncil,
        consensusThreshold,
        isDynamicConsensusOn,
        isMeritocracyOn,
        robotPerformance,
        executeTrade,
        activeSymbol,
        toast,
        form,
        supervisionCommitteeCheck,
        committeeOfSpecialists,
        chartData,
    ]);

    return {
        isCouncilAutopilotOn,
        setIsCouncilAutopilotOn,
        strategyCouncil,
        fetchStrategyCouncil,
        dissolveCouncil,
        isFetchingCouncil,
        councilVotes,
        geminiRequestCount,
        incrementGeminiRequestCount,
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
