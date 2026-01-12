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

// --- TIPAGEM E TIPOS DE DADOS ---
// Representa o voto de um único robô, incluindo sua confiança e sugestões.
export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
    optimalDuration: number;
    optimalDurationUnit: DurationUnit;
    suggestedStake: number;
};
// Um mapa que armazena os votos de todos os robôs pelo seu ID.
export type CouncilVotes = { [key:string]: RobotVote };

// Armazena as métricas de desempenho de um robô na Arena Virtual.
export type RobotPerformance = {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
    winRate: number; // Adicionado para facilitar o ranking na UI
};

// Representa uma operação simulada (paper trade) na Arena Virtual.
type VirtualTrade = {
    id: string;
    robotId: string;
    vote: 'RISE' | 'FALL';
    entryPrice: number;
    entryEpoch: number;
    exitEpoch: number; // NOVO: Tempo exato de expiração, para precisão máxima.
};

// --- CONSTANTES ---
const VIRTUAL_STAKE = 1.0; // Valor fixo para cada operação virtual, para cálculo de P&L.

// --- FUNÇÕES AUXILIARES (HELPERS) ---
const isCandle = (d: ChartData): d is CandleData => d !== null && 'close' in d;
const getPrice = (d: ChartData | null): number | undefined => {
    if (!d) return undefined;
    return isCandle(d) ? d.close : d.price;
};
const isValid = (value: any): value is number => value !== null && value !== undefined && !isNaN(value);

// Converte durações de diferentes unidades para segundos, para padronizar cálculos.
const durationToSeconds = (duration: number, unit: DurationUnit): number => {
    switch (unit) {
        case 't': return duration * 2; // Estimativa: 1 tick a cada 2 segundos em média nos índices sintéticos.
        case 's': return duration;
        case 'm': return duration * 60;
        case 'h': return duration * 3600;
        case 'd': return duration * 86400;
        default: return duration;
    }
};

/**
 * Função pura que calcula o voto de um único robô com base nos indicadores.
 * Não tem estado e apenas retorna uma decisão baseada nos dados fornecidos.
 * @param robot A estratégia do robô.
 * @param indicators Os valores atuais dos indicadores técnicos.
 * @param tickCandles Os dados de preço mais recentes.
 * @returns O voto do robô, confiança e sugestões.
 */
const calculateRobotVote = (
    robot: RobotStrategy,
    indicators: Indicators,
    tickCandles: CandleData[]
): Omit<RobotVote, 'weight'> => {
    // Objetivo: Calcular o voto, a confiança, e o stake sugerido.
    // O 'suggestedStake' agora é dinâmico com base na força do sinal.
    let vote: RobotVote['vote'] = 'HOLD';
    let confidence = 0;
    let suggestedStake = 0;
    const { optimalDuration, optimalDurationUnit, suggestedStake: baseStake } = robot;

    // Função auxiliar para definir o voto e o stake proporcional à confiança.
    const setVote = (newVote: 'RISE' | 'FALL', newConfidence: number) => {
        vote = newVote;
        confidence = newConfidence;
        // Stake sugerido é proporcional à confiança do sinal.
        if (confidence === robot.strongConfidence) {
            suggestedStake = baseStake; // Confiança alta = stake completo
        } else if (confidence === robot.weakConfidence) {
            suggestedStake = baseStake * 0.5; // Confiança baixa = meio stake
        }
    };

    if (!indicators) return { vote: 'HOLD', confidence: 0, optimalDuration, optimalDurationUnit, suggestedStake: 0 };
    
    // --- LÓGICA DE VOTAÇÃO PARA CADA TIPO DE ESTRATÉGIA ---
    // Cada bloco verifica o indicador relevante e usa `setVote` para registar a decisão.
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
     if (robot.strategyType === 'OBV' && isValid(indicators.obv) && indicators.sma.length > 1) {
         // Lógica do OBV: Compara o valor atual com uma média móvel do próprio OBV.
         // Esta parte é um pouco mais complexa e depende de como você armazena a série histórica do OBV.
         // Por simplicidade, vamos usar uma lógica de inclinação. Se o OBV está a subir, é um sinal de compra.
         if(indicators.sma && indicators.obv > indicators.sma[indicators.sma.length-1]!) {
            setVote('RISE', robot.weakConfidence);
         } else {
             setVote('FALL', robot.weakConfidence);
         }
    }
    if (robot.strategyType === 'TRIX' && isValid(indicators.trix)) {
        if (indicators.trix! > 0) setVote('RISE', robot.weakConfidence);
        if (indicators.trix! < 0) setVote('FALL', robot.weakConfidence);
    }
    if (robot.strategyType === 'ROC' && isValid(indicators.roc)) {
        if (indicators.roc! > 0) setVote('RISE', robot.weakConfidence);
        if (indicators.roc! < 0) setVote('FALL', robot.weakConfidence);
    }
    if (robot.strategyType === 'RVI' && isValid(indicators.rvi)) {
        if (indicators.rvi! > 50) setVote('RISE', robot.weakConfidence);
        if (indicators.rvi! < 50) setVote('FALL', robot.weakConfidence);
    }
    if (robot.strategyType === 'PARABOLIC_SAR' && isValid(indicators.parabolicSAR) && tickCandles.length > 0) {
        const lastPrice = tickCandles[tickCandles.length - 1].close;
        if (lastPrice > indicators.parabolicSAR!) setVote('RISE', robot.weakConfidence);
        if (lastPrice < indicators.parabolicSAR!) setVote('FALL', robot.weakConfidence);
    }

    return { vote, confidence, optimalDuration, optimalDurationUnit, suggestedStake };
};


/**
 * Hook principal que gere o Conselho de Robôs e a Arena Virtual.
 * @param activeSymbol O símbolo do ativo a ser negociado.
 * @param priceTicks A lista de ticks de preço recebidos da API.
 * @returns Um objeto com todos os estados e funções para controlar a Mesa Operacional.
 */
export function useRobotCouncil(
    activeSymbol: string | null,
    priceTicks: TickData[]
) {
    const { operationsLog, executeTrade, timePeriod, isConnected, durationLimits, sellContract } = useDerivApi();
    const { user, loading: isAuthLoading } = useAuth();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    // Hook de evolução genética, que fornece estratégias evoluídas.
    const { evolvedStrategies, evolveTrigger, evolutionHistory } = useStrategyEvolution(initialCouncilStrategies);
    
    // --- ESTADOS DO COMPONENTE ---
    // Estados do Conselho
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>(evolvedStrategies as RobotStrategy[]);
    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});
    
    // Configurações de Gestão de Risco
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isDynamicRiskOn, setIsDynamicRiskOn] = useState(true); 
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);

    // Desempenho e Simulação (Arena Virtual)
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    const virtualTradesRef = useRef<VirtualTrade[]>([]); // Usamos Ref para evitar re-renderizações a cada novo trade virtual.
    const tradeCounterRef = useRef(0);

    // Análise Técnica e Decisão
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

    // --- EFEITOS DE CARREGAMENTO E INICIALIZAÇÃO ---

    // Atualiza o conselho local quando as estratégias evoluem.
    useEffect(() => {
        setStrategyCouncil(evolvedStrategies as RobotStrategy[]);
    }, [evolvedStrategies]);

    // Carrega o desempenho dos robôs do Firebase quando o utilizador é autenticado.
    useEffect(() => {
        if (!user || isAuthLoading) return;
        loadRobotPerformance(user.uid)
            .then((stored) => {
                if (stored && stored.length > 0) setRobotPerformance(stored);
            })
            .catch(err => console.error("Erro ao carregar performance", err));
    }, [user, isAuthLoading]);

    // Otimização: Memoiza a conversão de Ticks para Candles para não recalcular a cada render.
    const tickCandles = useMemo(() => {
        if (!priceTicks || priceTicks.length === 0) return [];
        return priceTicks.map((t) => ({ 
            epoch: t.epoch, 
            open: t.price, 
            high: t.price, 
            low: t.price, 
            close: t.price, 
            volume: 1 
        }));
    }, [priceTicks]);

    /**
     * Convoca o conselho, ativando a Mesa Operacional e a Arena Virtual.
     */
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
        virtualTradesRef.current = []; // Reseta a simulação.
        tradeCounterRef.current = 0;
        
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        setStrategyCouncil(evolvedStrategies as RobotStrategy[]);

        // Se for a primeira vez, inicializa os dados de desempenho.
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

    // --- COMITÊS DE LÓGICA E GESTÃO ---

    /**
     * O "Gestor de Turno": Analisa as condições gerais do mercado.
     */
    const committeeOfSpecialists = useCallback((indicators: Indicators): string => {
        if (!indicators.adx || !indicators.stoch) return 'Análise Pendente';
        if (indicators.adx > 25) return "Tendência Forte Detectada";
        if (indicators.stoch < 20) return 'Zona de Sobre-venda';
        if (indicators.stoch > 80) return 'Zona de Sobre-compra';
        return 'Mercado Lateral';
    }, []);
    
    /**
     * O "Gestor de Posições": Monitoriza trades reais abertos para aplicar SL/TP dinâmico.
     */
    const positionManagementCommittee = useCallback((activeContracts: Operation[], indicators: Indicators) => {
        // Responsabilidade: Monitorar trades reais abertos para aplicar stop loss ou take profit dinâmico.
        if (!indicators.rsi || !indicators.stoch) return;

        for (const contract of activeContracts) {
            if (councilExecutionRef.current.sellingContracts.has(contract.id)) continue;

            const potentialProfit = contract.stake * 0.90; // Ex: 90% do lucro máximo potencial.
            const currentProfit = contract.result || 0;

            // Take Profit dinâmico se atingir 75% do lucro potencial.
            if (currentProfit >= potentialProfit * 0.75) {
                councilExecutionRef.current.sellingContracts.add(contract.id);
                sellContract(contract.id);
                toast({ title: "Lucro Garantido", description: `Encerrando contrato ${contract.id} com lucro.` });
                continue; 
            }

            // Stop Loss técnico se houver sinal de reversão forte.
            const isReversal = 
                (contract.direction === 'rise' && indicators.rsi > 75) || // Se está comprado e RSI entra em sobrecompra
                (contract.direction === 'fall' && indicators.rsi < 25);   // Se está vendido e RSI entra em sobrevenda

            if (isReversal && currentProfit < -contract.stake * 0.4) { // E já está a perder mais de 40%
                councilExecutionRef.current.sellingContracts.add(contract.id);
                sellContract(contract.id);
                toast({ title: "Proteção de Capital", description: `Reversão detectada. Encerrando ${contract.id}.`, variant: "destructive" });
            }
        }
    }, [sellContract, toast]);

    /**
     * A "Direção de Risco": A camada final de decisão. Aprova, veta ou ajusta a operação.
     */
    const supervisionCommitteeCheck = useCallback((
            currentVotes: CouncilVotes,
            indicators: Indicators | null,
            dailyPnl: number,
        ) => {
            // Responsabilidade: Tomar a decisão final de trade, ajustando stake e duração.
            const formValues = form.getValues();
            
            // 1. Calcula médias ponderadas das sugestões dos robôs para Stake e Duração.
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

            // 2. Verifica limites de perda/ganho diários (Stop Loss/Take Profit do Dia).
            if (dailyPnl <= -dailyBalance) return { ...defaultResult, status: 'veto', message: 'Stop Loss Diário Atingido', analysis: 'Operações suspensas por hoje.' };
            if (dailyPnl >= dailyTarget) return { ...defaultResult, status: 'veto', message: 'Meta Diária Batida', analysis: 'Lucro no bolso. Bom descanso.' };
            
            // 3. Calcula o Consenso Dinâmico, ajustado pela volatilidade.
            let effectiveThreshold = consensusThreshold;
            if (isDynamicConsensusOn) {
                // Se a volatilidade (BBW) for alta, exige um consenso maior para entrar.
                const volatilityFactor = (indicators.bbw || 0) > 0.1 ? 1.2 : 1.0; 
                effectiveThreshold = (totalWeight * 0.6) * volatilityFactor; // Exige 60% do "poder de voto" disponível.
            }

            const consensusReached = Math.max(riseSum, fallSum) >= effectiveThreshold;
            if (!consensusReached) return { ...defaultResult, message: 'Sem consenso suficiente.' };

            // 4. Ajusta o Risco (Stake) com base nas condições de mercado.
            let riskFactor = 1.0;
            let analysis = 'Condições normais.';
            if (isDynamicRiskOn) {
                if (indicators.adx && indicators.adx < 20) {
                    riskFactor = 0.5; // Reduz o risco em mercados sem tendência.
                    analysis = 'Mercado lento (ADX Baixo). Stake reduzida.';
                }
            }
            
            let finalStake = parseFloat(Math.max(0.35, averageStake * riskFactor).toFixed(2));
            
            // 5. Ajusta a Duração e a Unidade para a melhor combinação possível (Gestão de Risco Temporal).
            let finalDurationInSeconds = averageDurationInSeconds;
             if (isDynamicRiskOn) {
                 if (indicators.atr && indicators.bbw) {
                     // Se a volatilidade (BBW) é alta, mas a amplitude (ATR) é baixa, significa ruído. Diminuir duração.
                     if (indicators.bbw > 0.1 && (indicators.atr / getPrice(tickCandles[tickCandles.length-1])!) < 0.0001) {
                         finalDurationInSeconds *= 0.7; 
                         analysis += " Ruído detectado, duração diminuída.";
                     } 
                     // Se a volatilidade é alta e a amplitude também, há um movimento forte. Aumentar duração para dar espaço.
                     else if (indicators.bbw > 0.1) {
                         finalDurationInSeconds *= 1.3;
                         analysis += " Volatilidade direcional, duração aumentada.";
                     }
                 }
            }

            // Converte a duração final em segundos para a unidade mais apropriada (t, s, m).
            let finalDurationUnit: DurationUnit = 'm';
            let finalDuration = Math.round(finalDurationInSeconds / 60);

            if (finalDurationInSeconds <= durationLimits.t.max * 2) { // Usa a média de 2s por tick para decidir.
                finalDurationUnit = 't';
                finalDuration = Math.round(finalDurationInSeconds / 2);
            } else if (finalDurationInSeconds < 120) { // Menos de 2 minutos, usa segundos.
                finalDurationUnit = 's';
                finalDuration = Math.round(finalDurationInSeconds);
            }

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
        [dailyBalance, dailyTarget, isDynamicConsensusOn, isDynamicRiskOn, consensusThreshold, form, durationLimits, tickCandles]
    );

    /**
     * O Loop Principal: Roda a cada novo tick de preço.
     * Orquestra todos os comitês e lógicas.
     */
    useEffect(() => {
        // --- Guarda de Segurança ---
        // Este bloco garante que o loop só execute se todas as condições essenciais forem atendidas.
        if (!isConnected || !user || !isCouncilAutopilotOn || strategyCouncil.length === 0 || !activeSymbol || tickCandles.length < 2) return;

        const currentTick = priceTicks[priceTicks.length - 1];
        
        // Passo 1: Calcular todos os indicadores de uma só vez.
        const currentIndicators = calculateAllIndicators(tickCandles, strategyCouncil, timePeriod);
        setIndicators(currentIndicators);
        if (!currentIndicators) return;

        // Passo 2: Gerir posições reais abertas (TP/SL dinâmico).
        const activeCouncilContracts = operationsLog.filter(op => op.status === 'pending' && op.initiator === 'Conselho');
        if (activeCouncilContracts.length > 0) {
            positionManagementCommittee(activeCouncilContracts, currentIndicators);
        }

        // Passo 3: Processar a Arena Virtual (julgar trades e atualizar performance).
        // Esta é a base do aprendizado contínuo.
        const stillActiveTrades: VirtualTrade[] = [];
        const performanceMap = new Map<string, RobotPerformance>(robotPerformance.map((p) => [p.id, { ...p }]));
        let performanceChanged = false;

        virtualTradesRef.current.forEach((trade) => {
            // Julgamento preciso baseado no tempo (epoch).
            if (currentTick.epoch >= trade.exitEpoch) {
                const exitTick = priceTicks.find(t => t.epoch >= trade.exitEpoch) || currentTick;
                
                if (exitTick) {
                    const isWin = (trade.vote === 'RISE' && exitTick.price > trade.entryPrice) || 
                                  (trade.vote === 'FALL' && exitTick.price < trade.entryPrice);
                    
                    const perf = performanceMap.get(trade.robotId);
                    if (perf) {
                        const pnl = isWin ? VIRTUAL_STAKE * 0.95 : -VIRTUAL_STAKE;
                        perf.totalProfit = (perf.totalProfit || 0) + pnl;
                        if (isWin) perf.wins++; else perf.losses++;
                        
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

        if (performanceChanged) {
            const updatedPerformance = Array.from(performanceMap.values());
            updatedPerformance.sort((a, b) => b.winRate - a.winRate);
            
            setRobotPerformance(updatedPerformance);
            evolveTrigger(updatedPerformance); // Aciona o motor de evolução genética.
            if (user) saveRobotPerformance(user.uid, updatedPerformance); // Persiste no Firebase.
        }

        // Passo 4: O Conselho vota novamente com os dados atualizados.
        const newVotes: CouncilVotes = {};
        strategyCouncil.forEach((robot) => {
            const voteResult = calculateRobotVote(robot, currentIndicators, tickCandles);
            
            // Aplica o peso da Meritocracia.
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = performanceMap.get(robot.id);
                if (perf && (perf.wins + perf.losses) > 5) { // Só aplica peso após 5 trades
                    const winRateDecimal = perf.winRate / 100;
                    weight = 1 + (winRateDecimal - 0.5) * 2; // Amplifica o desempenho (bom ou mau)
                    weight = Math.max(0.2, Math.min(2.0, weight)); // Limita o peso entre 0.2x e 2.0x
                }
            }

            // Cria um novo trade virtual para esta votação.
            if (voteResult.vote !== 'HOLD') {
                const tradeId = `vt_${Date.now()}_${tradeCounterRef.current++}`;
                const durationInSeconds = durationToSeconds(voteResult.optimalDuration, voteResult.optimalDurationUnit);

                const virtualTrade: VirtualTrade = {
                    id: tradeId,
                    robotId: robot.id,
                    vote: voteResult.vote,
                    entryPrice: currentTick.price,
                    entryEpoch: currentTick.epoch,
                    exitEpoch: currentTick.epoch + durationInSeconds, // Fim do trade baseado no tempo.
                };
                virtualTradesRef.current.push(virtualTrade);
            }

            newVotes[robot.id] = { ...voteResult, weight };
        });

        setCouncilVotes(newVotes);
        
        // Agrega os votos ponderados para formar o consenso.
        const { rise: riseSum, fall: fallSum } = Object.values(newVotes).reduce((acc, v) => {
            if (v.vote === 'RISE') acc.rise += v.confidence * v.weight;
            if (v.vote === 'FALL') acc.fall += v.confidence * v.weight;
            return acc;
        }, { rise: 0, fall: 0 });
        
        setConsensusSum({ rise: riseSum, fall: fallSum });
        setActiveCommittee(committeeOfSpecialists(currentIndicators));
        
        // Define a decisão final do consenso.
        if (riseSum > fallSum && riseSum > 0) setConsensusDecision('RISE');
        else if (fallSum > riseSum && fallSum > 0) setConsensusDecision('FALL');
        else setConsensusDecision('HOLD');
        
        // Passo 5: Execução de Trade Real, se aprovado pela Direção de Risco.
        if (councilExecutionRef.current.isExecuting) return; // Evita ordens duplicadas.

        // Calcula o P&L do dia para a lógica de stop/gain.
        const dailyPnl = operationsLog
            .filter(op => new Date(op.timestamp).toDateString() === new Date().toDateString() && op.initiator === 'Conselho')
            .reduce((sum, op) => sum + (op.result || 0), 0);
            
        // A Direção de Risco dá a palavra final.
        const supervisionDecision = supervisionCommitteeCheck(newVotes, currentIndicators, dailyPnl);
        setSupervisionStatus(supervisionDecision);

        if (supervisionDecision.status === 'approved') {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseSum > fallSum ? 'RISE' : 'FALL';
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
                // Cooldown para evitar ordens em sequência imediata.
                setTimeout(() => (councilExecutionRef.current.isExecuting = false), 5000);
            });
        }

    }, [
        // Lista de dependências: O useEffect re-executa se qualquer um destes valores mudar.
        priceTicks, tickCandles, isConnected, isCouncilAutopilotOn, strategyCouncil, robotPerformance, 
        isMeritocracyOn, activeSymbol, operationsLog, supervisionCommitteeCheck, toast, executeTrade, 
        timePeriod, committeeOfSpecialists, user, evolveTrigger, positionManagementCommittee
    ]);

    // Retorna todos os estados e funções para a UI.
    return {
        isCouncilAutopilotOn, setIsCouncilAutopilotOn, strategyCouncil, fetchStrategyCouncil, dissolveCouncil, isFetchingCouncil,
        councilVotes, dailyBalance, setDailyBalance, dailyTarget, setDailyTarget, consensusThreshold, setConsensusThreshold,
        isDynamicConsensusOn, setIsDynamicConsensusOn, isDynamicRiskOn, setIsDynamicRiskOn, isMeritocracyOn, setIsMeritocracyOn,
        indicators, activeCommittee, supervisionStatus, consensusSum, consensusDecision, robotPerformance,
        evolutionHistory,
    };
}
