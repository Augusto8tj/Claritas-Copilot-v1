
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';
import type { ChartData, TimePeriod } from './types';
import type { Operation } from '@/components/trading/operations-log.types';


export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
};
export type CouncilVotes = { [key:string]: RobotVote };

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
export interface RobotPerformance {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}

export type SupervisionStatus = {
    status: 'inactive' | 'approved' | 'veto';
    message: string;
    analysis?: string; // Detailed analysis text
};

type TradingStyle = 'HFT' | 'Scalping' | 'Intraday' | 'Swing';
type MarketCondition = 'Tendência de Alta' | 'Tendência de Baixa' | 'Reversão (Alta)' | 'Reversão (Baixa)' | 'Volatilidade' | 'Lateral';


const getTradingStyle = (timePeriod: TimePeriod): TradingStyle => {
    const hftPeriods: TimePeriod[] = ['1m', '2m'];
    const scalpingPeriods: TimePeriod[] = ['3m', '5m', '10m', '15m'];
    const intradayPeriods: TimePeriod[] = ['30m', '1h'];
    if (hftPeriods.includes(timePeriod)) return 'HFT';
    if (scalpingPeriods.includes(timePeriod)) return 'Scalping';
    if (intradayPeriods.includes(timePeriod)) return 'Intraday';
    return 'Swing'; // for 8h, 1d
};

/**
 * Builds a dynamically calibrated council of all 22 trading robots based on trading style.
 * @param timePeriod The chart time period to calibrate for.
 * @param dailyBalance The daily balance for risk management.
 * @returns An array of 22 configured RobotStrategy objects.
 */
const buildStaticCouncil = (timePeriod: TimePeriod, dailyBalance: number): RobotStrategy[] => {
    const style = getTradingStyle(timePeriod);
    const isTickTrading = ['1m', '2m', '3m', '5m'].includes(timePeriod); 
    const durationUnit = isTickTrading ? 't' : 'm';
    const suggestedStake = Math.max(0.35, dailyBalance * 0.01);
    
    // Default calibrations (Intraday)
    let rsiParams = { period: 14, strongBuy: 30, weakBuy: 40, strongSell: 70, weakSell: 60, justification: 'padrão (14) para seguir tendência.' };
    let stochParams = { period: 14, strongBuy: 20, weakBuy: 30, strongSell: 80, weakSell: 70, justification: 'padrão (14) para reversão.' };
    let macdParams = { fast: 12, slow: 26, signal: 9, justification: 'padrão (12/26/9) para capturar tendências.'};
    let maParams = { short: 20, long: 50, justification: 'padrão (20/50) para cruzamentos de tendência.'};
    let bbParams = { period: 20, stdDev: 2.0, justification: 'padrão (20/2.0) para "andar nas bandas".' };
    let adxThreshold = 25;
    let kamaPeriod = 10;
    let donchianPeriod = 20;
    let trixPeriod = 15;
    let rocPeriod = 12;
    let chandelierMultiplier = 3.0;

    switch (style) {
        case 'HFT':
            rsiParams = { period: 7, strongBuy: 25, weakBuy: 35, strongSell: 75, weakSell: 65, justification: 'rápidos (7) para reversão extrema.' };
            stochParams = { period: 10, strongBuy: 20, weakBuy: 30, strongSell: 80, weakSell: 70, justification: 'sensível (10) para picos.' };
            macdParams = { fast: 8, slow: 17, signal: 6, justification: 'rápidos (8/17/6) para momentum imediato.' };
            maParams = { short: 5, long: 10, justification: 'curtas (5/10), quase inúteis para HFT.' };
            bbParams = { period: 20, stdDev: 1.8, justification: 'apertado (20/1.8) para rompimentos.'};
            adxThreshold = 30;
            kamaPeriod = 5;
            donchianPeriod = 10;
            trixPeriod = 9;
            rocPeriod = 9;
            chandelierMultiplier = 2.5;
            break;
        case 'Scalping':
            rsiParams = { period: 10, strongBuy: 25, weakBuy: 35, strongSell: 75, weakSell: 65, justification: 'médios (10) para divergências.' };
            stochParams = { period: 14, strongBuy: 20, weakBuy: 30, strongSell: 80, weakSell: 70, justification: 'padrão (14) para zonas de sobrecompra/venda.' };
            maParams = { short: 10, long: 20, justification: 'médios (10/20) para suporte dinâmico.' };
            bbParams = { period: 20, stdDev: 2.0, justification: 'padrão (20/2.0) para "squeezes".' };
            chandelierMultiplier = 3.0;
            break;
        case 'Swing':
            rsiParams = { period: 20, strongBuy: 20, weakBuy: 30, strongSell: 80, weakSell: 70, justification: 'longos (20) para ciclos de mercado.' };
            macdParams = { fast: 50, slow: 100, signal: 25, justification: 'longos (50/100/25) para ciclos macro.'};
            maParams = { short: 50, long: 200, justification: 'clássicos (50/200) para "Golden/Death Crosses".'};
            bbParams = { period: 50, stdDev: 2.5, justification: 'longo (50/2.5) para topos/fundos de mercado.'};
            adxThreshold = 20;
            donchianPeriod = 50;
            chandelierMultiplier = 4.0;
            break;
    }

    const strategies: RobotStrategy[] = [
        {
            id: 'RSI_BOT_1', strategyType: 'RSI', justification: `Parâmetros de RSI ${rsiParams.justification}`,
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 65,
            period: rsiParams.period, strongBuyThreshold: rsiParams.strongBuy, weakBuyThreshold: rsiParams.weakBuy, strongSellThreshold: rsiParams.strongSell, weakSellThreshold: rsiParams.weakSell,
        },
        {
            id: 'STOCH_BOT_1', strategyType: 'STOCHASTIC', justification: `Estocástico ${stochParams.justification}`,
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 65,
            period: stochParams.period, strongBuyThreshold: stochParams.strongBuy, weakBuyThreshold: stochParams.weakBuy, strongSellThreshold: stochParams.strongSell, weakSellThreshold: stochParams.weakSell,
        },
        {
            id: 'MACD_BOT_1', strategyType: 'MACD_CROSS', justification: `MACD ${macdParams.justification}`,
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 95, weakConfidence: 70,
            fastPeriod: macdParams.fast, slowPeriod: macdParams.slow, signalPeriod: macdParams.signal,
        },
        {
            id: 'ADX_BOT_1', strategyType: 'ADX_TREND', justification: 'Usa o ADX para confirmar a força da tendência antes de entrar.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: 14, trendStrengthThreshold: adxThreshold,
        },
        {
            id: 'AWESOME_OSC_BOT_1', strategyType: 'AWESOME_OSCILLATOR', justification: 'Busca "pires" e cruzamentos de linha zero para sinais de momentum.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 60,
        },
        {
            id: 'TRIX_BOT_1', strategyType: 'TRIX', justification: 'Usa a inclinação do TRIX para um sinal de momentum suave.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: trixPeriod,
        },
        {
            id: 'ROC_BOT_1', strategyType: 'ROC', justification: 'Mede a velocidade da mudança de preço para sinais de aceleração.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 55,
            period: rocPeriod,
        },
        {
            id: 'RVI_BOT_1', strategyType: 'RVI', justification: 'Mede a convicção da tendência com base no vigor relativo.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 65,
            period: 10, strongBuyThreshold: 40, weakBuyThreshold: 50, strongSellThreshold: 60, weakSellThreshold: 50,
        },
        {
            id: 'PSAR_BOT_1', strategyType: 'PARABOLIC_SAR', justification: 'Identifica reversões de tendência com pontos SAR.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 0,
            acceleration: 0.02, maxAcceleration: 0.2,
        },
        {
            id: 'MA_CROSS_BOT_1', strategyType: 'MOVING_AVERAGE_CROSS', justification: `Cruzamento de médias ${maParams.justification}`,
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 0,
            shortPeriod: maParams.short, longPeriod: maParams.long,
        },
        {
            id: 'BB_BOT_1', strategyType: 'BOLLINGER_BANDS', justification: `Negocia com base em Bandas de Bollinger ${bbParams.justification}`,
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: bbParams.period, stdDev: bbParams.stdDev,
        },
        {
            id: 'ICHIMOKU_BOT_1', strategyType: 'ICHIMOKU_CLOUD', justification: 'Analisa a nuvem Kumo como suporte/resistência dinâmica.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 88, weakConfidence: 60,
        },
        {
            id: 'KAMA_BOT_1', strategyType: 'KAMA', justification: 'Usa a média móvel adaptativa para seguir a tendência suavemente.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 65,
            period: kamaPeriod, fastEnd: 2, slowEnd: 30
        },
        {
            id: 'DONCHIAN_BOT_1', strategyType: 'DONCHIAN_CHANNELS', justification: `Busca rompimentos dos canais de Donchian de ${donchianPeriod} períodos.`,
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 0,
            period: donchianPeriod,
        },
        {
            id: 'CHANDELIER_BOT_1', strategyType: 'CHANDELIER_EXIT', justification: 'Usa o Chandelier Exit para seguir a tendência.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 90, weakConfidence: 0,
            period: 22, multiplier: chandelierMultiplier,
        },
        {
            id: 'VP_BOT_1', strategyType: 'VOLUME_PROFILE', justification: 'Identifica suporte/resistência em zonas de alto volume (POC).',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 75, weakConfidence: 55,
            profileBars: 100,
        },
        {
            id: 'VWAP_BOT_1', strategyType: 'VWAP', justification: 'Usa o VWAP como um nível de preço médio dinâmico.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 60,
        },
        {
            id: 'MFI_BOT_1', strategyType: 'MFI', justification: 'RSI ponderado por volume para medir a pressão do dinheiro.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 65,
            period: 14, strongBuyThreshold: 20, weakBuyThreshold: 30, strongSellThreshold: 80, weakSellThreshold: 70,
        },
        {
            id: 'OBV_BOT_1', strategyType: 'OBV', justification: 'Confirma a força da tendência com base no volume acumulado.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 75, weakConfidence: 50,
        },
        {
            id: 'ZSCORE_BOT_1', strategyType: 'Z_SCORE', justification: 'Negocia reversão à média com base em desvios padrão (Z-Score).',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 85, weakConfidence: 60,
            period: 20, zScoreThreshold: 2.0
        },
        {
            id: 'STOCH_RSI_BOT_1', strategyType: 'STOCH_RSI', justification: 'Indicador de indicador para sinais rápidos de sobrecompra/venda.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 88, weakConfidence: 68,
            period: 14, strongBuyThreshold: 0.2, weakBuyThreshold: 0.3, strongSellThreshold: 0.8, weakSellThreshold: 0.7,
        },
        {
            id: 'PA_BOT_1', strategyType: 'PRICE_ACTION_PATTERN', justification: 'Identifica padrões de velas de reversão como Martelo/Estrela Cadente.',
            suggestedStake, suggestedDuration: 5, suggestedDurationUnit: durationUnit, strongConfidence: 80, weakConfidence: 0,
            pattern: 'hammer',
        },
    ];

    return strategies;
};

const EMPTY_INDICATORS: Indicators = {
    rsi: null, stoch: null, atr: null, adx: null, pdi: null, ndi: null,
    macd: { macd: null, signal: null, histogram: null }, ma: { short: null, long: null },
    sma: [], ema: [], vwap: [], bollingerBands: [], donchianChannels: [],
    kama: null, bbw: null, stochRSI: null, zScore: null,
    awesomeOscillator: null, trix: null, roc: null, parabolicSAR: null,
    ichimoku: { tenkan: null, kijun: null, senkouA: null, senkouB: null },
    mfi: null, obv: null, chandelierExit: null, rvi: null
};

export function useRobotCouncil(
    activeSymbol: string | null,
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
    const [dynamicConsensus, setDynamicConsensus] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    const [consensusSum, setConsensusSum] = useState({ rise: 0, fall: 0 });
    
    // States to expose for UI
    const [activeCommittee, setActiveCommittee] = useState<string | null>(null);
    const [supervisionStatus, setSupervisionStatus] = useState<SupervisionStatus>({ status: 'inactive', message: 'Aguardando consenso.' });
    
    const councilExecutionRef = useRef({ isExecuting: false, lastVoteDirection: '' });
    const previousIndicatorsRef = useRef<Partial<Indicators>>({});

    const [indicators, setIndicators] = useState<Indicators>(EMPTY_INDICATORS);
    
    
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);

    const updateRobotPerformance = useCallback((operation: Operation) => {
        if (operation.initiator !== 'Conselho') return;
        
        const winningDirection = operation.status === 'won' ? operation.direction.toUpperCase() : (operation.direction === 'rise' ? 'FALL' : 'RISE');
        
        const contributingRobots = Object.entries(councilVotes)
            .filter(([_, voteData]) => voteData.vote === winningDirection)
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
            const alreadyProcessed = robotPerformance.some(p => p.totalProfit !== 0); // simplificação
            if(!alreadyProcessed || operationsLog.length > robotPerformance.reduce((acc, p) => acc + p.wins + p.losses, 0)) {
               updateRobotPerformance(lastOp);
            }
        }
    }, [operationsLog, updateRobotPerformance, robotPerformance]);


    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) return;
        setIsFetchingCouncil(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            const style = getTradingStyle(timePeriod);
            const council = buildStaticCouncil(timePeriod, dailyBalance);
            setStrategyCouncil(council);
            toast({ title: `Conselho de IA (${style}) Montado!`, description: `${council.length} analistas prontos e calibrados.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao Montar o Conselho", description: e.message });
        } finally {
            setIsFetchingCouncil(false);
        }
    }, [activeSymbol, dailyBalance, timePeriod, toast]);
    
    const committeeOfSpecialists = useCallback(() => {
        if (!indicators.rsi) {
            setActiveCommittee('Aguardando Dados...');
            return [];
        }
        let committeeName: MarketCondition;

        const isUpTrend = (indicators.ma.short ?? 0) > (indicators.ma.long ?? 0) && (indicators.adx ?? 0) > 20;
        const isDownTrend = (indicators.ma.short ?? 0) < (indicators.ma.long ?? 0) && (indicators.adx ?? 0) > 20;
        const isRsiOversold = indicators.rsi <= 30;
        const isRsiOverbought = indicators.rsi >= 70;
        const isBBWSqueeze = (indicators.bbw ?? 100) < 1.5;

        if (isUpTrend) committeeName = 'Tendência de Alta';
        else if (isDownTrend) committeeName = 'Tendência de Baixa';
        else if (isRsiOversold) committeeName = 'Reversão (Alta)';
        else if (isRsiOverbought) committeeName = 'Reversão (Baixa)';
        else if (isBBWSqueeze) committeeName = 'Volatilidade';
        else committeeName = 'Lateral';

        setActiveCommittee(committeeName);

        switch (committeeName) {
            case 'Tendência de Alta':
                return strategyCouncil.filter(r => ['MOVING_AVERAGE_CROSS', 'ADX_TREND', 'MACD_CROSS', 'PARABOLIC_SAR'].includes(r.strategyType));
            case 'Tendência de Baixa':
                return strategyCouncil.filter(r => ['MOVING_AVERAGE_CROSS', 'ADX_TREND', 'MACD_CROSS', 'PARABOLIC_SAR'].includes(r.strategyType));
            case 'Reversão (Alta)':
            case 'Reversão (Baixa)':
                return strategyCouncil.filter(r => ['RSI', 'STOCHASTIC', 'BOLLINGER_BANDS', 'Z_SCORE', 'PRICE_ACTION_PATTERN'].includes(r.strategyType));
            case 'Volatilidade':
                return strategyCouncil.filter(r => ['BOLLINGER_BANDS', 'DONCHIAN_CHANNELS', 'KAMA', 'ATR'].includes(r.strategyType)); // ATR não é um robô, mas representa a ideia
            default: // Lateral
                return strategyCouncil.filter(r => ['RSI', 'STOCHASTIC', 'AWESOME_OSCILLATOR', 'KAMA'].includes(r.strategyType));
        }
    }, [strategyCouncil, indicators]);


    const supervisionCommitteeCheck = useCallback((stake: number, direction: 'RISE' | 'FALL', confidenceSum: number) => {
        let finalStake = stake;
        let finalDuration = form.getValues('duration');
        let vetoReason: string | null = null;
        let analysis = "";

        const dailyPnL = operationsLog
            .filter(op => op.initiator === 'Conselho' && op.status !== 'pending' && new Date(op.timestamp).toDateString() === new Date().toDateString())
            .reduce((sum, op) => sum + (op.result || 0), 0);

        if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
            vetoReason = "Limite de perda diária atingido.";
        } else if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
            vetoReason = "Meta de lucro diária atingida.";
        }
        
        if (vetoReason) {
            setSupervisionStatus({ status: 'veto', message: vetoReason });
            return { finalStake, finalDuration, vetoReason };
        };

        const isReversalSetup = (direction === 'RISE' && (indicators.stoch ?? 50) <= 30) || (direction === 'FALL' && (indicators.stoch ?? 50) >= 70);
        
        if (isReversalSetup) {
            analysis = `Setup de Reversão (${direction}). `;
            finalDuration = Math.max(finalDuration, 7); 
        } else {
            analysis = `Consenso de ${direction}. `;
        }
        
        if(confidenceSum > 500) {
            finalStake *= 1.25;
            analysis += "Risco aumentado (alta conf.). ";
        } else if (confidenceSum < 350) {
            finalStake *= 0.75;
            analysis += "Risco reduzido (baixa conf.). ";
        }

        const atr = indicators.atr;
        const currentPrice = indicators.ma.long;
        if (atr && currentPrice) {
            const atrPercentage = (atr / currentPrice) * 100;
            if (atrPercentage > 0.05) { 
                finalStake *= 0.75;
                analysis += "Ajuste p/ vol (ATR). ";
            }
        }
        
        const adx = indicators.adx;
        if (adx && adx < 20) { 
            finalStake *= 0.75;
             analysis += "Ajuste p/ mercado lateral (ADX).";
        }

        if (finalStake < 0.35) finalStake = 0.35;
        
        setSupervisionStatus({ status: 'approved', message: `Aprovado: Stake $${finalStake.toFixed(2)}`, analysis });

        return { finalStake, finalDuration, vetoReason: null };

    }, [operationsLog, dailyBalance, dailyTarget, indicators, form]);


    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
    };

    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators.rsi) {
            if (supervisionStatus.status !== 'veto') {
              setSupervisionStatus({ status: 'inactive', message: 'Aguardando consenso ou ativação.' });
            }
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
        const currentPrice = indicators.ma.long;
        if (!currentPrice) return;
        
        const prevIndicators = previousIndicatorsRef.current;

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
                        if (robot.weakBuyThreshold && indicators.rsi >= robot.weakBuyThreshold && prevIndicators.rsi && prevIndicators.rsi < robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.weakSellThreshold && indicators.rsi <= robot.weakSellThreshold && prevIndicators.rsi && prevIndicators.rsi > robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'STOCHASTIC':
                    if (indicators.stoch && prevIndicators.stoch) {
                        if (prevIndicators.stoch < (robot.strongBuyThreshold || 20) && indicators.stoch >= (robot.strongBuyThreshold || 20)) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (prevIndicators.stoch > (robot.strongSellThreshold || 80) && indicators.stoch <= (robot.strongSellThreshold || 80)) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'MACD_CROSS':
                    const { macd: currentMacd, histogram: currentHist } = indicators.macd;
                    const { macd: prevMacd, histogram: prevHist } = prevIndicators.macd || {};
                    if (currentHist !== null && prevHist !== null) {
                         if (currentHist > 0 && currentHist > prevHist) { vote = 'RISE'; confidence = robot.weakConfidence; }
                         if (currentHist < 0 && currentHist < prevHist) { vote = 'FALL'; confidence = robot.weakConfidence; }
                         if (prevHist < 0 && currentHist > 0) { vote = 'RISE'; confidence = robot.strongConfidence; }
                         if (prevHist > 0 && currentHist < 0) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'AWESOME_OSCILLATOR':
                    const ao = indicators.awesomeOscillator;
                    const prevAo = prevIndicators.awesomeOscillator;
                    if (ao !== null && prevAo !== null) {
                        if (prevAo < 0 && ao >= 0) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (prevAo > 0 && ao <= 0) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'TRIX':
                    if (indicators.trix !== null && prevIndicators.trix !== null) {
                        if (indicators.trix > 0 && prevIndicators.trix <= 0) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (indicators.trix < 0 && prevIndicators.trix >= 0) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'ROC':
                    if (indicators.roc !== null && indicators.roc > 0.01) { vote = 'RISE'; confidence = robot.weakConfidence; }
                    if (indicators.roc !== null && indicators.roc < -0.01) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    break;
                case 'ADX_TREND':
                    if (indicators.adx && indicators.pdi && indicators.ndi && robot.trendStrengthThreshold) {
                         if (indicators.adx > robot.trendStrengthThreshold) {
                             if (indicators.pdi > indicators.ndi) { vote = 'RISE'; confidence = robot.weakConfidence; }
                             else if (indicators.ndi > indicators.pdi) { vote = 'FALL'; confidence = robot.weakConfidence; }
                         }
                    }
                    break;
                case 'PARABOLIC_SAR':
                    if (indicators.parabolicSAR && currentPrice) {
                        if (currentPrice > indicators.parabolicSAR) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (currentPrice < indicators.parabolicSAR) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'MOVING_AVERAGE_CROSS':
                    if (indicators.ma.short && indicators.ma.long && prevIndicators.ma?.short && prevIndicators.ma?.long) {
                        if (prevIndicators.ma.short <= prevIndicators.ma.long && indicators.ma.short > indicators.ma.long) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (prevIndicators.ma.short >= prevIndicators.ma.long && indicators.ma.short < indicators.ma.long) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'ICHIMOKU_CLOUD':
                    const ichi = indicators.ichimoku;
                    if (ichi && ichi.tenkan && ichi.kijun && currentPrice) {
                        if (currentPrice > ichi.tenkan && ichi.tenkan > ichi.kijun) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (currentPrice < ichi.tenkan && ichi.tenkan < ichi.kijun) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'BOLLINGER_BANDS':
                    const lastBB = indicators.bollingerBands[indicators.bollingerBands.length - 1];
                    if (lastBB && currentPrice) {
                        if (currentPrice < lastBB.lower) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (currentPrice > lastBB.upper) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'KAMA':
                    if (indicators.kama && currentPrice) {
                        if (currentPrice > indicators.kama) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (currentPrice < indicators.kama) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'DONCHIAN_CHANNELS':
                    const lastDonchian = indicators.donchianChannels[indicators.donchianChannels.length - 1];
                    if (lastDonchian && currentPrice) {
                        if (currentPrice >= lastDonchian.upper) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (currentPrice <= lastDonchian.lower) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'CHANDELIER_EXIT':
                    if (indicators.chandelierExit && currentPrice) {
                        if (currentPrice > indicators.chandelierExit) { vote = 'RISE'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'VWAP':
                    const vwap = indicators.vwap[indicators.vwap.length - 1];
                    const prevVwap = indicators.vwap[indicators.vwap.length - 2];
                    if (vwap && prevVwap && currentPrice) {
                        if (currentPrice > vwap && vwap > prevVwap) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (currentPrice < vwap && vwap < prevVwap) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'MFI':
                    if (indicators.mfi && prevIndicators.mfi) {
                         if (indicators.mfi > 20 && prevIndicators.mfi <= 20) { vote = 'RISE'; confidence = robot.strongConfidence; }
                         if (indicators.mfi < 80 && prevIndicators.mfi >= 80) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'OBV':
                    if (indicators.obv !== null && prevIndicators.obv !== null) {
                        if (indicators.obv > prevIndicators.obv) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        if (indicators.obv < prevIndicators.obv) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'Z_SCORE':
                    if (indicators.zScore !== null && prevIndicators.zScore !== null) {
                        if (indicators.zScore > -2.0 && prevIndicators.zScore <= -2.0) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (indicators.zScore < 2.0 && prevIndicators.zScore >= 2.0) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
                case 'STOCH_RSI':
                     if (indicators.stochRSI !== null && prevIndicators.stochRSI !== null) {
                        if (indicators.stochRSI > 0.2 && prevIndicators.stochRSI <= 0.2) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        if (indicators.stochRSI < 0.8 && prevIndicators.stochRSI >= 0.8) { vote = 'FALL'; confidence = robot.strongConfidence; }
                     }
                    break;
                case 'PRICE_ACTION_PATTERN':
                    // A lógica do Price Action é mais complexa e depende da detecção de velas.
                    // Esta parte seria implementada no serviço de indicadores.
                    break;
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        
        previousIndicatorsRef.current = indicators;
        setCouncilVotes(newVotes);
        setConsensusSum({ rise: riseConfidenceSum, fall: fallConfidenceSum });

        const totalConfidence = Math.max(riseConfidenceSum, fallConfidenceSum);
        const consensusReached = totalConfidence >= currentThreshold;

        if (consensusReached && activeSymbol) {
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';

            if(councilExecutionRef.current.lastVoteDirection === direction) return;
            councilExecutionRef.current.lastVoteDirection = direction;
            
            councilExecutionRef.current.isExecuting = true;
            const baseStake = strategyCouncil[0]?.suggestedStake || form.getValues('stake');

            const { finalStake, finalDuration, vetoReason } = supervisionCommitteeCheck(baseStake, direction, totalConfidence);

            if (vetoReason) {
                if(vetoReason.includes("Limite") || vetoReason.includes("Meta")){
                    setIsCouncilAutopilotOn(false);
                }
                councilExecutionRef.current.isExecuting = false; 
                return;
            }
            
            toast({ title: "Consenso Atingido!", description: `Executando ${direction} com stake $${finalStake.toFixed(2)} e duração ${finalDuration}t.` });
            
            const { duration_unit } = form.getValues();

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', finalDuration, duration_unit, 'Conselho')
                .finally(() => setTimeout(() => { 
                    councilExecutionRef.current.isExecuting = false; 
                    councilExecutionRef.current.lastVoteDirection = '';
                }, 10000));
        } else if (supervisionStatus.status !== 'veto') {
            setSupervisionStatus({ status: 'inactive', message: 'Aguardando consenso...' });
            councilExecutionRef.current.lastVoteDirection = '';
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
        supervisionStatus.status,
    ]);


    const processNewChartData = useCallback((chartData: ChartData[]) => {
        if (chartData.length > 0) {
            const calculatedIndicators = calculateAllIndicators(chartData, strategyCouncil, timePeriod);
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
        consensusThreshold: isDynamicConsensusOn ? dynamicConsensus : consensusThreshold,
        setConsensusThreshold,
        isDynamicConsensusOn,
        setIsDynamicConsensusOn,
        isMeritocracyOn,
        setIsMeritocracyOn,
        activeCommittee,
        supervisionStatus,
        processNewChartData,
        indicators,
        consensusSum,
    };
}
